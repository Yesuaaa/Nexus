import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../src/app.js"
import { issueSession, tokenHash } from "../src/features/auth/auth.service.js"
import { getPrisma } from "../src/lib/db.js"
import { closeServer, listen } from "./support/pglite-app.js"

test(
  "PG-026-F017-A001-T017 refresh claims overlap across PostgreSQL connections",
  { timeout: 120_000 },
  async (t) => {
    assert.ok(
      process.env.PG026_POSTGRES_URL,
      "Use a task-owned disposable target",
    )
    const url = new URL(process.env.PG026_POSTGRES_URL)
    assert.ok(
      url.protocol === "postgresql:" &&
        url.hostname === "127.0.0.1" &&
        url.pathname === "/nexus_pg026_refresh" &&
        url.port,
      "Unexpected database target",
    )
    url.search = "?sslmode=disable"
    const control = new pg.Client({ connectionString: url.toString() })
    const observer = new pg.Client({ connectionString: url.toString() })
    await control.connect()
    t.after(() => control.end())
    await observer.connect()
    t.after(() => observer.end())
    const empty = await observer.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM "User"',
    )
    assert.equal(
      empty.rows[0].count,
      0,
      "Expected freshly migrated isolated database",
    )
    const provider = await observer.query<{ version: string }>(
      "SHOW server_version",
    )
    t.diagnostic("PostgreSQL " + provider.rows[0].version)
    const appName = "pg026-refresh-" + randomUUID()
    url.searchParams.set("application_name", appName)
    process.env.DATABASE_URL = url.toString()
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    process.env.SESSION_GEOLOCATION = "off"
    const prisma = getPrisma()!
    const { server, origin } = await listen(createApp())
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
    })
    const admin = await prisma.user.create({
      data: {
        email: "pg026-refresh@example.test",
        role: "ADMIN",
        passwordHash: "fixture",
      },
    })
    const unrelated = await prisma.user.create({
      data: {
        email: "pg026-unrelated@example.test",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const target = await issueSession(admin)
    await issueSession(unrelated)
    const unrelatedSnapshot = () =>
      prisma.session.findMany({
        where: { userId: unrelated.id },
        include: { refreshTokens: true },
      })
    const before = await unrelatedSnapshot()
    const current = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: tokenHash(target.refreshToken) },
    })
    const submit = async () => {
      const response = await fetch(origin + "/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: target.refreshToken }),
        signal: AbortSignal.timeout(45_000),
      })
      const body: unknown = await response.json()
      const token =
        body &&
        typeof body === "object" &&
        "token" in body &&
        typeof body.token === "string"
          ? body.token
          : null
      return { status: response.status, token }
    }
    const operations: ReturnType<typeof submit>[] = []
    let waiters: number[] = []
    await control.query("BEGIN")
    try {
      await control.query('SELECT id FROM "Session" WHERE id = $1 FOR UPDATE', [
        current.id,
      ])
      const owner = await control.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      )
      operations.push(submit(), submit())
      for (const operation of operations) void operation.catch(() => undefined)
      for (let i = 0; i < 100 && waiters.length < 2; i++) {
        const blocked = await observer.query<{ pid: number }>(
          `
        WITH RECURSIVE chain AS (
          SELECT pid FROM pg_stat_activity WHERE pid=$1
          UNION
          SELECT activity.pid FROM pg_stat_activity AS activity
          JOIN chain ON chain.pid = ANY(pg_blocking_pids(activity.pid))
        )
        SELECT activity.pid FROM pg_stat_activity AS activity
        JOIN chain USING (pid)
        WHERE application_name=$2 AND wait_event_type='Lock' AND query ILIKE '%UPDATE%Session%'
      `,
          [owner.rows[0].pid, appName],
        )
        waiters = blocked.rows.map((row) => row.pid)
        if (waiters.length < 2) await delay(50)
      }
    } finally {
      await control.query("ROLLBACK")
    }
    const settled = await Promise.allSettled(operations)
    const responses = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    )
    const surviving = await prisma.session.count({
      where: { userId: admin.id },
    })
    const refreshRows = await prisma.refreshToken.count({
      where: { sessionId: current.id },
    })
    const after = await unrelatedSnapshot()
    const winner = responses.find((response) => response.status === 200)
    const postCheck = winner?.token
      ? (
          await fetch(origin + "/api/auth/me", {
            headers: { Authorization: "Bearer " + winner.token },
          })
        ).status
      : null
    t.diagnostic(
      JSON.stringify({
        distinctBlockedBackends: new Set(waiters).size,
        statuses: responses.map((response) => response.status),
        surviving,
        refreshRows,
        unrelatedPreserved: JSON.stringify(after) === JSON.stringify(before),
        postCheck,
      }),
    )
    assert.equal(new Set(waiters).size, 2)
    assert.equal(responses.length, 2)
    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1,
    )
    assert.ok(
      responses.every(
        (response) => response.status === 200 || response.status === 401,
      ),
      "Expected one rotation and one invalidated reuse",
    )
    assert.equal(surviving, 0)
    assert.equal(refreshRows, 0)
    assert.ok(
      JSON.stringify(after) === JSON.stringify(before),
      "Unrelated family changed",
    )
    assert.equal(postCheck, 401)
  },
)
