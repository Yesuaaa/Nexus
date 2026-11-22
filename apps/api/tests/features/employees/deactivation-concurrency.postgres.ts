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

// Opt-in only. Run by explicit path against a fresh migrated loopback database.
test(
  "PostgreSQL account deactivation and attendance concurrency",
  { timeout: 120_000 },
  async (t) => {
    const databaseUrl = process.env.WC_F01_POSTGRES_URL
    assert(databaseUrl, "Set WC_F01_POSTGRES_URL to a disposable database")
    const url = new URL(databaseUrl)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/nexus_wc_f01")
    assert(url.port)
    url.search = "?sslmode=disable"
    const connectionString = url.toString()
    const appName = `wc-f01-${randomUUID().slice(0, 8)}`
    const control = new pg.Client({ connectionString })
    const observer = new pg.Client({ connectionString })
    await control.connect()
    t.after(() => control.end())
    await observer.connect()
    t.after(() => observer.end())
    const environment = (
      await observer.query<{
        version: string
        isolation: string
        accounts: number
        deadlocks: number
      }>(`
    SELECT version(), current_setting('default_transaction_isolation') AS isolation,
      (SELECT count(*)::int FROM "User") AS accounts,
      (SELECT deadlocks::int FROM pg_stat_database WHERE datname = current_database())
  `)
    ).rows[0]
    assert.equal(environment.accounts, 0, "Use a fresh disposable database")
    assert.equal(environment.isolation, "read committed")
    t.diagnostic(JSON.stringify(environment))

    process.env.DATABASE_URL = `${connectionString}&application_name=${appName}`
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const start = "2026-11-20T00:00:00.000Z"
    const close = "2026-11-20T10:00:00.000Z"
    let now = new Date(start)
    const { server, origin } = await listen(
      createApp({ attendanceClock: () => now }),
    )
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
    })

    async function account(role: Role, departmentId?: string, isActive = true) {
      const user = await prisma.user.create({
        data: {
          role,
          departmentId,
          isActive,
          fullName: `Synthetic ${role}`,
          email: `${randomUUID()}@wc-f01.test`,
          passwordHash: "synthetic",
        },
      })
      return issueSession(user)
    }
    type Account = Awaited<ReturnType<typeof account>>
    async function request(
      actor: Account,
      path: string,
      method = "GET",
      body?: object,
    ) {
      const response = await fetch(`${origin}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const trace = response.headers.get("x-correlation-id")
      assert(trace)
      return { status: response.status, trace, body: await response.text() }
    }
    type Response = Awaited<ReturnType<typeof request>>
    function expectStatus(response: Response, status: number) {
      assert.equal(response.status, status, JSON.stringify(response))
    }
    const hr = await account("ADMIN")
    const root = await account("SUPERADMIN")
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Synthetic deactivation policy",
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
    async function fixture(departmentId?: string) {
      now = new Date(start)
      const staff = await account("STAFF", departmentId)
      const employee = await prisma.employee.create({
        data: {
          employeeId: `EXP-${randomUUID()}`,
          fullName: "Synthetic employee",
          userId: staff.user.id,
          departmentId,
        },
      })
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: employee.id,
          policyId: policy.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      })
      return { staff, employee }
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>
    type Route = "directory" | "account"
    const ok = { directory: 204, account: 200 }
    const manager = (route: Route) => (route === "directory" ? hr : root)
    const disable = (f: Fixture, route: Route) =>
      request(
        manager(route),
        route === "directory"
          ? `/employees/${f.employee.id}/account/status`
          : `/users/${f.staff.user.id}/status`,
        "PATCH",
        { isActive: false },
      )
    const clockIn = (f: Fixture) =>
      request(f.staff, "/attendance/me/clock-in", "POST", {})
    const clockOut = (f: Fixture, sessionId: string) =>
      request(f.staff, "/attendance/me/clock-out", "POST", { sessionId })
    const shifts = (f: Fixture) =>
      prisma.attendanceWorkSession.findMany({
        where: { employeeId: f.employee.id },
        include: { breaks: true },
      })
    const audit = (f: Fixture) =>
      prisma.attendanceAudit.findMany({
        where: { employeeId: f.employee.id },
        orderBy: { id: "asc" },
      })
    const management = (f: Fixture) =>
      prisma.accountManagementChange.findMany({
        where: { subjectAccountId: f.staff.user.id },
        orderBy: { id: "asc" },
      })
    const login = (f: Fixture) =>
      prisma.session.findMany({
        where: { userId: f.staff.user.id },
        include: { refreshTokens: true },
        orderBy: { id: "asc" },
      })
    const user = (f: Fixture) =>
      prisma.user.findUniqueOrThrow({ where: { id: f.staff.user.id } })
    const suspendedAudits = async (f: Fixture) =>
      (await audit(f)).filter(
        (row) => row.reason === "Open shift suspended at account deactivation",
      )

    async function open(f: Fixture, withBreak = false) {
      expectStatus(await clockIn(f), 201)
      const [shift] = await shifts(f)
      if (withBreak) {
        now = new Date("2026-11-20T09:00:00.000Z")
        expectStatus(
          await request(f.staff, "/attendance/me/breaks/start", "POST", {
            sessionId: shift.id,
          }),
          200,
        )
      }
      now = new Date(close)
      return shift.id
    }

    async function assertDisabled(
      f: Fixture,
      response: Response,
      route: Route,
      suspendedId?: string,
    ) {
      const rows = await shifts(f)
      t.diagnostic(
        JSON.stringify({
          route,
          response: { status: response.status, trace: response.trace },
          shifts: rows.map(({ id, endedAt, suspendedAt }) => ({
            id,
            endedAt,
            suspendedAt,
          })),
        }),
      )
      expectStatus(response, ok[route])
      assert.equal((await user(f)).isActive, false)
      assert.deepEqual(await login(f), [])
      assert(
        rows.every((row) => row.endedAt || row.suspendedAt),
        "deactivation stranded an open shift",
      )
      const [history, ...rest] = await management(f)
      assert.deepEqual(rest, [])
      assert.deepEqual(
        [history.actorAccountId, history.actorRoleAtTime, history.origin],
        [
          manager(route).user.id,
          manager(route).user.role,
          route === "directory" ? "EMPLOYEE_MANAGEMENT" : "ACCOUNT_MANAGEMENT",
        ],
      )
      assert.deepEqual(history.changes, {
        isActive: { before: true, after: false },
        sessionsRevoked: true,
      })
      const events = await suspendedAudits(f)
      if (suspendedId) {
        assert.equal(events.length, 1)
        const [event] = events
        assert.deepEqual(
          [
            event.entityId,
            event.actorId,
            event.actorRoleAtTime,
            event.operationId,
            event.correlationId,
          ],
          [
            suspendedId,
            history.actorAccountId,
            history.actorRoleAtTime,
            history.operationId,
            response.trace,
          ],
        )
        assert(event.writerTransaction)
        const logs = await request(
          root,
          `/workforce-compliance-logs?correlationId=${response.trace}`,
        )
        expectStatus(logs, 200)
        const result = JSON.parse(logs.body) as {
          total: number
          events: { operationId: string }[]
        }
        assert.equal(result.total, 1)
        assert.equal(result.events[0].operationId, history.operationId)
      } else {
        assert.deepEqual(events, [])
      }
      expectStatus(await request(f.staff, "/attendance/me/current"), 401)
      expectStatus(
        await request(f.staff, "/auth/refresh", "POST", {
          refreshToken: f.staff.refreshToken,
        }),
        401,
      )
    }

    const controlPid = (
      await control.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ).rows[0].pid
    async function waitForBlocked(
      blocker: number,
      pattern = 'SELECT "id" FROM "Employee"%FOR UPDATE',
    ) {
      const deadline = Date.now() + 3_000
      do {
        const result = await observer.query<{ pid: number }>(
          `
        SELECT pid FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock' AND $2 = ANY(pg_blocking_pids(pid))
          AND query LIKE $3
      `,
          [appName, blocker, pattern],
        )
        if (result.rows.length) return result.rows[0].pid
        await delay(10)
      } while (Date.now() < deadline)
      throw new Error(`Expected an API lock waiter behind backend ${blocker}`)
    }
    async function queue(
      f: Fixture,
      first: () => Promise<Response>,
      second: () => Promise<Response>,
    ) {
      const requests: Promise<Response>[] = []
      await control.query("BEGIN")
      try {
        await control.query(
          'SELECT id FROM "Employee" WHERE id = $1 FOR UPDATE',
          [f.employee.id],
        )
        requests.push(first())
        const firstPid = await waitForBlocked(controlPid)
        requests.push(second())
        const secondPid = await waitForBlocked(firstPid)
        assert.equal(new Set([controlPid, firstPid, secondPid]).size, 3)
        t.diagnostic(JSON.stringify({ controlPid, firstPid, secondPid }))
      } finally {
        await control.query("ROLLBACK")
        await Promise.all(requests)
      }
      return Promise.all(requests)
    }

    for (const route of ["directory", "account"] as const) {
      await t.test(`${route}: clock-in commits first`, async () => {
        const f = await fixture()
        const [punch, disabled] = await queue(
          f,
          () => clockIn(f),
          () => disable(f, route),
        )
        expectStatus(punch, 201)
        const [session] = await shifts(f)
        assert(session)
        await assertDisabled(f, disabled, route, session.id)
      })
      await t.test(
        `${route}: deactivation commits before clock-in`,
        async () => {
          const f = await fixture()
          const [disabled, punch] = await queue(
            f,
            () => disable(f, route),
            () => clockIn(f),
          )
          expectStatus(punch, 403)
          assert.deepEqual(await shifts(f), [])
          assert(
            !(await audit(f)).some((row) => row.correlationId === punch.trace),
          )
          await assertDisabled(f, disabled, route)
        },
      )
      await t.test(`${route}: clock-out commits first`, async () => {
        const f = await fixture()
        const id = await open(f, true)
        const [punch, disabled] = await queue(
          f,
          () => clockOut(f, id),
          () => disable(f, route),
        )
        expectStatus(punch, 200)
        const [session] = await shifts(f)
        assert.equal(session.endedAt?.toISOString(), close)
        assert.equal(session.breaks[0].endedAt?.toISOString(), close)
        assert.equal(session.suspendedAt, null)
        await assertDisabled(f, disabled, route)
      })
      await t.test(
        `${route}: deactivation commits before clock-out and HR reconciles`,
        async () => {
          const f = await fixture()
          const id = await open(f, true)
          const [disabled, punch] = await queue(
            f,
            () => disable(f, route),
            () => clockOut(f, id),
          )
          expectStatus(punch, 403)
          await assertDisabled(f, disabled, route, id)
          let [session] = await shifts(f)
          assert.equal(session.endedAt, null)
          assert.equal(session.breaks[0].endedAt, null)
          const reconcile = () =>
            request(
              hr,
              `/attendance/employees/${f.employee.id}/sessions/${id}/reconcile`,
              "POST",
              { endedAt: close, note: "Synthetic HR reconciliation" },
            )
          const reconciled = await reconcile()
          expectStatus(reconciled, 200)
          ;[session] = await shifts(f)
          assert.equal(session.endedAt?.toISOString(), close)
          assert.equal(session.breaks[0].endedAt?.toISOString(), close)
          const reconciledRows = (await audit(f)).filter(
            (row) => row.correlationId === reconciled.trace,
          )
          assert.equal(reconciledRows.length, 3)
          assert(
            reconciledRows.every(
              (row) =>
                row.actorId === hr.user.id && row.actorRoleAtTime === "ADMIN",
            ),
          )
          assert.equal(
            new Set(reconciledRows.map((row) => row.operationId)).size,
            1,
          )
          expectStatus(await reconcile(), 409)
          assert.equal((await suspendedAudits(f)).length, 1)
        },
      )
    }

    await t.test(
      "competing disables return a guarded conflict and a retry adds no suspension",
      async () => {
        const f = await fixture()
        const id = await open(f)
        const [first, second] = await queue(
          f,
          () => disable(f, "directory"),
          () => disable(f, "account"),
        )
        expectStatus(second, 409)
        await assertDisabled(f, first, "directory", id)
        const before = await audit(f)
        expectStatus(await disable(f, "directory"), 204)
        assert.deepEqual(await audit(f), before)
        const history = await management(f)
        assert.equal(history.length, 2)
        assert.equal(
          history.filter((row) => row.changedFields.includes("isActive"))
            .length,
          1,
        )
        assert(
          history.some(
            (row) =>
              !row.changedFields.length &&
              JSON.stringify(row.changes) === '{"sessionsRevoked":true}',
          ),
        )
      },
    )

    await t.test(
      "already inactive account recovers an unsuspended open shift once",
      async () => {
        const f = await fixture()
        const id = await open(f)
        await prisma.user.update({
          where: { id: f.staff.user.id },
          data: { isActive: false },
        })
        assert.equal((await shifts(f))[0].suspendedAt, null)
        const repaired = await disable(f, "directory")
        expectStatus(repaired, 204)
        const [session] = await shifts(f)
        assert(session.suspendedAt)
        const [event] = await suspendedAudits(f)
        const [history] = await management(f)
        assert.deepEqual(
          [event.entityId, event.operationId, event.correlationId],
          [id, history.operationId, repaired.trace],
        )
        assert.deepEqual(history.changes, { sessionsRevoked: true })
        assert.deepEqual(await login(f), [])
        expectStatus(await disable(f, "directory"), 204)
        assert.deepEqual(await suspendedAudits(f), [event])
      },
    )

    await t.test(
      "directory deactivation rejects an Employee link changed while waiting",
      async () => {
        const f = await fixture()
        let pending: Promise<Response> | undefined
        await control.query("BEGIN")
        try {
          await control.query(
            'SELECT id FROM "Employee" WHERE id = $1 FOR UPDATE',
            [f.employee.id],
          )
          pending = disable(f, "directory")
          await waitForBlocked(controlPid)
          await control.query(
            'UPDATE "Employee" SET "userId" = NULL WHERE id = $1',
            [f.employee.id],
          )
          await control.query("COMMIT")
        } finally {
          await control.query("ROLLBACK")
          await pending
        }
        assert(pending)
        expectStatus(await pending, 409)
        assert.equal((await user(f)).isActive, true)
        assert.equal((await login(f)).length, 1)
        assert.deepEqual(await management(f), [])
      },
    )

    await t.test(
      "account-only deactivation retries when a profile appears",
      async () => {
        const f = await fixture()
        const id = await open(f)
        await prisma.employee.update({
          where: { id: f.employee.id },
          data: { userId: null },
        })
        const disableVirtual = () =>
          request(
            hr,
            `/employees/account:${f.staff.user.id}/account/status`,
            "PATCH",
            { isActive: false },
          )
        let pending: Promise<Response> | undefined
        await control.query("BEGIN")
        try {
          await control.query(
            'SELECT id FROM "User" WHERE id = $1 FOR UPDATE',
            [f.staff.user.id],
          )
          pending = disableVirtual()
          await waitForBlocked(controlPid, 'UPDATE "public"."User"%')
          await control.query(
            'UPDATE "Employee" SET "userId" = $1 WHERE id = $2',
            [f.staff.user.id, f.employee.id],
          )
          await control.query("COMMIT")
        } finally {
          await control.query("ROLLBACK")
          await pending
        }
        assert(pending)
        expectStatus(await pending, 409)
        assert.equal((await user(f)).isActive, true)
        assert.equal((await login(f)).length, 1)
        assert.deepEqual(await management(f), [])
        await assertDisabled(f, await disableVirtual(), "directory", id)
      },
    )

    async function snapshot(f: Fixture) {
      return {
        user: await user(f),
        shifts: await shifts(f),
        login: await login(f),
        audit: await audit(f),
        management: await management(f),
        notifications: await prisma.workflowNotification.findMany({
          orderBy: { id: "asc" },
        }),
      }
    }
    for (const fault of [
      "suspension",
      "attendance audit",
      "management audit",
      "notification",
      "serialization",
    ] as const) {
      await t.test(
        `${fault} failure rolls back account, attendance, login and history`,
        async () => {
          const department =
            fault === "notification"
              ? await prisma.department.create({
                  data: { name: "Synthetic Head department" },
                })
              : undefined
          const f = await fixture(department?.id)
          const id = await open(f, true)
          let adjustmentId: string | undefined
          if (department) {
            await prisma.department.update({
              where: { id: department.id },
              data: { headId: f.staff.user.id },
            })
            const requester = await fixture(department.id)
            now = new Date(close)
            const submitted = await request(
              requester.staff,
              "/attendance/adjustments",
              "POST",
              {
                requestKey: randomUUID(),
                startedAt: start,
                endedAt: close,
                reason: "Synthetic pending correction",
              },
            )
            expectStatus(submitted, 201)
            adjustmentId = (
              JSON.parse(submitted.body) as { adjustment: { id: string } }
            ).adjustment.id
          }
          const target =
            fault === "attendance audit"
              ? "AttendanceAudit"
              : fault === "management audit"
                ? "AccountManagementChange"
                : fault === "notification"
                  ? "WorkflowNotification"
                  : "AttendanceWorkSession"
          const when =
            fault === "attendance audit"
              ? `NEW."entityId" = '${id}'`
              : fault === "management audit"
                ? `NEW."subjectAccountId" = '${f.staff.user.id}'`
                : fault === "notification"
                  ? `NEW."userId" = '${hr.user.id}' AND NEW."attendanceAdjustmentId" = '${adjustmentId}'`
                  : `NEW.id = '${id}' AND NEW."suspendedAt" IS NOT NULL`
          const code = fault === "serialization" ? "40001" : "P0001"
          const before = await snapshot(f)
          assert.equal(before.login.length, 1)
          assert.equal(before.login[0].refreshTokens.length, 1)
          await observer.query(`CREATE FUNCTION wc_f01_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION USING ERRCODE = '${code}', MESSAGE = 'Synthetic WC-F01 ${fault} failure';
      END $$;
      CREATE TRIGGER zz_wc_f01_abort AFTER ${target === "AttendanceWorkSession" ? "UPDATE" : "INSERT"} ON "${target}"
      FOR EACH ROW WHEN (${when}) EXECUTE FUNCTION wc_f01_abort()`)
          try {
            const failed = await disable(f, "directory")
            expectStatus(failed, fault === "serialization" ? 409 : 500)
            assert.deepEqual(await snapshot(f), before)
            const logs = await request(
              root,
              `/workforce-compliance-logs?correlationId=${failed.trace}`,
            )
            expectStatus(logs, 200)
            assert.equal((JSON.parse(logs.body) as { total: number }).total, 0)
          } finally {
            await observer.query(
              `DROP TRIGGER zz_wc_f01_abort ON "${target}"; DROP FUNCTION wc_f01_abort()`,
            )
          }
          await assertDisabled(
            f,
            await disable(f, "directory"),
            "directory",
            id,
          )
          if (adjustmentId)
            assert.equal(
              await prisma.workflowNotification.count({
                where: {
                  attendanceAdjustmentId: adjustmentId,
                  userId: hr.user.id,
                },
              }),
              1,
            )
        },
      )
    }
    const {
      rows: [database],
    } = await observer.query<{ deadlocks: number }>(
      "SELECT deadlocks::int FROM pg_stat_database WHERE datname = current_database()",
    )
    assert.equal(database.deadlocks, environment.deadlocks)
  },
)
