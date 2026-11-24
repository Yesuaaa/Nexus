import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { getPrisma } from "../../../src/lib/db.js"
import { closeServer, listen } from "../../support/pglite-app.js"

// Opt in by naming this test file with a freshly migrated, disposable database.
test(
  "[PG-010-F001-A021-T032] competing correction decisions serialize in PostgreSQL",
  { timeout: 120_000 },
  async (t) => {
    const suppliedUrl = process.env.PG010_POSTGRES_URL
    assert(suppliedUrl, "Set PG010_POSTGRES_URL to a disposable local database")
    const parsed = new URL(suppliedUrl)
    assert.equal(parsed.protocol, "postgresql:")
    assert.equal(parsed.hostname, "127.0.0.1")
    assert.equal(parsed.pathname, "/nexus_pg010")
    assert(parsed.port)
    assert.equal(decodeURIComponent(parsed.username), "pg010_test")

    const appName = `pg010-${randomUUID().slice(0, 8)}`
    const connection = new URL(parsed)
    connection.search = ""
    connection.searchParams.set("sslmode", "disable")
    connection.searchParams.set("application_name", appName)
    const controlConnection = new URL(connection)
    controlConnection.searchParams.set("application_name", `${appName}-control`)
    const observerConnection = new URL(connection)
    observerConnection.searchParams.set(
      "application_name",
      `${appName}-observer`,
    )
    const control = new pg.Client({ connectionString: controlConnection.href })
    const observer = new pg.Client({
      connectionString: observerConnection.href,
    })
    await control.connect()
    await observer.connect()
    const oldDatabaseUrl = process.env.DATABASE_URL
    const oldDirectUrl = process.env.DIRECT_URL
    const oldPoolMax = process.env.DATABASE_POOL_MAX
    const oldJwtSecret = process.env.JWT_SECRET
    const httpServer: {
      value?: Awaited<ReturnType<typeof listen>>["server"]
    } = {}
    const advisoryKey = 760032
    const appBackendIds = new Set<number>()

    t.after(async () => {
      try {
        await control.query("SELECT pg_advisory_unlock_all()")
        await control.query(`
          DROP TRIGGER IF EXISTS pg010_pause_review ON "AttendanceAdjustment";
          DROP FUNCTION IF EXISTS pg010_pause_review();
          DROP TABLE IF EXISTS pg010_review_gate;
        `)
      } finally {
        if (httpServer.value) await closeServer(httpServer.value)
        await getPrisma()?.$disconnect()
        if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL
        else process.env.DATABASE_URL = oldDatabaseUrl
        if (oldDirectUrl === undefined) delete process.env.DIRECT_URL
        else process.env.DIRECT_URL = oldDirectUrl
        if (oldPoolMax === undefined) delete process.env.DATABASE_POOL_MAX
        else process.env.DATABASE_POOL_MAX = oldPoolMax
        if (oldJwtSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = oldJwtSecret
        await observer.end()
        await control.end()
      }
    })

    const initial = (
      await observer.query<{
        database: string
        users: number
        departments: number
        adjustments: number
        isolation: string
      }>(`
        SELECT current_database() AS database,
          (SELECT count(*)::int FROM "User") AS users,
          (SELECT count(*)::int FROM "Department") AS departments,
          (SELECT count(*)::int FROM "AttendanceAdjustment") AS adjustments,
          current_setting('default_transaction_isolation') AS isolation
      `)
    ).rows[0]
    assert.equal(initial.database, "nexus_pg010")
    assert.equal(initial.users, 0, "The database must be empty and disposable")
    assert.equal(initial.departments, 0)
    assert.equal(initial.adjustments, 0)
    assert.equal(initial.isolation, "read committed")
    const controlPid = (
      await control.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0].pid
    t.diagnostic(
      JSON.stringify({
        database: initial.database,
        isolation: initial.isolation,
      }),
    )

    process.env.DATABASE_URL = connection.href
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const department = await prisma.department.create({
      data: { name: `PG-010 concurrency ${randomUUID()}` },
    })

    async function account(role: Role, name: string) {
      const user = await prisma.user.create({
        data: {
          role,
          fullName: `Synthetic ${name}`,
          email: `${randomUUID()}@pg010.test`,
          passwordHash: "synthetic-test-only",
          ...(role === "STAFF" ? { departmentId: department.id } : {}),
        },
      })
      const employee =
        role === "STAFF"
          ? await prisma.employee.create({
              data: {
                employeeId: `PG010-${randomUUID()}`,
                fullName: `Synthetic ${name}`,
                userId: user.id,
                departmentId: department.id,
              },
            })
          : null
      return { user, employee, token: (await issueSession(user)).token }
    }

    const staff = await account("STAFF", "requester")
    const head = await account("STAFF", "head")
    const firstHr = await account("ADMIN", "first-reviewer")
    const secondHr = await account("ADMIN", "second-reviewer")
    assert(staff.employee)
    assert(head.employee)
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: `PG-010 concurrency policy ${randomUUID()}`,
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: staff.employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: staff.employee.id,
        startedAt: new Date("2026-11-23T09:00:00+08:00"),
        endedAt: new Date("2026-11-23T11:00:00+08:00"),
      },
    })

    const listening = await listen(
      createApp({
        attendanceClock: () => new Date("2026-11-24T12:00:00+08:00"),
      }),
    )
    httpServer.value = listening.server
    async function call(actor: { token: string }, path: string, body: object) {
      const response = await fetch(`${listening.origin}/api${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
      return { status: response.status, body: await response.text() }
    }

    const created = await call(staff, "/attendance/adjustments", {
      type: "CORRECTION",
      requestKey: randomUUID(),
      sessionId: session.id,
      startedAt: "2026-11-23T09:30:00+08:00",
      endedAt: "2026-11-23T11:30:00+08:00",
      reason: "Restore the verified synthetic work interval",
    })
    assert.equal(created.status, 201, created.body)
    const requestId = (
      JSON.parse(created.body) as { adjustment: { id: string } }
    ).adjustment.id
    const verified = await call(
      head,
      `/attendance/adjustments/${requestId}/review`,
      { decision: "APPROVED", note: "Verify the synthetic correction" },
    )
    assert.equal(verified.status, 200, verified.body)
    assert.equal(
      (
        await prisma.attendanceAdjustment.findUniqueOrThrow({
          where: { id: requestId },
        })
      ).status,
      "VERIFIED",
    )
    assert.deepEqual(
      await prisma.attendanceWorkSession.findUniqueOrThrow({
        where: { id: session.id },
      }),
      session,
    )

    await control.query(`
      CREATE TABLE pg010_review_gate (target text PRIMARY KEY);
      CREATE FUNCTION pg010_pause_review() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id IN (SELECT target FROM pg010_review_gate)
          AND NEW.status::text IN ('APPROVED', 'REJECTED') THEN
          PERFORM pg_advisory_xact_lock(${advisoryKey});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER pg010_pause_review
      BEFORE UPDATE ON "AttendanceAdjustment"
      FOR EACH ROW EXECUTE FUNCTION pg010_pause_review();
    `)
    await control.query("INSERT INTO pg010_review_gate(target) VALUES ($1)", [
      requestId,
    ])
    await control.query("SELECT pg_advisory_lock($1)", [advisoryKey])

    async function blockedPid(
      blocker: number,
      ignore: ReadonlySet<number> = new Set(),
    ) {
      const deadline = Date.now() + 2_500
      let observed: {
        pid: number
        application_name: string
        wait_event: string | null
        query: string
      }[]
      do {
        const rows = await observer.query<{
          pid: number
          application_name: string
          wait_event: string | null
          query: string
        }>(
          `SELECT pid, application_name, wait_event, query
           FROM pg_stat_activity
           WHERE datname = current_database() AND usename = current_user
             AND wait_event_type = 'Lock'
             AND $1 = ANY(pg_blocking_pids(pid))`,
          [blocker],
        )
        observed = rows.rows
        const waiter = observed.find(({ pid }) => !ignore.has(pid))
        if (waiter) {
          appBackendIds.add(waiter.pid)
          return waiter.pid
        }
        await delay(20)
      } while (Date.now() < deadline)
      throw new Error(
        `No PostgreSQL lock waiter found behind ${blocker}; observed ${JSON.stringify(observed)}`,
      )
    }

    const approvedDecision = call(
      firstHr,
      `/attendance/adjustments/${requestId}/review`,
      { decision: "APPROVED", note: "Finalize the verified correction" },
    )
    const firstPid = await blockedPid(controlPid)
    const rejectedDecision = call(
      secondHr,
      `/attendance/adjustments/${requestId}/review`,
      { decision: "REJECTED", note: "Competing rejection decision" },
    )
    const secondPid = await blockedPid(firstPid, new Set([firstPid]))
    appBackendIds.add(secondPid)
    assert.notEqual(secondPid, firstPid)
    await control.query("SELECT pg_advisory_unlock($1)", [advisoryKey])

    const [approved, rejected] = await Promise.all([
      approvedDecision,
      rejectedDecision,
    ])
    assert.equal(approved.status, 200, approved.body)
    assert.equal(rejected.status, 409, rejected.body)
    assert.equal(
      (JSON.parse(rejected.body) as { error: string }).error,
      "This request has already been reviewed",
    )

    const finalAdjustment = await prisma.attendanceAdjustment.findUniqueOrThrow(
      {
        where: { id: requestId },
      },
    )
    assert.equal(finalAdjustment.status, "APPROVED")
    assert.equal(finalAdjustment.reviewedById, firstHr.user.id)
    assert(finalAdjustment.reviewedAt)
    const finalSession = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: session.id },
    })
    assert.equal(
      finalSession.startedAt.toISOString(),
      "2026-11-23T01:30:00.000Z",
    )
    assert.equal(
      finalSession.endedAt?.toISOString(),
      "2026-11-23T03:30:00.000Z",
    )
    assert.equal(
      await prisma.attendanceWorkSession.count({
        where: { employeeId: staff.employee.id },
      }),
      1,
    )

    const audit = await prisma.attendanceAudit.findMany({
      where: { entityType: "AttendanceAdjustment", entityId: requestId },
      orderBy: { createdAt: "asc" },
    })
    assert.equal(audit.length, 3)
    assert.equal(audit.filter(({ action }) => action === "INSERT").length, 1)
    assert.equal(audit.filter(({ action }) => action === "UPDATE").length, 2)
    assert.equal(
      audit.filter(({ actorId }) => actorId === secondHr.user.id).length,
      0,
    )
    const notices = await prisma.workflowNotification.findMany({
      where: { attendanceAdjustmentId: requestId },
    })
    const notificationTypes = new Set(notices.map(({ type }) => type))
    assert(notificationTypes.has("ATTENDANCE_CORRECTION_PENDING"))
    assert(notificationTypes.has("ATTENDANCE_CORRECTION_VERIFIED"))
    assert(notificationTypes.has("ATTENDANCE_CORRECTION_APPROVED"))
    assert.equal(notificationTypes.has("ATTENDANCE_CORRECTION_REJECTED"), false)
    assert(
      notices.every(
        ({ attendanceAdjustmentId }) => attendanceAdjustmentId === requestId,
      ),
    )
    assert.equal(appBackendIds.size, 2)
  },
)
