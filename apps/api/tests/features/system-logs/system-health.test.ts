import assert from "node:assert/strict"
import { test } from "node:test"
import {
  SystemHealthObserver,
  systemHealthObserver,
} from "../../../src/features/health/system-health.service.js"
import { MessageExpiryObservation } from "../../../src/features/health/message-expiry-observation.js"
import { checkDatabase } from "../../../src/features/health/database-readiness.js"
import { errorLogs } from "../../../src/features/error-logs/error-log.js"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import { createApp } from "../../../src/app.js"
import { listen, closeServer } from "../../support/pglite-app.js"

test("health observations coalesce/cache probes, preserve successful time and never infer empty/missing health", async (t) => {
  let now = Date.now(),
    calls = 0
  let available = true
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const observer = new SystemHealthObserver(
    async () => {
      calls++
      await held
      return available ? "ok" : "unavailable"
    },
    () => now,
  )
  const first = observer.observe(),
    second = observer.observe()
  release()
  const initial = await first
  await second
  assert.equal(calls, 1)
  assert.equal(initial.api.status, "Healthy")
  assert.equal(initial.database.status, "Healthy")
  assert.equal(initial.messageExpiry.status, "Unknown")
  assert.equal(initial.recentErrors.status, "Unknown")
  assert.equal(initial.recentErrors.retainedCount, 0)
  await observer.observe()
  assert.equal(calls, 1)
  now += 10_000
  available = false
  const failed = await observer.observe()
  assert.equal(calls, 2)
  assert.equal(failed.database.status, "Unavailable")
  assert.equal(failed.lastSuccessfulCheckAt, initial.lastSuccessfulCheckAt)
  assert.equal((await observer.observe(true)).api.status, "Degraded")
  const read = t.mock.method(errorLogs.store, "read", () => {
    throw new Error("postgresql://secret password stack SQL")
  })
  const missing = await observer.observe()
  assert.equal(missing.recentErrors.status, "Unknown")
  assert.equal(missing.recentErrors.retainedCount, null)
  assert.ok(!JSON.stringify(missing).includes("secret"))
  read.mock.restore()
  errorLogs.captureInternal(
    new Error("private-sentinel"),
    "platform",
    "messages.expire",
  )
  assert.equal(
    (await new SystemHealthObserver(async () => "ok").observe()).recentErrors
      .status,
    "Degraded",
  )
  const noSuccess = await new SystemHealthObserver(
    async () => "not-configured",
  ).observe()
  assert.equal(noSuccess.database.status, "Unavailable")
  assert.equal(noSuccess.lastSuccessfulCheckAt, null)
})

test("existing job observation preserves work/outcomes and marks running/stale information Unknown", async () => {
  let now = Date.now()
  const job = new MessageExpiryObservation(() => now)
  assert.equal(job.snapshot().status, "Unknown")
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const pending = job.run(() => held)
  assert.equal(job.snapshot().running, true)
  assert.equal(job.snapshot().status, "Unknown")
  release()
  await pending
  assert.equal(job.snapshot().lastResult, "succeeded")
  assert.equal(job.snapshot().status, "Healthy")
  const fault = new Error("private internal failure")
  await assert.rejects(
    job.run(async () => {
      throw fault
    }),
    (error: unknown) => error === fault,
  )
  assert.equal(job.snapshot().lastResult, "failed")
  assert.equal(job.snapshot().status, "Degraded")
  now += 75 * 60_000 + 1
  assert.equal(job.snapshot().status, "Unknown")
  assert.equal(job.snapshot().lastResult, "failed")
})

test(
  "health API reuses readiness, stays sanitized/offline, and rechecks current authorization after waiting",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startSystemLogsApp(t)
    t.mock.method(console, "error", () => {})
    async function request(token = "", suffix = "", method = "GET") {
      const response = await fetch(`${base}/health${suffix}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      assert.equal(response.headers.get("cache-control"), "no-store")
      return response
    }
    assert.equal((await request()).status, 401)
    let token = "",
      actorId = "",
      sessionId = ""
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `health-${role}`,
          email: `${role}@health.test`,
          fullName: "private-person",
          passwordHash: "private-secret",
          role,
        },
      })
      const issued = await issueSession(user)
      if (role !== Role.SUPERADMIN) {
        assert.equal((await request(issued.token)).status, 403)
        continue
      }
      token = issued.token
      actorId = user.id
      sessionId = (
        await prisma.session.findFirstOrThrow({ where: { userId: user.id } })
      ).id
    }
    const response = await request(token)
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.ok(
      !/private-|DATABASE_URL|DIRECT_URL|password|SELECT|stack|Prisma|postgresql:/.test(
        text,
      ),
    )
    const snapshot = await systemHealthObserver.observe()
    assert.equal(snapshot.database.status, "Healthy")
    assert.equal(snapshot.scope, "instance")
    assert.equal(snapshot.messageExpiry.status, "Unknown")
    assert.equal((await request(token, "?anything=secret")).status, 400)
    assert.equal(await (await request(token, "", "HEAD")).text(), "")
    const originalTransaction = prisma.$transaction
    prisma.$transaction = () => {
      throw new Error("private-connection-string")
    }
    try {
      assert.equal(await checkDatabase(), "unavailable")
    } finally {
      prisma.$transaction = originalTransaction
    }
    let entered = () => {},
      release = () => {}
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    const observation = t.mock.method(
      systemHealthObserver,
      "observe",
      async () => {
        entered()
        await waiting
        return snapshot
      },
    )
    const inFlight = request(token)
    await started
    await prisma.user.update({
      where: { id: actorId },
      data: { role: Role.ADMIN },
    })
    release()
    const denied = await inFlight
    assert.equal(denied.status, 403)
    assert.deepEqual(await denied.json(), { error: "Insufficient permissions" })
    observation.mock.restore()
    await prisma.user.update({
      where: { id: actorId },
      data: { role: Role.SUPERADMIN, isActive: false },
    })
    assert.equal((await request(token)).status, 401)
    await prisma.user.update({
      where: { id: actorId },
      data: { isActive: true, accountDeletedAt: new Date() },
    })
    assert.equal((await request(token)).status, 401)
    await prisma.user.update({
      where: { id: actorId },
      data: { accountDeletedAt: null },
    })
    await db.exec('ALTER TABLE "Session" RENAME TO "HealthTestSession"')
    try {
      const unavailable = await request(token)
      assert.ok(unavailable.status >= 500)
      assert.ok(!/Session|SQL|Prisma/.test(await unavailable.text()))
    } finally {
      await db.exec('ALTER TABLE "HealthTestSession" RENAME TO "Session"')
    }
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(0) },
    })
    assert.equal((await request(token)).status, 401)
    await prisma.session.delete({ where: { id: sessionId } })
    assert.equal((await request(token)).status, 401)
    const closed = await listen(createApp())
    t.after(() => closeServer(closed.server))
    for (const environment of ["test", "production"]) {
      const previous = process.env.NODE_ENV
      try {
        process.env.NODE_ENV = environment
        const res = await fetch(`${closed.origin}/api/system-logs/health`)
        assert.equal(res.status, 404)
        assert.equal(res.headers.get("cache-control"), "no-store")
      } finally {
        process.env.NODE_ENV = previous
      }
    }
  },
)
