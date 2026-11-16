import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  errorLogs,
  type ErrorRecord,
} from "../../../src/features/error-logs/error-log.js"
import { Role } from "../../../src/generated/prisma/client.js"
import { createApp } from "../../../src/app.js"
import { listen, closeServer } from "../../support/pglite-app.js"

test(
  "offline error API filters retained records before truncation and enforces live Superadmin sessions",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startSystemLogsApp(t)
    const now = Date.now()
    function seed(moduleId: ErrorRecord["moduleId"], age = 0) {
      const errorId = randomUUID()
      errorLogs.store.append({
        record: {
          schemaVersion: 1,
          errorId,
          occurredAt: new Date(now - age).toISOString(),
          category: "application",
          severity: "error",
          moduleId,
          operation: "http.request",
          code: "API_FAILURE",
          message: "Application request failed",
          method: "GET",
          routeTemplate: "/api/users/:id",
          status: 500,
          requestId: randomUUID(),
          actorId: null,
        },
        diagnosticCode: "P1001",
        retryable: false,
      })
      return errorId
    }
    const target = seed("people-hr", 5000)
    for (let i = 0; i < 105; i++) seed("administration")
    seed("platform", 86400001)
    async function request(query = "", token = "", method = "GET") {
      const response = await fetch(`${base}/errors${query}`, {
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
          id: `error-api-${role}`,
          email: `${role}@error.test`,
          fullName: "Private",
          passwordHash: "private-secret",
          role,
        },
      })
      const issued = await issueSession(user)
      if (role !== Role.SUPERADMIN) {
        assert.equal(
          (await request("?moduleId=invalid", issued.token)).status,
          403,
        )
        continue
      }
      token = issued.token
      actorId = user.id
      sessionId = (
        await prisma.session.findFirstOrThrow({ where: { userId: user.id } })
      ).id
    }
    const page = (await (await request("", token)).json()) as {
      events: ErrorRecord[]
      returnedCount: number
      matchedRetainedCount: number
      truncated: boolean
      expiredCount: number
    }
    assert.equal(page.returnedCount, 100)
    assert.equal(page.matchedRetainedCount, 106)
    assert.equal(page.truncated, true)
    assert.equal(page.expiredCount, 1)
    const selected = (await (
      await request(
        "?moduleId=people-hr&category=application&severity=error&status=500",
        token,
      )
    ).json()) as typeof page
    assert.deepEqual(
      selected.events.map((e) => e.errorId),
      [target],
    )
    assert.equal(selected.truncated, false)
    assert.ok(
      !/diagnosticCode|retryable|private-secret|passwordHash|stack/.test(
        JSON.stringify(selected),
      ),
    )
    for (const query of [
      "?moduleId=nope",
      "?category=nope",
      "?severity=warn",
      "?status=999",
      "?status=500&status=503",
      "?body=secret",
      "?from=invalid",
      `?from=${new Date(now).toISOString()}&to=${new Date(now - 1000).toISOString()}`,
    ])
      assert.equal((await request(query, token)).status, 400)
    const expired = (await (
      await request(
        `?from=${new Date(now - 172800000).toISOString()}&to=${new Date(now - 90000000).toISOString()}`,
        token,
      )
    ).json()) as { windowExpired: boolean; events: unknown[] }
    assert.equal(expired.windowExpired, true)
    assert.equal(expired.events.length, 0)
    const unavailableRead = t.mock.method(errorLogs.store, "read", () => {
      throw new Error("private-storage-sentinel")
    })
    const unavailableResponse = await request("", token)
    assert.equal(unavailableResponse.status, 503)
    assert.deepEqual(await unavailableResponse.json(), {
      error: "Error logs unavailable",
    })
    unavailableRead.mock.restore()
    const head = await request("", token, "HEAD")
    assert.equal(head.status, 200)
    assert.equal(await head.text(), "")
    await prisma.user.update({
      where: { id: actorId },
      data: { role: Role.ADMIN },
    })
    assert.equal((await request("", token)).status, 403)
    await prisma.user.update({
      where: { id: actorId },
      data: { role: Role.SUPERADMIN, isActive: false },
    })
    assert.equal((await request("", token)).status, 401)
    await prisma.user.update({
      where: { id: actorId },
      data: { isActive: true, accountDeletedAt: new Date() },
    })
    assert.equal((await request("", token)).status, 401)
    await prisma.user.update({
      where: { id: actorId },
      data: { accountDeletedAt: null },
    })
    await db.exec('ALTER TABLE "Session" RENAME TO "ErrorApiSessions"')
    try {
      assert.equal((await request("", token)).status, 500)
    } finally {
      await db.exec('ALTER TABLE "ErrorApiSessions" RENAME TO "Session"')
    }
    await prisma.session.delete({ where: { id: sessionId } })
    assert.equal((await request("", token)).status, 401)
    const closed = await listen(createApp())
    t.after(() => closeServer(closed.server))
    for (const environment of ["test", "production"]) {
      const prior = process.env.NODE_ENV
      try {
        process.env.NODE_ENV = environment
        assert.equal(
          (
            await fetch(`${closed.origin}/api/system-logs/errors`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          ).status,
          404,
        )
      } finally {
        process.env.NODE_ENV = prior
      }
    }
  },
)
