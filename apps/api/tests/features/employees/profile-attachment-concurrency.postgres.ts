import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { getPrisma } from "../../../src/lib/db.js"
import { closeServer, listen } from "../../support/pglite-app.js"

test(
  "PG-023-F023-A002-T032 attaches exactly one profile under PostgreSQL contention",
  { timeout: 120_000 },
  async (t) => {
    assert(process.env.PG023_POSTGRES_URL)
    const url = new URL(process.env.PG023_POSTGRES_URL)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/nexus_pg023_attach")
    assert(url.port)
    url.search = "?sslmode=disable"
    const connectionString = url.toString()
    const control = new pg.Client({ connectionString })
    const observer = new pg.Client({ connectionString })
    await control.connect()
    t.after(() => control.end())
    await observer.connect()
    t.after(() => observer.end())
    const initial = await observer.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM "User"',
    )
    assert.equal(initial.rows[0].count, 0, "Use a fresh disposable database")
    const appName = `pg023-attach-${randomUUID()}`
    process.env.DATABASE_URL = `${connectionString}&application_name=${appName}`
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const { server, origin } = await listen(createApp())
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
    })
    const actors = []
    for (const role of ["ADMIN", "SUPERADMIN", "STAFF"] as const) {
      const user = await prisma.user.create({
        data: {
          role,
          email: `${role.toLowerCase()}@pg023.test`,
          fullName: role,
          passwordHash: "synthetic",
        },
      })
      actors.push(await issueSession(user))
    }
    const [admin, root, staff] = actors
    const targetId = staff.user.id
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
    })
    const sessions = () =>
      prisma.session.findMany({
        where: { userId: targetId },
        orderBy: { id: "asc" },
      })
    const beforeSessions = await sessions()
    const department = await prisma.department.create({
      data: { name: "PG023 Contention" },
    })
    const passwordHash = target.passwordHash
    await control.query("BEGIN")
    const operations: Promise<{ actor: string; status: number }>[] = []
    try {
      await control.query('LOCK TABLE "Employee" IN SHARE MODE')
      const owner = await control.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      )
      for (const [index, actor] of [admin, root].entries()) {
        operations.push(
          fetch(`${origin}/api/employees/accounts/${targetId}/profile`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${actor.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              employeeId: `EXP-CONTEND-${index}`,
              fullName: "Contention Employee",
              email: target.email,
              contactNumber: "09123456789",
              position: "Engineer",
              employmentType: "FULL_TIME",
              startDate: "2026-01-15T00:00:00.000Z",
              departmentId: department.id,
              teamId: null,
            }),
          }).then(async (response) => {
            await response.text()
            return { actor: actor.user.id, status: response.status }
          }),
        )
      }
      let blocked: number[] = []
      for (let attempt = 0; attempt < 100 && blocked.length < 2; attempt++) {
        const result = await observer.query<{ pid: number }>(
          "WITH RECURSIVE blocked(pid) AS (SELECT $2::int UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid)) WHERE a.application_name = $1) SELECT pid FROM blocked WHERE pid <> $2",
          [appName, owner.rows[0].pid],
        )
        blocked = result.rows.map(({ pid }) => pid)
        if (blocked.length < 2) await delay(50)
      }
      assert.equal(
        new Set(blocked).size,
        2,
        "Both independent writers must reach the gate",
      )
      t.diagnostic(
        `Observed concurrent PostgreSQL backends: ${blocked.join(", ")}`,
      )
    } finally {
      await control.query("ROLLBACK")
      await Promise.allSettled(operations)
    }
    const results = await Promise.all(operations)
    assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409])
    assert.equal(await prisma.employee.count(), 1)
    assert.equal(await prisma.user.count(), 3)
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { userId: targetId },
    })
    const history = await prisma.workforceManagementChange.findMany({
      where: { subjectId: employee.id, action: "CREATED" },
    })
    assert.equal(history.length, 1)
    assert.equal(
      history[0].actorAccountId,
      results.find(({ status }) => status === 201)?.actor,
    )
    assert.equal(
      await prisma.accountManagementChange.count({
        where: { subjectAccountId: targetId },
      }),
      0,
    )
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
    })
    assert.equal(after.role, target.role)
    assert.equal(after.passwordHash, passwordHash)
    assert.equal(after.isActive, target.isActive)
    assert.deepEqual(await sessions(), beforeSessions)
  },
)
