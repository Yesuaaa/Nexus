import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { getPrisma } from "../../../src/lib/db.js"
import { closeServer, listen } from "../../support/pglite-app.js"

// Opt-in only. Provision a freshly migrated, dedicated loopback database named
// nexus_pg008_attendance and use its pg008_attendance_test owner credentials.
test(
  "[PG-008-F001-A025-T001] PostgreSQL serializes competing attendance assignments",
  { timeout: 60_000 },
  async (t) => {
    const databaseUrl = process.env.PG008_POSTGRES_URL
    if (!databaseUrl) {
      t.skip(
        "PG008_POSTGRES_URL is unset; disposable PostgreSQL is unavailable",
      )
      return
    }

    const url = new URL(databaseUrl)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/nexus_pg008_attendance")
    assert.equal(url.username, "pg008_attendance_test")
    assert(url.port, "Use an explicit loopback PostgreSQL port")
    url.searchParams.set("sslmode", "disable")
    const connectionString = url.toString()
    const appName = `pg008-${randomUUID().slice(0, 8)}`
    const control = new pg.Client({ connectionString })
    const observer = new pg.Client({ connectionString })
    await control.connect()
    await observer.connect()

    let gatesInstalled = false
    const advisoryKey = 760008001
    t.after(async () => {
      try {
        await control.query("SELECT pg_advisory_unlock_all()")
        if (gatesInstalled)
          await control.query(`
            DROP TRIGGER IF EXISTS pg008_assignment_pause ON "AttendancePolicyAssignment";
            DROP FUNCTION IF EXISTS pg008_assignment_pause();
            DROP TABLE IF EXISTS pg008_assignment_gate;
          `)
      } finally {
        await observer.end()
        await control.end()
      }
    })

    const identity = (
      await observer.query<{
        database: string
        role: string
        address: string
        isolation: string
        users: number
        employees: number
        policies: number
        assignments: number
        audits: number
        policyTable: string | null
      }>(`
        SELECT current_database() AS database,
          current_user AS role,
          host(inet_server_addr()) AS address,
          current_setting('default_transaction_isolation') AS isolation,
          (SELECT count(*)::int FROM "User") AS users,
          (SELECT count(*)::int FROM "Employee") AS employees,
          (SELECT count(*)::int FROM "AttendancePolicy") AS policies,
          (SELECT count(*)::int FROM "AttendancePolicyAssignment") AS assignments,
          (SELECT count(*)::int FROM "AttendanceAudit") AS audits,
          to_regclass('public."AttendancePolicy"')::text AS "policyTable"
      `)
    ).rows[0]
    assert.deepEqual(
      {
        database: identity.database,
        role: identity.role,
        address: identity.address,
      },
      {
        database: "nexus_pg008_attendance",
        role: "pg008_attendance_test",
        address: "127.0.0.1",
      },
    )
    assert.equal(identity.policyTable, '"AttendancePolicy"')
    assert.equal(identity.isolation, "read committed")
    assert.deepEqual(
      [
        identity.users,
        identity.employees,
        identity.policies,
        identity.assignments,
        identity.audits,
      ],
      [0, 0, 0, 0, 0],
      "Use only a fresh, dedicated disposable database",
    )

    const originalEnvironment = {
      databaseUrl: process.env.DATABASE_URL,
      directUrl: process.env.DIRECT_URL,
      poolMax: process.env.DATABASE_POOL_MAX,
      jwtSecret: process.env.JWT_SECRET,
    }
    const applicationUrl = new URL(connectionString)
    applicationUrl.searchParams.set("application_name", appName)
    process.env.DATABASE_URL = applicationUrl.toString()
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const { server, origin } = await listen(
      createApp({
        attendanceClock: () => new Date("2026-11-13T08:00:00.000Z"),
      }),
    )
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
      if (originalEnvironment.databaseUrl === undefined)
        delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalEnvironment.databaseUrl
      if (originalEnvironment.directUrl === undefined)
        delete process.env.DIRECT_URL
      else process.env.DIRECT_URL = originalEnvironment.directUrl
      if (originalEnvironment.poolMax === undefined)
        delete process.env.DATABASE_POOL_MAX
      else process.env.DATABASE_POOL_MAX = originalEnvironment.poolMax
      if (originalEnvironment.jwtSecret === undefined)
        delete process.env.JWT_SECRET
      else process.env.JWT_SECRET = originalEnvironment.jwtSecret
    })

    const admin = await prisma.user.create({
      data: {
        role: "ADMIN",
        email: `${randomUUID()}@pg008.test`,
        fullName: "Synthetic PG-008 manager",
        passwordHash: "synthetic-test-only",
      },
    })
    const superadmin = await prisma.user.create({
      data: {
        role: "SUPERADMIN",
        email: `${randomUUID()}@pg008.test`,
        fullName: "Synthetic PG-008 reviewer",
        passwordHash: "synthetic-test-only",
      },
    })
    const adminSession = await issueSession(admin)
    const superadminSession = await issueSession(superadmin)
    const employee = await prisma.employee.create({
      data: {
        employeeId: `PG008-${randomUUID()}`,
        fullName: "Synthetic concurrent assignment employee",
      },
    })
    const policies = await Promise.all(
      ["First competing policy", "Second competing policy"].map((name) =>
        prisma.attendancePolicy.create({
          data: {
            name,
            timeZone: "UTC",
            days: {
              create: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: true,
                requiredMinutes: 480,
              })),
            },
          },
        }),
      ),
    )

    await control.query(`
      CREATE TABLE pg008_assignment_gate (employee_id text PRIMARY KEY);
      CREATE FUNCTION pg008_assignment_pause() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg008_assignment_gate WHERE employee_id = NEW."employeeId"
        ) THEN
          PERFORM pg_advisory_xact_lock(${advisoryKey});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER pg008_assignment_pause
        BEFORE INSERT ON "AttendancePolicyAssignment"
        FOR EACH ROW EXECUTE FUNCTION pg008_assignment_pause();
    `)
    await control.query(
      "INSERT INTO pg008_assignment_gate (employee_id) VALUES ($1)",
      [employee.id],
    )
    gatesInstalled = true

    const controlPid = (
      await control.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0].pid
    await control.query("SELECT pg_advisory_lock($1)", [advisoryKey])

    type Result = { status: number; body: string; trace: string | null }
    async function assign(token: string, policyId: string): Promise<Result> {
      const response = await fetch(`${origin}/api/attendance/assignments`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employeeId: employee.id,
          policyId,
          effectiveFrom: "2026-11-16",
        }),
      })
      return {
        status: response.status,
        body: await response.text(),
        trace: response.headers.get("x-correlation-id"),
      }
    }

    async function waitForBlockedRequest(blocker: number) {
      const deadline = Date.now() + 5_000
      do {
        const result = await observer.query<{ pid: number; query: string }>(
          `SELECT pid, query FROM pg_stat_activity
           WHERE application_name = $1
             AND wait_event_type = 'Lock'
             AND $2 = ANY(pg_blocking_pids(pid))`,
          [appName, blocker],
        )
        if (result.rows.length) return result.rows[0]
        await delay(10)
      } while (Date.now() < deadline)
      throw new Error(
        `Expected a PostgreSQL lock waiter behind backend ${blocker}`,
      )
    }

    const pending: Promise<Result>[] = []
    let firstPid: number
    let secondPid: number
    try {
      pending.push(assign(adminSession.token, policies[0].id))
      firstPid = (await waitForBlockedRequest(controlPid)).pid
      assert.notEqual(firstPid, controlPid)
      pending.push(assign(superadminSession.token, policies[1].id))
      const secondWaiter = await waitForBlockedRequest(firstPid)
      secondPid = secondWaiter.pid
      assert.match(secondWaiter.query, /"Employee".*FOR UPDATE/s)
      assert.equal(new Set([controlPid, firstPid, secondPid]).size, 3)
    } finally {
      await control.query("SELECT pg_advisory_unlock($1)", [advisoryKey])
    }

    const results = await Promise.all(pending)
    assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409])
    assert.ok(
      results.every(({ trace }) => trace),
      "Both API responses carry trace IDs",
    )
    const conflict = results.find(({ status }) => status === 409)
    assert.ok(conflict)
    assert.match(
      conflict.body,
      /An assignment already starts on or after that date/,
    )

    const persisted = await prisma.attendancePolicyAssignment.findMany({
      where: { employeeId: employee.id, cancelledAt: null },
      orderBy: { effectiveFrom: "asc" },
    })
    assert.equal(persisted.length, 1)
    assert.equal(
      persisted[0].effectiveFrom.toISOString().slice(0, 10),
      "2026-11-16",
    )
    const auditRows = await prisma.attendanceAudit.findMany({
      where: {
        entityType: "AttendancePolicyAssignment",
        employeeId: employee.id,
      },
    })
    assert.equal(auditRows.length, 1)
    assert.equal(auditRows[0].action, "INSERT")
    t.diagnostic(
      JSON.stringify({
        database: identity.database,
        isolation: identity.isolation,
        controlPid,
        firstPid,
        secondPid,
        requestStatuses: results.map(({ status }) => status),
        persistedAssignments: persisted.length,
        assignmentAuditRows: auditRows.length,
      }),
    )
  },
)
