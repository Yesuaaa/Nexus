import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { disconnectPrisma, getPrisma } from "../../../src/lib/db.js"
import { closeServer, listen } from "../../support/pglite-app.js"

test(
  "PG-021-F001-A026-T001 competing PostgreSQL Head claims",
  { timeout: 60_000 },
  async (t) => {
    const target = process.env.PG021_POSTGRES_URL
    assert(target, "Use the disposable PG-021 PostgreSQL database")
    const url = new URL(target)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/nexus_pg021")
    assert(url.port)
    url.search = "?sslmode=disable&application_name=nexus-pg021"
    const connectionString = url.toString()
    const control = new pg.Client({ connectionString })
    await control.connect()
    t.after(() => control.end())
    const {
      rows: [environment],
    } = await control.query<{
      users: number
      migrations: number
      version: string
    }>(
      'SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations, version()',
    )
    assert.equal(environment.users, 0)
    assert(environment.migrations > 0)
    t.diagnostic(
      `${environment.version}; ${environment.migrations} applied migrations`,
    )
    process.env.DATABASE_URL = connectionString
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    t.after(disconnectPrisma)
    const actorA = await prisma.user.create({
      data: { email: "a@example.test", role: "ADMIN", passwordHash: "fixture" },
    })
    const actorB = await prisma.user.create({
      data: { email: "b@example.test", role: "ADMIN", passwordHash: "fixture" },
    })
    const staff = await prisma.user.create({
      data: {
        email: "head@example.test",
        role: "STAFF",
        passwordHash: "fixture",
        position: "Engineer",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        userId: staff.id,
        employeeId: "PG021",
        fullName: "QA candidate",
        email: staff.email,
        position: "Engineer",
        status: "ACTIVE",
      },
    })
    const a = await prisma.department.create({ data: { name: "PG021 A" } })
    const b = await prisma.department.create({ data: { name: "PG021 B" } })
    const { server, origin } = await listen(createApp())
    t.after(() => closeServer(server))
    const sessions = await Promise.all([
      issueSession(actorA),
      issueSession(actorB),
    ])
    const claim = (departmentId: string, token: string) =>
      fetch(`${origin}/api/departments/${departmentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ headId: staff.id }),
      })
    await control.query(`
    CREATE FUNCTION pg021_hold_head_change() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.name = 'PG021 A' AND NEW."headId" IS DISTINCT FROM OLD."headId" THEN
        PERFORM pg_advisory_xact_lock(210026);
      END IF;
      RETURN NEW;
    END
    $$;
    CREATE TRIGGER pg021_hold_head_change
    AFTER UPDATE ON "Department" FOR EACH ROW EXECUTE FUNCTION pg021_hold_head_change();
  `)
    const waitFor = async (condition: () => Promise<boolean>) => {
      const until = Date.now() + 4000
      while (!(await condition())) {
        assert(
          Date.now() < until,
          "Expected database contention was not observed",
        )
        await delay(20)
      }
    }
    await control.query("SELECT pg_advisory_lock(210026)")
    let firstPid: number | undefined
    let secondPid: number | undefined
    const first = claim(a.id, sessions[0].token)
    let second: Promise<Response> | undefined
    try {
      await waitFor(async () => {
        firstPid = (
          await control.query<{ pid: number }>(`
        SELECT pid FROM pg_stat_activity
        WHERE application_name = 'nexus-pg021' AND wait_event = 'advisory'
      `)
        ).rows[0]?.pid
        return firstPid !== undefined
      })
      second = claim(b.id, sessions[1].token)
      await waitFor(async () => {
        secondPid = (
          await control.query<{ pid: number }>(
            `
        SELECT pid FROM pg_stat_activity
        WHERE application_name = 'nexus-pg021' AND $1 = ANY(pg_blocking_pids(pid))
      `,
            [firstPid],
          )
        ).rows[0]?.pid
        return secondPid !== undefined
      })
      assert.notEqual(firstPid, secondPid)
      t.diagnostic(
        "Two independent database backends overlapped at the candidate row lock",
      )
    } finally {
      await control.query("SELECT pg_advisory_unlock(210026)")
      await Promise.allSettled([first, second])
      await control.query(
        'DROP TRIGGER pg021_hold_head_change ON "Department"; DROP FUNCTION pg021_hold_head_change()',
      )
    }
    assert(second)
    const responses = await Promise.all([first, second])
    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1,
    )
    assert(
      responses.some(
        (response) => response.status === 400 || response.status === 409,
      ),
    )
    for (const response of responses) await response.json()
    const claimed = await prisma.department.findMany({
      where: { headId: staff.id },
    })
    assert.equal(claimed.length, 1)
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: staff.id },
    })
    const placed = await prisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
    })
    assert.equal(user.departmentId, claimed[0].id)
    assert.equal(placed.departmentId, claimed[0].id)
    assert.equal(user.teamId, null)
    assert.equal(placed.teamId, null)
    assert.equal(user.position, "Engineer")
    assert.equal(placed.position, "Engineer")
    const history = await prisma.workforceManagementChange.findMany()
    assert.equal(new Set(history.map((change) => change.operationId)).size, 1)
    const winner = claimed[0].id === a.id ? actorA.id : actorB.id
    assert(
      history.some(
        (change) =>
          change.subjectId === claimed[0].id &&
          change.changedFields.includes("headId"),
      ),
    )
    assert(history.every((change) => change.actorAccountId === winner))
  },
)
