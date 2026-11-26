import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { startPgliteApp } from "../../support/pglite-app.js"
import {
  day,
  end,
  note,
  now,
  range,
  reconcilePath,
  recordsFixture,
} from "../../support/pg015-records.js"

const timeout = { timeout: 120_000 }

async function fixture(t: TestContext) {
  const { prisma, base } = await startPgliteApp(t, {
    app: { attendanceClock: () => now },
  })
  return { prisma, ...recordsFixture(prisma, base) }
}

async function report(response: Response) {
  assert.equal(response.status, 200, await response.clone().text())
  return (await response.json()) as {
    total: number
    page: number
    pageSize: number
    workdays: {
      id: string | null
      workDate: string
      approvedLeaveMinutes: number
      employee: object
      canReconcile: boolean
    }[]
  }
}

test(
  "[PG-015-F001-A008-T001] pages merged records with deterministic same-date ordering",
  timeout,
  async (t) => {
    const { setup, read } = await fixture(t)
    const f = await setup()
    const colleague = await f.worker("other-design", f.department.id)
    const foreign = await f.worker("other-operations", f.outside.id)
    for (let index = 1; index <= 10; index++) {
      await f.workday(
        f.subject,
        "2026-11-" + String(index).padStart(2, "0"),
        "pg015-workday-" + index,
      )
    }
    await f.workday(colleague, "2026-11-10", "pg015-z-tie")
    await f.workday(foreign, "2026-11-10")
    await f.workday(f.subject, "2026-10-31")
    await f.leave("2026-11-10")
    await f.leave("2026-11-11")
    const url =
      "/records?from=2026-11-01&to=2026-11-11&departmentId=" + f.department.id
    const first = await report(await read(url, f.admin.token))
    const second = await report(await read(url + "&page=2", f.admin.token))
    const beyond = await report(await read(url + "&page=3", f.admin.token))
    assert.deepEqual([first.total, second.total, beyond.total], [12, 12, 12])
    assert.deepEqual(
      [first.workdays.length, second.workdays.length, beyond.workdays.length],
      [10, 2, 0],
    )
    const rows = [...first.workdays, ...second.workdays]
    assert.deepEqual(
      rows.map(({ id }) => id),
      [
        null,
        "pg015-z-tie",
        ...Array.from(
          { length: 10 },
          (_, index) => "pg015-workday-" + (10 - index),
        ),
      ],
    )
    assert.equal(rows[0].approvedLeaveMinutes, 480)
    assert.equal(rows[2].approvedLeaveMinutes, 480)
    for (const { employee } of rows) {
      assert.ok(!("user" in employee))
      assert.ok(!("email" in employee))
    }
  },
)

test(
  "[PG-015-F001-A015-T002] directory validates grammar and preserves scoped stable order",
  timeout,
  async (t) => {
    const { prisma, setup, read } = await fixture(t)
    const f = await setup()
    await prisma.user.update({
      where: { id: f.employeeUser.user.id },
      data: { fullName: "Display Worker" },
    })
    await prisma.employee.update({
      where: { id: f.subject.employee.id },
      data: { fullName: "legacy@example.test" },
    })
    const z = await f.worker("PG015-Z", f.department.id)
    const a = await f.worker("PG015-A", f.department.id)
    await prisma.employee.updateMany({
      where: { id: { in: [z.employee.id, a.employee.id] } },
      data: { fullName: "Same Name" },
    })
    const unassigned = await f.worker("PG015-U", null)
    const foreign = await f.worker("PG015-F", f.outside.id)
    async function employees(query: string) {
      const response = await read("/employees?" + query, f.admin.token)
      assert.equal(response.status, 200, await response.clone().text())
      return (
        (await response.json()) as {
          employees: {
            id: string
            fullName: string
            employeeId: string
            departmentId: string | null
          }[]
        }
      ).employees
    }
    const result = await employees("search=%20pG015-WoRkEr%20")
    assert.deepEqual(result, [
      {
        id: f.subject.employee.id,
        fullName: "Display Worker",
        employeeId: "PG015-worker",
        departmentId: f.department.id,
      },
    ])
    assert.deepEqual(
      (await employees("search=Same&departmentId=" + f.department.id)).map(
        ({ id }) => id,
      ),
      [a.employee.id, z.employee.id].sort(),
    )
    const organization = await employees("search=%20%20")
    assert.ok(
      organization.some(
        ({ id, departmentId }) =>
          id === unassigned.employee.id && departmentId === null,
      ),
    )
    assert.ok(organization.some(({ id }) => id === foreign.employee.id))
    assert.deepEqual(await employees("search=" + "x".repeat(100)), [])
    assert.deepEqual(await employees("departmentId=missing-pg015"), [])
    for (const query of [
      "search=" + "x".repeat(101),
      "search=a&search=b",
      "page=0",
      "page=1.0",
      "departmentId[]=wrong",
    ]) {
      assert.equal(
        (await read("/employees?" + query, f.admin.token)).status,
        400,
        query,
      )
    }
  },
)

test(
  "[PG-015-F001-A016-T002] records validate dates and pages and keep inclusive range totals",
  timeout,
  async (t) => {
    const { setup, read } = await fixture(t)
    const f = await setup()
    for (const value of [
      "2024-02-29",
      "2026-10-14",
      "2026-10-15",
      "2026-11-15",
      "2026-11-16",
    ])
      await f.workday(f.subject, value)
    for (const query of ["", "?from=2026-10-15&to=2026-11-15&page=1"]) {
      const result = await report(await read("/records" + query, f.admin.token))
      assert.deepEqual(
        result.workdays.map(({ workDate }) => workDate),
        ["2026-11-15", "2026-10-15"],
      )
    }
    const leap = await report(
      await read("/records?from=2024-02-29&to=2024-02-29", f.admin.token),
    )
    assert.equal(leap.total, 1)
    const max = await report(
      await read(
        "/records?from=2025-11-15&to=2026-11-15&page=100000",
        f.admin.token,
      ),
    )
    assert.equal(max.total, 3)
    assert.equal(max.page, 100000)
    assert.deepEqual(max.workdays, [])
    for (const query of [
      "from=2025-11-14&to=2026-11-15",
      "from=2026-11-16&to=2026-11-15",
      "from=2025-02-29",
      "page=100001",
      "page=1&page=2",
      "search=wrong",
    ]) {
      assert.equal(
        (await read("/records?" + query, f.admin.token)).status,
        400,
        query,
      )
    }
    for (const filter of [
      "employeeId=missing-pg015",
      "departmentId=missing-pg015",
    ]) {
      assert.equal(
        (await read("/records?" + filter, f.admin.token)).status,
        404,
        filter,
      )
    }
  },
)

test(
  "[PG-015-F001-A017-T001] reconcile validates credentials, parameters and trimmed body",
  timeout,
  async (t) => {
    const { prisma, actor, setup, read } = await fixture(t)
    const f = await setup()
    const revoked = await actor("revoked", "ADMIN")
    const inactive = await actor("inactive", "ADMIN")
    const user = await actor("client", "USER")
    await prisma.session.deleteMany({ where: { userId: revoked.user.id } })
    await prisma.user.update({
      where: { id: inactive.user.id },
      data: { isActive: false },
    })
    const shift = await f.suspended()
    const path = reconcilePath(f.subject.employee.id, shift.id)
    for (const token of [undefined, revoked.token, inactive.token]) {
      assert.equal(
        (await read(path, token, { endedAt: end, note })).status,
        401,
      )
    }
    assert.equal(
      (await read(path, user.token, { endedAt: end, note })).status,
      403,
    )
    const auditCount = await prisma.attendanceAudit.count()
    for (const body of [
      { endedAt: end, note, other: "extra" },
      { endedAt: "", note },
      { endedAt: day + "T12:00:00", note },
      { endedAt: end, note: " 1234 " },
      { endedAt: end, note: "x".repeat(2001) },
    ]) {
      assert.equal((await read(path, f.admin.token, body)).status, 400)
    }
    for (const [employeeId, sessionId, status] of [
      ["bad%20id", shift.id, 400],
      [f.subject.employee.id, "bad%20id", 400],
      ["missing-pg015", shift.id, 404],
      [f.subject.employee.id, "missing-pg015", 404],
    ] as const) {
      assert.equal(
        (
          await read(reconcilePath(employeeId, sessionId), f.admin.token, {
            endedAt: end,
            note,
          })
        ).status,
        status,
      )
    }
    assert.deepEqual(
      await prisma.attendanceWorkSession.findUnique({
        where: { id: shift.id },
      }),
      shift,
    )
    assert.equal(await prisma.attendanceAudit.count(), auditCount)
    assert.equal(
      (await read(path, f.admin.token, { endedAt: end, note: "  12345  " }))
        .status,
      200,
    )
    assert.ok(
      await prisma.attendanceAudit.findFirst({
        where: { entityId: shift.id, action: "UPDATE", reason: "12345" },
      }),
    )
    const second = await f.suspended("2026-11-14")
    assert.equal(
      (
        await read(
          reconcilePath(f.subject.employee.id, second.id),
          f.admin.token,
          {
            endedAt: "2026-11-14T12:00:00Z",
            note: "x".repeat(2000),
          },
        )
      ).status,
      200,
    )
  },
)

test(
  "[PG-015-F001-A018-T002] reconciliation rolls back leave, break and audit effects together",
  timeout,
  async (t) => {
    const { prisma, setup, read } = await fixture(t)
    const f = await setup()
    const shift = await f.suspended()
    const pause = await prisma.attendanceBreak.create({
      data: {
        sessionId: shift.id,
        startedAt: new Date(day + "T10:00:00Z"),
        isPaid: false,
      },
    })
    const leave = await f.leave(day)
    const path = reconcilePath(f.subject.employee.id, shift.id)
    const auditCount = await prisma.attendanceAudit.count()
    const notificationCount = await prisma.workflowNotification.count()
    await prisma.$executeRaw`CREATE FUNCTION pg015_fail_close() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PG-015 rollback fixture'; END $$`
    await prisma.$executeRaw`CREATE TRIGGER pg015_fail_close BEFORE UPDATE OF "endedAt" ON "AttendanceWorkSession" FOR EACH ROW EXECUTE FUNCTION pg015_fail_close()`
    try {
      assert.equal(
        (await read(path, f.admin.token, { endedAt: end, note })).status,
        500,
      )
      assert.deepEqual(
        await prisma.attendanceWorkSession.findUnique({
          where: { id: shift.id },
        }),
        shift,
      )
      assert.deepEqual(
        await prisma.attendanceBreak.findUnique({ where: { id: pause.id } }),
        pause,
      )
      assert.equal(await prisma.attendanceAudit.count(), auditCount)
      assert.equal(await prisma.workflowNotification.count(), notificationCount)
    } finally {
      await prisma.$executeRaw`DROP TRIGGER pg015_fail_close ON "AttendanceWorkSession"`
      await prisma.$executeRaw`DROP FUNCTION pg015_fail_close()`
    }
    assert.equal(
      (await read(path, f.admin.token, { endedAt: end, note })).status,
      200,
    )
    const closed = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: shift.id },
    })
    assert.equal(closed.endedAt?.toISOString(), new Date(end).toISOString())
    assert.deepEqual(closed.suspendedAt, shift.suspendedAt)
    assert.deepEqual(
      (
        await prisma.attendanceBreak.findUniqueOrThrow({
          where: { id: pause.id },
        })
      ).endedAt,
      closed.endedAt,
    )
    const notices = await prisma.workflowNotification.findMany({
      where: { leaveRequestId: leave.id, type: "LEAVE_ATTENDANCE_CONFLICT" },
    })
    assert.deepEqual(
      notices.map(({ userId }) => userId).sort(),
      [f.admin.user.id, f.supervisor.user.id].sort(),
    )
    const rows = await report(
      await read(
        "/records?" + range + "&employeeId=" + f.subject.employee.id,
        f.admin.token,
      ),
    )
    assert.equal(rows.workdays[0].canReconcile, false)
    assert.equal(rows.workdays[0].approvedLeaveMinutes, 480)
  },
)
