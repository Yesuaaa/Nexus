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

test(
  "[PG-011-F001-A020-T003] competing leave decisions serialize in disposable PostgreSQL",
  { timeout: 120_000 },
  async (t) => {
    const suppliedUrl = process.env.PG011_POSTGRES_URL
    if (!suppliedUrl) {
      t.skip(
        "PG011_POSTGRES_URL is unset; disposable PostgreSQL is unavailable",
      )
      return
    }

    const supplied = new URL(suppliedUrl)
    assert.equal(supplied.protocol, "postgresql:")
    assert.equal(supplied.hostname, "127.0.0.1")
    assert.equal(supplied.pathname, "/nexus_pg011")
    assert.equal(decodeURIComponent(supplied.username), "pg011_test")
    assert(supplied.port, "Use the explicitly mapped local container port")

    const connection = new URL(supplied)
    connection.search = ""
    connection.searchParams.set("sslmode", "disable")
    const appName = `pg011-${randomUUID().slice(0, 8)}`
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
    const oldDatabaseUrl = process.env.DATABASE_URL
    const oldDirectUrl = process.env.DIRECT_URL
    const oldPoolMax = process.env.DATABASE_POOL_MAX
    const oldJwtSecret = process.env.JWT_SECRET
    const httpServer: { value?: Awaited<ReturnType<typeof listen>>["server"] } =
      {}
    const advisoryKey = 761_011
    const appBackendIds = new Set<number>()
    let controlConnected = false
    let observerConnected = false
    let triggerInstalled = false

    t.after(async () => {
      try {
        if (controlConnected) {
          await control.query("SELECT pg_advisory_unlock_all()")
          if (triggerInstalled)
            await control.query(`
              DROP TRIGGER IF EXISTS pg011_pause_leave_decision ON "LeaveRequest";
              DROP FUNCTION IF EXISTS pg011_pause_leave_decision();
              DROP TABLE IF EXISTS pg011_leave_decision_gate;
            `)
        }
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
        if (observerConnected) await observer.end()
        if (controlConnected) await control.end()
      }
    })

    await control.connect()
    controlConnected = true
    await observer.connect()
    observerConnected = true

    const identity = (
      await observer.query<{
        database: string
        role: string
        users: number
        departments: number
        requests: number
        isolation: string
      }>(`
        SELECT current_database() AS database,
          current_user AS role,
          (SELECT count(*)::int FROM "User") AS users,
          (SELECT count(*)::int FROM "Department") AS departments,
          (SELECT count(*)::int FROM "LeaveRequest") AS requests,
          current_setting('default_transaction_isolation') AS isolation
      `)
    ).rows[0]
    assert.deepEqual(
      {
        database: identity.database,
        role: identity.role,
        users: identity.users,
        departments: identity.departments,
        requests: identity.requests,
        isolation: identity.isolation,
      },
      {
        database: "nexus_pg011",
        role: "pg011_test",
        users: 0,
        departments: 0,
        requests: 0,
        isolation: "read committed",
      },
    )
    const controlPid = (
      await control.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0].pid
    t.diagnostic(
      JSON.stringify({
        database: identity.database,
        role: identity.role,
        isolation: identity.isolation,
      }),
    )

    process.env.DATABASE_URL = connection.href
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const department = await prisma.department.create({
      data: { name: `PG-011 leave decisions ${randomUUID()}` },
    })

    async function account(name: string, role: Role, departmentId?: string) {
      const user = await prisma.user.create({
        data: {
          role,
          fullName: `Synthetic ${name}`,
          email: `${randomUUID()}@pg011.test`,
          passwordHash: "synthetic-test-only",
          ...(departmentId ? { departmentId } : {}),
        },
      })
      const employee =
        role === "STAFF"
          ? await prisma.employee.create({
              data: {
                employeeId: `PG011-${randomUUID()}`,
                fullName: `Synthetic ${name}`,
                userId: user.id,
                departmentId: department.id,
              },
            })
          : null
      return { user, employee, token: (await issueSession(user)).token }
    }

    const requester = await account("requester", "STAFF", department.id)
    const head = await account("head", "STAFF", department.id)
    const firstReviewer = await account("first-reviewer", "ADMIN")
    const secondReviewer = await account("second-reviewer", "SUPERADMIN")
    assert(requester.employee)
    assert(head.employee)
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: `PG-011 leave policy ${randomUUID()}`,
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
        employeeId: requester.employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    })

    const listening = await listen(createApp())
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

    const created = await call(requester, "/leave/requests", {
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason: "Concurrent decision verification fixture",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
    })
    assert.equal(created.status, 201, created.body)
    const requestId = (JSON.parse(created.body) as { request: { id: string } })
      .request.id
    const verified = await call(head, `/leave/requests/${requestId}/verify`, {
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "Verify before competing HR decisions",
    })
    assert.equal(verified.status, 200, verified.body)
    const noticesBeforeFinalDecision = await prisma.workflowNotification.count({
      where: { leaveRequestId: requestId },
    })

    await control.query(`
      CREATE TABLE pg011_leave_decision_gate (target text PRIMARY KEY);
      CREATE FUNCTION pg011_pause_leave_decision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id IN (SELECT target FROM pg011_leave_decision_gate)
          AND NEW.status::text IN ('APPROVED', 'REJECTED') THEN
          PERFORM pg_advisory_xact_lock(${advisoryKey});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER pg011_pause_leave_decision
      BEFORE UPDATE ON "LeaveRequest"
      FOR EACH ROW EXECUTE FUNCTION pg011_pause_leave_decision();
    `)
    triggerInstalled = true
    await control.query(
      "INSERT INTO pg011_leave_decision_gate(target) VALUES ($1)",
      [requestId],
    )
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
      firstReviewer,
      `/leave/requests/${requestId}/approve`,
      {
        actionId: randomUUID(),
        expectedVersion: 2,
        note: "Approve the verified leave request",
      },
    )
    const firstPid = await blockedPid(controlPid)
    const rejectedDecision = call(
      secondReviewer,
      `/leave/requests/${requestId}/reject`,
      {
        actionId: randomUUID(),
        expectedVersion: 2,
        note: "Competing rejection of the same request",
      },
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
    assert.deepEqual(JSON.parse(rejected.body) as { error: string }, {
      error: "Leave request changed; refresh and try again",
    })

    const finalRequest = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        days: { orderBy: { id: "asc" } },
        decisions: { orderBy: { version: "asc" } },
      },
    })
    assert.equal(finalRequest.status, "APPROVED")
    assert.equal(finalRequest.version, 3)
    assert.equal(finalRequest.decisions.length, 3)
    assert.deepEqual(
      finalRequest.decisions.map(({ action, version }) => ({
        action,
        version,
      })),
      [
        { action: "SUBMITTED", version: 1 },
        { action: "VERIFIED", version: 2 },
        { action: "APPROVED", version: 3 },
      ],
    )
    assert.equal(
      await prisma.leaveDecision.count({
        where: { requestId, action: "REJECTED" },
      }),
      0,
    )
    assert.equal(finalRequest.days.length, 1)
    const notices = await prisma.workflowNotification.findMany({
      where: { leaveRequestId: requestId },
      orderBy: { createdAt: "asc" },
    })
    assert.equal(notices.length, noticesBeforeFinalDecision + 1)
    assert.equal(
      notices.filter(({ type }) => type === "LEAVE_APPROVED").length,
      1,
    )
    assert.equal(
      notices.filter(({ type }) => type === "LEAVE_REJECTED").length,
      0,
    )
    assert.equal(appBackendIds.size, 2)
  },
)
