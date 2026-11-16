import assert from "node:assert/strict"
import { test } from "node:test"
import express from "express"
import {
  ErrorLogCollector,
  ErrorLogStore,
  errorLogs,
} from "../../../src/features/error-logs/error-log.js"
import { listErrorLogs } from "../../../src/features/error-logs/error-log.service.js"
import { handleError } from "../../../src/shared/error-handler.js"
import { HttpError } from "../../../src/shared/http-error.js"
import {
  listen,
  closeServer,
  startPgliteDatabase,
} from "../../support/pglite-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import { createApp } from "../../../src/app.js"
import { requireAuth } from "../../../src/features/auth/auth.middleware.js"

test("diagnostics classify safely, expire precisely, evict oldest and isolate storage failures", (t) => {
  let now = Date.now()
  const store = new ErrorLogStore(() => now)
  const collector = new ErrorLogCollector(store, () => now)
  const secret =
    "password=secret postgresql://private token=private email@example.test"
  collector.captureInternal(
    Object.assign(new Error(secret), { code: "P1001" }),
    "platform",
    "database.probe",
  )
  assert.equal(store.read()[0].category, "database")
  assert.equal(store.read()[0].code, "DATABASE_FAILURE")
  assert.equal(store.read()[0].actorId, null)
  assert.ok(!JSON.stringify(store.read()).includes(secret))
  now += 24 * 60 * 60 * 1000 - 1
  assert.equal(store.read().length, 1)
  now += 1
  assert.equal(store.read().length, 0)
  for (let i = 0; i < 1001; i++) {
    now += 1
    collector.captureInternal(new Error(secret), "platform", "messages.expire")
  }
  assert.equal(store.read().length, 1000)
  assert.equal(store.evictedCount, 1)
  const latest = store.read()[0]
  assert.equal(latest.occurredAt, new Date(now).toISOString())
  latest.message = secret
  assert.ok(!JSON.stringify(store.read()).includes(secret))
  t.mock.method(store, "append", () => {
    throw new Error(secret)
  })
  assert.doesNotThrow(() =>
    collector.captureInternal(new Error(secret), "platform", "messages.expire"),
  )
  assert.equal(collector.droppedCount, 1)
  // Hostile error properties must never escape a catch boundary.
  const hostile = Object.defineProperty(new Error(secret), "code", {
    get() {
      throw new Error(secret)
    },
  })
  assert.doesNotThrow(() =>
    collector.captureInternal(hostile, "platform", "database.probe"),
  )
})

test("Express capture preserves contracts, safe templates, skips expected rejections and deduplicates", async (t) => {
  t.mock.method(console, "error", () => {})
  const app = express()
  app.use(errorLogs.middleware)
  const router = express.Router()
  router.get("/:id/failure", () => {
    throw Object.assign(new Error("password token email stack secret"), {
      code: "P1001",
    })
  })
  router.get("/:id/conflict", () => {
    throw new HttpError(409, "Expected conflict")
  })
  router.get("/:id/direct", (_req, res) => {
    res.status(503).json({ error: "Existing response" })
  })
  app.use("/api/employees", router)
  app.use(handleError)
  const { server, origin } = await listen(app)
  t.after(() => closeServer(server))
  const before = errorLogs.store.read().length
  const failed = await fetch(
    `${origin}/api/employees/private-person/failure?token=secret`,
    { headers: { "X-Request-ID": "untrusted-secret" } },
  )
  assert.equal(failed.status, 503)
  assert.equal(failed.headers.get("retry-after"), "2")
  assert.equal(
    ((await failed.json()) as { error: string }).error,
    "The database is temporarily busy or unavailable. Please try again.",
  )
  const record = errorLogs.store.read()[0]
  assert.equal(record.moduleId, "people-hr")
  assert.equal(record.routeTemplate, "/api/employees/:id/failure")
  assert.equal(record.category, "database")
  assert.equal(errorLogs.store.read().length, before + 1)
  assert.ok(
    !/private-person|secret|password|stack|token/.test(JSON.stringify(record)),
  )
  const expected = await fetch(`${origin}/api/employees/private/conflict`)
  assert.equal(expected.status, 409)
  assert.deepEqual(await expected.json(), { error: "Expected conflict" })
  assert.equal(errorLogs.store.read().length, before + 1)
  await (await fetch(`${origin}/api/employees/private/direct`)).json()
  assert.equal(errorLogs.store.read().length, before + 2)
  t.mock.method(errorLogs.store, "append", () => {
    throw new Error("store unavailable")
  })
  const dropped = errorLogs.droppedCount
  const response = await fetch(`${origin}/api/employees/private/failure`)
  assert.equal(response.status, 503)
  assert.equal(
    ((await response.json()) as { error: string }).error,
    "The database is temporarily busy or unavailable. Please try again.",
  )
  assert.equal(errorLogs.droppedCount, dropped + 1)
})

test(
  "future diagnostic reads verify current accounts/sessions and production routes stay closed",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db } = await startPgliteDatabase(t)
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `error-${role}`,
          email: `error-${role}@example.test`,
          fullName: "Private",
          passwordHash: "unused",
          role,
        },
      })
      await issueSession(user)
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: user.id },
      })
      const auth = { user, sessionId: session.id }
      if (role !== Role.SUPERADMIN) {
        await assert.rejects(
          listErrorLogs(auth),
          (error: unknown) =>
            error instanceof HttpError && error.status === 403,
        )
        continue
      }
      const result = await listErrorLogs(auth)
      assert.equal(result.scope, "instance")
      assert.equal(result.durable, false)
      assert.ok(!JSON.stringify(result).includes("diagnosticCode"))
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      })
      await assert.rejects(
        listErrorLogs(auth),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      )
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.SUPERADMIN, isActive: false },
      })
      await assert.rejects(
        listErrorLogs(auth),
        (error: unknown) => error instanceof HttpError && error.status === 401,
      )
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { accountDeletedAt: new Date() },
      })
      await assert.rejects(
        listErrorLogs(auth),
        (error: unknown) => error instanceof HttpError && error.status === 401,
      )
      await prisma.user.update({
        where: { id: user.id },
        data: { accountDeletedAt: null },
      })
      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(0) },
      })
      await assert.rejects(
        listErrorLogs(auth),
        (error: unknown) => error instanceof HttpError && error.status === 401,
      )
      await prisma.session.delete({ where: { id: session.id } })
      await assert.rejects(
        listErrorLogs(auth),
        (error: unknown) => error instanceof HttpError && error.status === 401,
      )
    }
    const actor = await prisma.user.create({
      data: {
        id: "verified-error-actor",
        email: "verified@example.test",
        fullName: "Private",
        passwordHash: "unused",
        role: Role.SUPERADMIN,
      },
    })
    const issued = await issueSession(actor)
    const app = express()
    app.use(errorLogs.middleware)
    app.get("/api/users/failure", requireAuth, () => {
      throw new Error("private message")
    })
    app.use(handleError)
    const verifiedServer = await listen(app)
    t.after(() => closeServer(verifiedServer.server))
    t.mock.method(console, "error", () => {})
    const failed = await fetch(`${verifiedServer.origin}/api/users/failure`, {
      headers: { Authorization: `Bearer ${issued.token}` },
    })
    assert.equal(failed.status, 500)
    assert.equal(errorLogs.store.read()[0].actorId, actor.id)
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: actor.id },
    })
    await db.exec('ALTER TABLE "Session" RENAME TO "ErrorLogTestSession"')
    try {
      await assert.rejects(
        listErrorLogs({ user: actor, sessionId: session.id }),
        (error: unknown) =>
          error instanceof HttpError &&
          error.status === 503 &&
          error.message === "Error logs unavailable",
      )
    } finally {
      await db.exec('ALTER TABLE "ErrorLogTestSession" RENAME TO "Session"')
    }
    const { server, origin } = await listen(createApp())
    t.after(() => closeServer(server))
    for (const path of [
      "/api/system-logs/management-history",
      "/api/system-logs/errors",
    ]) {
      const response = await fetch(origin + path)
      assert.equal(response.status, 404)
      assert.equal(response.headers.get("cache-control"), "no-store")
    }
  },
)
