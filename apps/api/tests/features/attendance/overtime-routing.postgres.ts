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

// Opt in by explicit path with a freshly migrated, disposable database.
test(
  "PostgreSQL overtime routing with concurrent leadership changes",
  { timeout: 120_000 },
  async (t) => {
    const databaseUrl = process.env.WC_F02_POSTGRES_URL
    assert(databaseUrl, "Set WC_F02_POSTGRES_URL to a disposable database")
    const url = new URL(databaseUrl)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/nexus_wc_f02")
    assert(url.port)
    url.search = "?sslmode=disable"
    const connectionString = url.toString()
    const appName = `wc-f02-${randomUUID().slice(0, 8)}`
    const control = new pg.Client({ connectionString })
    const observer = new pg.Client({ connectionString })
    await control.connect()
    let gatesInstalled = false
    t.after(async () => {
      try {
        if (gatesInstalled) {
          await control.query("SELECT pg_advisory_unlock_all()")
          await control.query(`
            DROP TRIGGER wc_f02_pause ON "WorkflowNotification";
            DROP TRIGGER wc_f02_pause ON "Department";
            DROP TRIGGER wc_f02_pause ON "Employee";
            DROP FUNCTION wc_f02_pause();
            DROP TABLE wc_f02_gate;
          `)
        }
      } finally {
        await control.end()
      }
    })
    await observer.connect()
    t.after(() => observer.end())
    const pid = async (client: pg.Client) =>
      (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid
    const controlPid = await pid(control)
    const observerPid = await pid(observer)
    const deadlocks = async () =>
      (
        await observer.query<{ deadlocks: number }>(`
    SELECT deadlocks::int FROM pg_stat_database WHERE datname = current_database()
  `)
      ).rows[0].deadlocks
    const environment = (
      await observer.query<{
        version: string
        isolation: string
        accounts: number
      }>(`
    SELECT version(), current_setting('default_transaction_isolation') AS isolation,
      (SELECT count(*)::int FROM "User") AS accounts
  `)
    ).rows[0]
    assert.equal(environment.accounts, 0, "Use a fresh disposable database")
    assert.equal(environment.isolation, "read committed")
    const initialDeadlocks = await deadlocks()
    t.diagnostic(
      JSON.stringify({
        ...environment,
        initialDeadlocks,
        controlPid,
        observerPid,
        maxPool: 6,
      }),
    )

    process.env.DATABASE_URL = `${connectionString}&application_name=${appName}`
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "6"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const startedAt = "2026-11-20T00:00:00.000Z"
    const endedAt = "2026-11-20T10:00:00.000Z"
    const { server, origin } = await listen(
      createApp({
        attendanceClock: () => new Date("2026-11-21T00:00:00.000Z"),
      }),
    )
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
    })

    async function account(role: Role, departmentId?: string) {
      const user = await prisma.user.create({
        data: {
          role,
          departmentId,
          fullName: `Synthetic ${role}`,
          email: `${randomUUID()}@wc-f02.test`,
          passwordHash: "synthetic",
        },
      })
      const employee =
        role === "STAFF"
          ? await prisma.employee.create({
              data: {
                employeeId: `EXP-${randomUUID()}`,
                fullName: "Synthetic staff",
                userId: user.id,
                departmentId,
              },
            })
          : null
      return { ...(await issueSession(user)), employee }
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
        name: "Synthetic overtime policy",
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
    const inbox = "/request-workflows/notifications"
    const detail = (id: string) => `/attendance/adjustments/${id}`
    const pendingType = "ATTENDANCE_OVERTIME_PENDING"
    const review = (actor: Account, id: string) =>
      request(actor, `${detail(id)}/review`, "POST", {
        decision: "APPROVED",
        note: "Reviewed synthetic attendance",
      })
    const head = (departmentId: string, incoming: Account | null) =>
      request(hr, `/departments/${departmentId}`, "PUT", {
        headId: incoming?.user.id ?? null,
      })
    type Source = "explicit" | "clock-out" | "reconciliation" | "correction"
    async function fixture(source: Source) {
      const department = await prisma.department.create({
        data: { name: randomUUID() },
      })
      const staff = await account("STAFF", department.id)
      const former = await account("STAFF", department.id)
      const incoming = await account("STAFF", department.id)
      const employeeId = staff.employee!.id
      expectStatus(await head(department.id, former), 200)
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId,
          policyId: policy.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      })
      const session =
        source === "correction"
          ? null
          : await prisma.attendanceWorkSession.create({
              data: {
                employeeId,
                startedAt: new Date(
                  source === "clock-out"
                    ? "2026-11-20T14:00:00.000Z"
                    : startedAt,
                ),
                endedAt: source === "explicit" ? new Date(endedAt) : null,
              },
            })
      if (source === "reconciliation") {
        expectStatus(
          await request(
            hr,
            `/employees/${employeeId}/account/status`,
            "PATCH",
            { isActive: false },
          ),
          204,
        )
      }
      let correctionId: string | undefined
      if (source === "correction") {
        const correction = await request(
          staff,
          "/attendance/adjustments",
          "POST",
          {
            type: "CORRECTION",
            requestKey: randomUUID(),
            startedAt,
            endedAt,
            reason: "Restore a synthetic missed shift",
          },
        )
        expectStatus(correction, 201)
        correctionId = (
          JSON.parse(correction.body) as { adjustment: { id: string } }
        ).adjustment.id
      }
      const manual = {
        type: "OVERTIME",
        requestKey: randomUUID(),
        startedAt: "2026-11-20T08:00:00.000Z",
        endedAt,
        reason: "Submit synthetic recorded excess",
      }
      const actors = {
        explicit: staff,
        "clock-out": staff,
        reconciliation: hr,
        correction: root,
      }
      const produce = () => {
        switch (source) {
          case "explicit":
            return request(staff, "/attendance/adjustments", "POST", manual)
          case "clock-out":
            return request(staff, "/attendance/me/clock-out", "POST", {
              sessionId: session!.id,
            })
          case "reconciliation":
            return request(
              hr,
              `/attendance/employees/${employeeId}/sessions/${session!.id}/reconcile`,
              "POST",
              { endedAt, note: "Reconcile synthetic shift" },
            )
          case "correction":
            return review(root, correctionId!)
        }
      }
      return {
        department,
        staff,
        former,
        incoming,
        employeeId,
        produce,
        writer: actors[source],
        source,
        correctionId,
        sessionId: session?.id,
      }
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>
    type Notice = {
      id: string
      entityId: string
      type: string
      readAt: string | null
    }
    async function visible(account: Account, adjustmentId: string) {
      const response = await request(account, inbox)
      expectStatus(response, 200)
      return (
        JSON.parse(response.body) as { notifications: Notice[] }
      ).notifications.filter(
        ({ entityId, type }) =>
          entityId === adjustmentId && type === pendingType,
      )
    }
    const adjust = (f: Fixture) =>
      prisma.attendanceAdjustment.findMany({
        where: { employeeId: f.employeeId, type: "OVERTIME" },
      })
    const audit = (f: Fixture) =>
      prisma.attendanceAudit.findMany({
        where: { employeeId: f.employeeId },
        orderBy: { id: "asc" },
      })
    const rows = (id: string) =>
      prisma.workflowNotification.findMany({
        where: { attendanceAdjustmentId: id, type: pendingType },
        orderBy: { userId: "asc" },
      })
    const management = (subjectId: string) =>
      prisma.workforceManagementChange.findMany({
        where: { subjectId },
        orderBy: { id: "asc" },
      })
    async function snapshot(f: Fixture) {
      return {
        department: await prisma.department.findUniqueOrThrow({
          where: { id: f.department.id },
        }),
        workdays: await prisma.attendanceWorkday.findMany({
          where: { employeeId: f.employeeId },
          orderBy: { id: "asc" },
          include: {
            sessions: {
              orderBy: { id: "asc" },
              include: { breaks: { orderBy: { id: "asc" } } },
            },
          },
        }),
        adjustments: await prisma.attendanceAdjustment.findMany({
          where: { employeeId: f.employeeId },
          orderBy: { id: "asc" },
          include: {
            notifications: { orderBy: { id: "asc" } },
          },
        }),
        audit: await audit(f),
        management: await management(f.department.id),
      }
    }
    async function assertOvertime(f: Fixture, produced: Response) {
      expectStatus(produced, f.source === "explicit" ? 201 : 200)
      const [overtime, ...duplicates] = await adjust(f)
      assert(overtime)
      assert.deepEqual(duplicates, [])
      assert.equal(overtime.status, "PENDING")
      assert.equal(overtime.requestedById, f.staff.user.id)
      assert.equal(overtime.overtimeMinutes, 120)
      const history = (await audit(f)).filter(
        (row) => row.correlationId === produced.trace,
      )
      assert.equal(
        history.filter((row) => row.entityId === overtime.id).length,
        1,
      )
      if (f.source === "correction") {
        assert(history.some((row) => row.entityId === f.correctionId))
        const correction = await prisma.attendanceAdjustment.findUniqueOrThrow({
          where: { id: f.correctionId },
        })
        assert.equal(correction.status, "APPROVED")
      }
      if (f.source !== "explicit")
        assert(history.some((row) => row.entityId === overtime.sessionId))
      assert(
        history.every(
          (row) =>
            row.actorId === f.writer.user.id &&
            row.actorRoleAtTime === f.writer.user.role &&
            row.operationId &&
            row.writerTransaction,
        ),
      )
      assert.equal(new Set(history.map((row) => row.operationId)).size, 1)
      assert.equal(new Set(history.map((row) => row.writerTransaction)).size, 1)
      return overtime
    }

    const advisory = 760018
    await control.query(`
    CREATE TABLE wc_f02_gate (kind text PRIMARY KEY, target text NOT NULL);
    CREATE FUNCTION wc_f02_pause() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (TG_TABLE_NAME = 'WorkflowNotification' AND to_jsonb(NEW)->>'type' = 'ATTENDANCE_OVERTIME_PENDING'
          AND EXISTS (SELECT 1 FROM wc_f02_gate WHERE kind = 'notice' AND target = to_jsonb(NEW)->>'userId'))
        OR (TG_TABLE_NAME = 'Department' AND EXISTS (SELECT 1 FROM wc_f02_gate WHERE kind = 'department' AND target = NEW.id))
        OR (TG_TABLE_NAME = 'Employee' AND EXISTS (SELECT 1 FROM wc_f02_gate WHERE kind = 'employee' AND target = NEW.id)) THEN
        PERFORM pg_advisory_xact_lock(${advisory});
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER wc_f02_pause BEFORE INSERT ON "WorkflowNotification" FOR EACH ROW EXECUTE FUNCTION wc_f02_pause();
    CREATE TRIGGER wc_f02_pause AFTER UPDATE ON "Department" FOR EACH ROW EXECUTE FUNCTION wc_f02_pause();
    CREATE TRIGGER wc_f02_pause AFTER UPDATE OF "departmentId" ON "Employee" FOR EACH ROW EXECUTE FUNCTION wc_f02_pause();
  `)
    gatesInstalled = true
    async function waiter(
      blocker: number,
      query: string,
      completed: () => boolean = () => false,
    ) {
      const deadline = Date.now() + 3_000
      do {
        const result = await observer.query<{ pid: number }>(
          `
        SELECT pid FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock' AND $2 = ANY(pg_blocking_pids(pid)) AND query LIKE $3
      `,
          [appName, blocker, query],
        )
        if (result.rows.length) return result.rows[0].pid
        if (completed()) return null
        await delay(10)
      } while (Date.now() < deadline)
      throw new Error(
        `Expected an API lock waiter for ${query} behind backend ${blocker}`,
      )
    }
    async function interleave(
      gate: {
        kind: "notice" | "department" | "employee"
        target: string
        query: string
      },
      first: () => Promise<Response>,
      second: () => Promise<Response>,
      secondQuery: string,
      whileBlocked?: () => Promise<void>,
    ) {
      const pending: Promise<Response>[] = []
      let firstPid: number | null
      let secondPid: number | null
      await control.query("INSERT INTO wc_f02_gate VALUES ($1, $2)", [
        gate.kind,
        gate.target,
      ])
      await control.query("SELECT pg_advisory_lock($1)", [advisory])
      try {
        pending.push(first())
        firstPid = await waiter(controlPid, gate.query)
        assert(firstPid)
        let completed = false
        pending.push(
          second().finally(() => {
            completed = true
          }),
        )
        secondPid = await waiter(firstPid, secondQuery, () => completed)
        if (secondPid) {
          assert.equal(
            new Set([controlPid, observerPid, firstPid, secondPid]).size,
            4,
          )
          await whileBlocked?.()
        }
      } finally {
        await control.query("SELECT pg_advisory_unlock($1)", [advisory])
        await Promise.all(pending)
        await control.query("DELETE FROM wc_f02_gate")
      }
      const responses = await Promise.all(pending)
      t.diagnostic(
        JSON.stringify({
          firstPid,
          secondPid,
          requests: responses.map(({ status, trace }) => ({ status, trace })),
        }),
      )
      return { responses, secondPid }
    }

    const waitNotice = (target: Account) => ({
      kind: "notice" as const,
      target: target.user.id,
      query: "%attendance_notify_pending_adjustments%",
    })
    const waitDepartment = (target: string) => ({
      kind: "department" as const,
      target,
      query: '%UPDATE%"Department"%',
    })
    const departmentShare = 'SELECT "id" FROM "Department"%FOR SHARE'
    const departmentWrite = 'SELECT "id" FROM "Department"%FOR UPDATE'
    const employeeWrite = 'SELECT "id" FROM "Employee"%FOR UPDATE'

    for (const source of [
      "explicit",
      "clock-out",
      "reconciliation",
      "correction",
    ] as const) {
      for (const overtimeFirst of [true, false]) {
        await t.test(
          `${source}: ${overtimeFirst ? "overtime" : "Head change"} commits first`,
          async () => {
            const f = await fixture(source)
            const replace = () => head(f.department.id, f.incoming)
            const before = await snapshot(f)
            const stillBefore = async () =>
              assert.deepEqual(await snapshot(f), before)
            const { responses, secondPid } = overtimeFirst
              ? await interleave(
                  waitNotice(f.former),
                  f.produce,
                  replace,
                  departmentWrite,
                  stillBefore,
                )
              : await interleave(
                  waitDepartment(f.department.id),
                  replace,
                  f.produce,
                  departmentShare,
                  stillBefore,
                )
            const [produced, changed] = overtimeFirst
              ? responses
              : [...responses].reverse()
            expectStatus(changed, 200)
            const overtime = await assertOvertime(f, produced)
            const current = await prisma.department.findUniqueOrThrow({
              where: { id: f.department.id },
            })
            assert.equal(current.headId, f.incoming.user.id)
            const changes = (await management(f.department.id)).filter(
              (row) => !before.management.some(({ id }) => id === row.id),
            )
            const [leadership, ...duplicateChanges] = changes.filter(
              (row) => row.action === "HEAD_CHANGED",
            )
            assert.deepEqual(duplicateChanges, [])
            assert.equal(leadership.actorAccountId, hr.user.id)
            assert.equal(leadership.actorRoleAtTime, "ADMIN")
            assert.equal(leadership.origin, "DEPARTMENT_MANAGEMENT")
            assert(leadership.operationId)
            const stored = await rows(overtime.id)
            assert.equal(
              (await visible(f.incoming, overtime.id)).length,
              1,
              `Current Head needs one notice; stored recipients: ${JSON.stringify(stored.map((row) => row.userId))}`,
            )
            assert.deepEqual(await visible(f.former, overtime.id), [])
            expectStatus(await request(f.former, detail(overtime.id)), 404)
            expectStatus(await review(f.former, overtime.id), 403)
            expectStatus(await request(f.incoming, detail(overtime.id)), 200)
            assert.equal(stored.length, overtimeFirst ? 3 : 2)
            assert.deepEqual(
              new Set(stored.map((row) => row.userId)),
              new Set([
                root.user.id,
                f.incoming.user.id,
                ...(overtimeFirst ? [f.former.user.id] : []),
              ]),
            )
            assert(
              secondPid,
              "The second writer must wait for the first writer's Department lock",
            )
          },
        )
      }
    }

    await t.test(
      "notice IDs and read timestamps survive replay, removal and return",
      async () => {
        const f = await fixture("explicit")
        const overtime = await assertOvertime(f, await f.produce())
        async function markRead(actor: Account) {
          const [notice] = await visible(actor, overtime.id)
          assert(notice)
          expectStatus(
            await request(actor, `${inbox}/${notice.id}/read`, "PATCH"),
            200,
          )
          const stored = (await rows(overtime.id)).find(
            (row) => row.id === notice.id,
          )
          assert(stored?.readAt)
          return stored
        }
        const formerRead = await markRead(f.former)
        const rootRead = await markRead(root)
        expectStatus(await head(f.department.id, f.incoming), 200)
        const [newNotice] = await visible(f.incoming, overtime.id)
        assert.equal(newNotice.readAt, null)
        expectStatus(
          await request(f.former, `${inbox}/${formerRead.id}/read`, "PATCH"),
          404,
        )
        const incomingRead = await markRead(f.incoming)
        const before = await snapshot(f)
        const replay = await f.produce()
        expectStatus(replay, 201)
        assert.equal(
          (JSON.parse(replay.body) as { adjustment: { id: string } }).adjustment
            .id,
          overtime.id,
        )
        expectStatus(await head(f.department.id, f.incoming), 200)
        const after = await snapshot(f)
        assert.deepEqual(after.adjustments, before.adjustments)
        assert.deepEqual(after.audit, before.audit)
        expectStatus(await head(f.department.id, f.former), 200)
        assert.equal(
          (await visible(f.former, overtime.id))[0].readAt,
          formerRead.readAt?.toISOString(),
        )
        assert.deepEqual(await visible(f.incoming, overtime.id), [])
        expectStatus(await head(f.department.id, f.incoming), 200)
        assert.equal(
          (await visible(f.incoming, overtime.id))[0].readAt,
          incomingRead.readAt?.toISOString(),
        )
        for (const notice of [formerRead, incomingRead, rootRead]) {
          assert.deepEqual(
            (await rows(overtime.id)).find(({ id }) => id === notice.id),
            notice,
          )
        }
      },
    )

    for (const selfHead of [false, true]) {
      await t.test(
        `HR fallback when replacement ${selfHead ? "is the requester" : "removes the Head"}`,
        async () => {
          const f = await fixture("explicit")
          const {
            responses: [changed, produced],
            secondPid,
          } = await interleave(
            waitDepartment(f.department.id),
            () => head(f.department.id, selfHead ? f.staff : null),
            f.produce,
            departmentShare,
          )
          assert(secondPid)
          expectStatus(changed, 200)
          const overtime = await assertOvertime(f, produced)
          assert.deepEqual(
            new Set((await rows(overtime.id)).map(({ userId }) => userId)),
            new Set([hr.user.id, root.user.id]),
          )
          assert.equal((await visible(hr, overtime.id)).length, 1)
          assert.deepEqual(await visible(f.staff, overtime.id), [])
          assert.deepEqual(await visible(f.former, overtime.id), [])
          expectStatus(await request(f.former, detail(overtime.id)), 404)
          expectStatus(await review(f.staff, overtime.id), 403)
          expectStatus(await review(hr, overtime.id), 200)
          assert.equal((await adjust(f))[0].status, "APPROVED")
        },
      )
    }

    for (const source of ["explicit", "clock-out", "reconciliation"] as const) {
      for (const overtimeFirst of [true, false]) {
        await t.test(
          `${source}: ${overtimeFirst ? "overtime" : "Employee transfer"} wins placement race`,
          async () => {
            const f = await fixture(source)
            const destination = await prisma.department.create({
              data: { name: randomUUID() },
            })
            const newHead = await account("STAFF", destination.id)
            expectStatus(await head(destination.id, newHead), 200)
            const transfer = () =>
              request(hr, `/employees/${f.employeeId}`, "PUT", {
                departmentId: destination.id,
              })
            const before = await snapshot(f)
            const { responses, secondPid } = overtimeFirst
              ? await interleave(
                  waitNotice(f.former),
                  f.produce,
                  transfer,
                  employeeWrite,
                )
              : await interleave(
                  {
                    kind: "employee",
                    target: f.employeeId,
                    query: '%UPDATE%"Employee"%',
                  },
                  transfer,
                  f.produce,
                  employeeWrite,
                )
            assert(secondPid)
            const [produced, moved] = overtimeFirst
              ? responses
              : [...responses].reverse()
            expectStatus(moved, 200)
            assert.equal(
              (
                await prisma.employee.findUniqueOrThrow({
                  where: { id: f.employeeId },
                })
              ).departmentId,
              destination.id,
            )
            if (!overtimeFirst) {
              expectStatus(produced, 409)
              assert.match(produced.body, /Employee placement changed/)
              const after = await snapshot(f)
              assert.deepEqual(after.workdays, before.workdays)
              assert.deepEqual(after.adjustments, before.adjustments)
              assert.deepEqual(after.audit, before.audit)
            }
            const overtime = await assertOvertime(
              f,
              overtimeFirst ? produced : await f.produce(),
            )
            const stored = await rows(overtime.id)
            assert.deepEqual(
              new Set(stored.map(({ userId }) => userId)),
              new Set([
                root.user.id,
                newHead.user.id,
                ...(overtimeFirst ? [f.former.user.id] : []),
              ]),
            )
            assert.equal((await visible(newHead, overtime.id)).length, 1)
            assert.deepEqual(await visible(f.former, overtime.id), [])
            expectStatus(await request(f.former, detail(overtime.id)), 404)
            if (overtimeFirst) {
              const [placement] = (await audit(f)).filter(
                (row) => row.correlationId === moved.trace,
              )
              const [change] = (await management(f.employeeId)).filter(
                (row) => row.action === "ASSIGNMENT_CHANGED",
              )
              assert.equal(placement.entityType, "EmployeeDepartmentPlacement")
              assert.deepEqual(
                [
                  placement.actorId,
                  placement.actorRoleAtTime,
                  placement.operationId,
                ],
                [hr.user.id, "ADMIN", change.operationId],
              )
            }
          },
        )
      }
    }

    const faults = [
      {
        table: "WorkflowNotification",
        predicate: `NEW.type = 'ATTENDANCE_OVERTIME_PENDING'`,
      },
      {
        table: "AttendanceAudit",
        predicate: `NEW."entityType" = 'AttendanceAdjustment' AND NEW."after"->>'type' = 'OVERTIME'`,
      },
    ] as const
    async function withFault(
      { table, predicate }: (typeof faults)[number],
      run: () => Promise<void>,
    ) {
      await control.query(`
      CREATE FUNCTION wc_f02_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF ${predicate} THEN RAISE EXCEPTION 'Synthetic F02 write failure'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER wc_f02_fail AFTER INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION wc_f02_fail();
    `)
      try {
        await run()
      } finally {
        await control.query(
          `DROP TRIGGER wc_f02_fail ON "${table}"; DROP FUNCTION wc_f02_fail();`,
        )
      }
    }
    for (const source of [
      "explicit",
      "clock-out",
      "reconciliation",
      "correction",
    ] as const) {
      for (const fault of faults) {
        await t.test(
          `${source}: failed ${fault.table} rolls back the entire write`,
          async () => {
            const f = await fixture(source)
            if (source === "clock-out" || source === "reconciliation") {
              await prisma.attendanceBreak.create({
                data: {
                  sessionId: f.sessionId!,
                  startedAt: new Date(
                    source === "clock-out"
                      ? "2026-11-20T23:00:00.000Z"
                      : "2026-11-20T09:00:00.000Z",
                  ),
                  isPaid: true,
                },
              })
            }
            const before = await snapshot(f)
            await withFault(fault, async () => {
              const failed = await f.produce()
              expectStatus(failed, 500)
              assert.deepEqual(await snapshot(f), before)
              assert.equal(
                await prisma.attendanceAudit.count({
                  where: { correlationId: failed.trace },
                }),
                0,
              )
            })
            const overtime = await assertOvertime(f, await f.produce())
            assert.equal((await visible(f.former, overtime.id)).length, 1)
            assert.equal((await rows(overtime.id)).length, 2)
            const committed = await snapshot(f)
            expectStatus(await f.produce(), source === "explicit" ? 201 : 409)
            assert.deepEqual(await snapshot(f), committed)
          },
        )
      }
    }

    await t.test(
      "failed replacement notice rolls back Head change and management history",
      async () => {
        const f = await fixture("explicit")
        const overtime = await assertOvertime(f, await f.produce())
        const before = await snapshot(f)
        const replace = () => head(f.department.id, f.incoming)
        await withFault(faults[0], async () => {
          expectStatus(await replace(), 500)
          assert.deepEqual(await snapshot(f), before)
          assert.equal((await visible(f.former, overtime.id)).length, 1)
          assert.deepEqual(await visible(f.incoming, overtime.id), [])
        })
        expectStatus(await replace(), 200)
        assert.equal((await visible(f.incoming, overtime.id)).length, 1)
        assert.deepEqual(await visible(f.former, overtime.id), [])
      },
    )

    await t.test(
      "a queued Head change proceeds after clock-out notice rollback",
      async () => {
        const f = await fixture("clock-out")
        const before = await snapshot(f)
        await withFault(faults[0], async () => {
          const {
            responses: [produced, changed],
            secondPid,
          } = await interleave(
            waitNotice(f.former),
            f.produce,
            () => head(f.department.id, f.incoming),
            departmentWrite,
          )
          assert(secondPid)
          expectStatus(produced, 500)
          expectStatus(changed, 200)
          const after = await snapshot(f)
          assert.equal(after.department.headId, f.incoming.user.id)
          assert.deepEqual(after.workdays, before.workdays)
          assert.deepEqual(after.adjustments, before.adjustments)
          assert.deepEqual(after.audit, before.audit)
        })
        const overtime = await assertOvertime(f, await f.produce())
        assert.equal((await visible(f.incoming, overtime.id)).length, 1)
        assert.equal((await rows(overtime.id)).length, 2)
        assert.deepEqual(await visible(f.former, overtime.id), [])
      },
    )

    const finalDeadlocks = await deadlocks()
    const { connections } = (
      await observer.query<{ connections: number }>(
        `
      SELECT count(*)::int AS connections FROM pg_stat_activity WHERE application_name = $1
    `,
        [appName],
      )
    ).rows[0]
    t.diagnostic(JSON.stringify({ finalDeadlocks, connections }))
    assert.equal(finalDeadlocks, initialDeadlocks)
  },
)
