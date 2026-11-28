import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../src/app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { getPrisma } from "../../src/lib/db.js"
import { closeServer, listen } from "../support/pglite-app.js"

test(
  "PG-028-F025-A001-T025 concurrent service replay converges under PostgreSQL row locking",
  { timeout: 120_000 },
  async (t) => {
    assert.ok(
      process.env.PG028_POSTGRES_URL,
      "Use a fresh task-owned PostgreSQL target",
    )
    const url = new URL(process.env.PG028_POSTGRES_URL)
    assert.ok(
      url.protocol === "postgresql:" &&
        url.hostname === "127.0.0.1" &&
        url.pathname === "/nexus_pg028_replay" &&
        url.port,
    )
    url.search = "?sslmode=disable"
    const control = new pg.Client({ connectionString: url.toString() })
    const observer = new pg.Client({ connectionString: url.toString() })
    await control.connect()
    t.after(() => control.end())
    await observer.connect()
    t.after(() => observer.end())
    const ready = await observer.query<{ version: string; users: number }>(
      "SELECT current_setting('server_version') AS version, (SELECT count(*)::int FROM \"User\") AS users",
    )
    assert.equal(ready.rows[0].users, 0)
    t.diagnostic("PostgreSQL " + ready.rows[0].version)
    const appName = "pg028-replay-" + randomUUID()
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
    const actor = await prisma.user.create({
      data: {
        email: "pg028-client@example.test",
        role: "USER",
        passwordHash: "fixture",
      },
    })
    const head = await prisma.user.create({
      data: {
        email: "pg028-head@example.test",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const department = await prisma.department.create({
      data: { name: "Concurrent fixture", headId: head.id },
    })
    const unrelated = await prisma.department.create({
      data: { name: "Unrelated fixture" },
    })
    const thread = await prisma.requestConversation.create({
      data: { clientId: actor.id, departmentId: department.id },
    })
    const sibling = await prisma.requestConversation.create({
      data: { clientId: actor.id, departmentId: unrelated.id },
    })
    const service = await prisma.service.create({
      data: { name: "Synthetic service", description: "PG028" },
    })
    const booking = await prisma.serviceRequest.create({
      data: {
        clientId: actor.id,
        serviceId: service.id,
        title: "Replay booking",
        acceptedDepartmentId: department.id,
        status: "UNDER_REVIEW",
        conversationId: thread.id,
      },
    })
    const before = await prisma.requestConversation.findUnique({
      where: { id: sibling.id },
      include: { messages: true, bookings: true },
    })
    const { token } = await issueSession(actor)
    const input = {
      body: "Concurrent synthetic replay",
      bookingId: booking.id,
      clientMessageId: randomUUID(),
    }
    async function send() {
      const response = await fetch(
        origin + "/api/request-conversations/" + thread.id + "/messages",
        {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        },
      )
      const data = (await response.json()) as { message?: { id: string } }
      return { status: response.status, id: data.message?.id }
    }
    let waiters: number[] = []
    const pending: ReturnType<typeof send>[] = []
    await control.query("BEGIN")
    try {
      await control.query(
        'SELECT id FROM "RequestConversation" WHERE id = $1 FOR UPDATE',
        [thread.id],
      )
      const owner = await control.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      )
      pending.push(send(), send())
      for (const operation of pending) void operation.catch(() => {})
      for (let attempt = 0; attempt < 80 && waiters.length < 2; attempt++) {
        const result = await observer.query<{ pid: number }>(
          `
        WITH RECURSIVE blockers AS (
          SELECT pid FROM pg_stat_activity WHERE pid = $1
          UNION
          SELECT a.pid FROM pg_stat_activity a
          JOIN blockers b ON b.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT a.pid FROM pg_stat_activity a JOIN blockers USING (pid)
        WHERE a.application_name = $2 AND a.wait_event_type = 'Lock'
          AND a.query LIKE '%RequestConversation%FOR UPDATE%'
      `,
          [owner.rows[0].pid, appName],
        )
        waiters = result.rows.map((row) => row.pid)
        if (waiters.length < 2) await delay(40)
      }
    } finally {
      await control.query("ROLLBACK")
    }
    const settled = await Promise.allSettled(pending)
    const responses = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    )
    const rows = await prisma.serviceRequestMessage.findMany({
      where: { conversationId: thread.id },
    })
    const after = await prisma.requestConversation.findUnique({
      where: { id: sibling.id },
      include: { messages: true, bookings: true },
    })
    t.diagnostic(
      `Independent replay backends: ${new Set(waiters).size}; response statuses: ${responses.map((response) => response.status).join(", ")}; persisted rows: ${rows.length}`,
    )
    await t.test("independent persisted state", () => {
      assert.equal(rows.length, 1)
      assert.deepEqual(
        {
          body: rows[0].body,
          clientMessageId: rows[0].clientMessageId,
          requestId: rows[0].requestId,
          senderId: rows[0].senderId,
        },
        {
          body: input.body,
          clientMessageId: input.clientMessageId,
          requestId: booking.id,
          senderId: actor.id,
        },
      )
      assert.deepEqual(after, before)
    })
    await t.test("overlap and matching acknowledgments", () => {
      assert.equal(new Set(waiters).size, 2)
      assert.deepEqual(
        responses.map((response) => response.status),
        [201, 201],
      )
      assert.deepEqual(
        responses.map((response) => response.id),
        [rows[0]?.id, rows[0]?.id],
      )
    })
  },
)
