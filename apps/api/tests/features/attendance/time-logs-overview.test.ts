import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test, type TestContext } from "node:test"
import type { LeaveStatus, Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

const date = (day: string) => new Date(day + "T00:00:00Z")
const day = "2026-11-13"
const overview = "/overview?from=" + day + "&to=" + day
const timeout = { timeout: 120_000 }

async function fixture(t: TestContext) {
  const { prisma, base } = await startPgliteApp(t, {
    app: { attendanceClock: () => new Date("2026-11-14T12:00:00Z") },
  })
  async function actor(name: string, role: Role) {
    const user = await prisma.user.create({
      data: {
        email: name + "@pg014.test",
        fullName: name,
        role,
        passwordHash: "fixture",
      },
    })
    return { user, token: (await issueSession(user)).token }
  }
  function read(path: string, token?: string) {
    return fetch(base + "/attendance" + path, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    })
  }
  async function summary(path: string, token: string) {
    const response = await read(path, token)
    assert.equal(response.status, 200, await response.clone().text())
    return (await response.json()) as {
      scope: string
      recordedDays: number
      approvedLeaveDays: number
      employees: number
      checkIns: { employees: number; total: number }
    }
  }
  async function policy() {
    return prisma.attendancePolicy.create({
      data: {
        name: "PG-014 flexible",
        timeZone: "UTC",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
  }
  async function worker(
    name: string,
    departmentId: string,
    policyId: string,
    userId?: string,
  ) {
    const employee = await prisma.employee.create({
      data: { employeeId: name, fullName: name, departmentId, userId },
    })
    const assignment = await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId,
        effectiveFrom: date("2025-01-01"),
      },
    })
    return { employee, assignment }
  }
  return { prisma, actor, read, summary, policy, worker }
}

function workday(employeeId: string, assignmentId: string, workDate: Date) {
  return {
    employeeId,
    assignmentId,
    workDate,
    timeZone: "UTC",
    policyName: "PG-014 flexible",
    isWorkingDay: true,
    requiredMinutes: 480,
    unpaidBreaksEnabled: true,
    overnightRequiresReview: false,
  }
}

test(
  "[PG-014-F001-A013-T001] both report endpoints enforce current authentication",
  timeout,
  async (t) => {
    const { prisma, actor, read } = await fixture(t)
    const expired = await actor("expired", "ADMIN")
    const revoked = await actor("revoked", "ADMIN")
    const inactive = await actor("inactive", "ADMIN")
    const deleted = await actor("deleted", "ADMIN")
    const client = await actor("client", "USER")
    await prisma.session.updateMany({
      where: { userId: expired.user.id },
      data: { expiresAt: new Date(0) },
    })
    await prisma.session.deleteMany({ where: { userId: revoked.user.id } })
    await prisma.user.update({
      where: { id: inactive.user.id },
      data: { isActive: false },
    })
    await prisma.user.update({
      where: { id: deleted.user.id },
      data: { accountDeletedAt: new Date() },
    })
    for (const path of ["/departments", overview]) {
      for (const token of [
        undefined,
        "invalid",
        expired.token,
        revoked.token,
        inactive.token,
        deleted.token,
      ]) {
        const response = await read(path, token)
        assert.equal(response.status, 401)
        assert.deepEqual(Object.keys((await response.json()) as object), [
          "error",
        ])
      }
      const response = await read(path, client.token)
      assert.equal(response.status, 403)
      assert.deepEqual(Object.keys((await response.json()) as object), [
        "error",
      ])
    }
  },
)

test(
  "[PG-014-F001-A014-T002] profileless manager reads an empty directory",
  timeout,
  async (t) => {
    const { prisma, actor, read } = await fixture(t)
    const { token } = await actor("admin", "ADMIN")
    const response = await read("/departments", token)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { departments: [] })
    assert.equal(await prisma.employee.count(), 0)
  },
)

test(
  "[PG-014-F001-A015-T001] validates overview query grammar and inclusive range boundaries",
  timeout,
  async (t) => {
    const { prisma, actor, read, summary, policy, worker } = await fixture(t)
    const { token } = await actor("admin", "ADMIN")
    const { id: departmentId } = await prisma.department.create({
      data: { name: "Dates" },
    })
    const { employee, assignment } = await worker(
      "date-worker",
      departmentId,
      (await policy()).id,
    )
    await prisma.attendanceWorkday.createMany({
      data: ["2026-10-14", "2026-10-15", "2026-11-15", "2026-11-16"].map(
        (day) => workday(employee.id, assignment.id, date(day)),
      ),
    })
    for (const path of [
      "/overview",
      "/overview?from=2026-10-15",
      "/overview?to=2026-11-15",
      "/overview?from=2026-10-15&to=2026-11-15",
    ])
      assert.equal((await summary(path, token)).recordedDays, 2, path)
    for (const query of [
      "from=2024-02-29&to=2024-02-29",
      "from=2025-01-01&to=2026-01-01",
    ]) {
      assert.equal((await read("/overview?" + query, token)).status, 200, query)
    }
    for (const query of [
      "from=2026-11-15&to=2026-11-14",
      "from=2025-01-01&to=2026-01-02",
      "from=2026-02-30",
      "from=",
      "to=2026-11-14&to=2026-11-15",
      "departmentId=%20",
      "page=1",
      "employeeId=date-worker",
    ]) {
      assert.equal((await read("/overview?" + query, token)).status, 400, query)
    }
  },
)

test(
  "[PG-014-F001-A017-T001] merges recorded work and approved leave within current scope",
  timeout,
  async (t) => {
    const { prisma, actor, summary, policy, worker } = await fixture(t)
    const requester = await actor("worker", "STAFF")
    const { token } = await actor("admin", "ADMIN")
    const inside = await prisma.department.create({ data: { name: "Inside" } })
    const outside = await prisma.department.create({
      data: { name: "Outside" },
    })
    const { id: policyId } = await policy()
    const local = await worker("worker", inside.id, policyId, requester.user.id)
    const foreignActor = await actor("foreign", "STAFF")
    const foreign = await worker(
      "foreign",
      outside.id,
      policyId,
      foreignActor.user.id,
    )
    const recorded = await prisma.attendanceWorkday.create({
      data: workday(local.employee.id, local.assignment.id, date(day)),
    })
    await prisma.attendanceWorkSession.create({
      data: {
        employeeId: local.employee.id,
        workdayId: recorded.id,
        startedAt: new Date(day + "T09:00:00Z"),
        endedAt: new Date(day + "T10:00:00Z"),
      },
    })
    await prisma.attendanceWorkday.createMany({
      data: [
        workday(local.employee.id, local.assignment.id, date("2026-11-14")),
        workday(foreign.employee.id, foreign.assignment.id, date(day)),
      ],
    })
    async function leave(
      worker: typeof local,
      userId: string,
      day: string,
      status: LeaveStatus,
      leaveMinutes: number,
    ) {
      const workDate = date(day)
      await prisma.leaveRequest.create({
        data: {
          requestKey: randomUUID(),
          employeeId: worker.employee.id,
          requestedById: userId,
          type: "ANNUAL",
          reason: "PG-014 reporting fixture",
          startDate: workDate,
          endDate: workDate,
          status,
          days: {
            create: {
              workDate,
              employeeId: worker.employee.id,
              assignmentId: worker.assignment.id,
              timeZone: "UTC",
              policyName: "PG-014 flexible",
              baseRequiredMinutes: 480,
              leaveMinutes,
            },
          },
        },
      })
    }
    await leave(local, requester.user.id, day, "APPROVED", 240)
    await leave(local, requester.user.id, "2026-11-15", "APPROVED", 480)
    await leave(local, requester.user.id, "2026-11-16", "SUBMITTED", 480)
    await leave(local, requester.user.id, "2026-11-17", "REVERSED", 480)
    await leave(local, requester.user.id, "2026-11-18", "APPROVED", 0)
    await leave(foreign, foreignActor.user.id, day, "APPROVED", 480)
    const report = await summary(
      overview.replace("to=" + day, "to=2026-11-18") +
        "&departmentId=" +
        inside.id,
      token,
    )
    assert.equal(report.recordedDays, 2)
    assert.equal(report.approvedLeaveDays, 2)
    assert.equal(report.checkIns.employees, 1)
    assert.equal(report.checkIns.total, 1)
  },
)

test(
  "[PG-014-F001-A018-T001] accepts 10,000 scoped rows and rejects 10,001",
  timeout,
  async (t) => {
    const { prisma, actor, summary, read, policy, worker } = await fixture(t)
    const { token } = await actor("admin", "ADMIN")
    const { id: departmentId } = await prisma.department.create({
      data: { name: "Cap" },
    })
    const { id: policyId } = await policy()
    const cohort = []
    for (let index = 0; index < 40; index++)
      cohort.push(await worker("cap-" + index, departmentId, policyId))
    for (const { employee, assignment } of cohort) {
      const rows = Array.from({ length: 250 }, (_, index) =>
        workday(
          employee.id,
          assignment.id,
          new Date(Date.UTC(2026, 0, index + 1)),
        ),
      )
      await prisma.attendanceWorkday.createMany({ data: rows })
    }
    assert.equal(await prisma.attendanceWorkday.count(), 10_000)
    assert.equal(await prisma.leaveRequestDay.count(), 0)
    const path =
      "/overview?from=2026-01-01&to=2026-12-31&departmentId=" + departmentId
    assert.equal((await summary(path, token)).recordedDays, 10_000)
    const { employee, assignment } = cohort[0]
    await prisma.attendanceWorkday.create({
      data: workday(employee.id, assignment.id, date("2026-12-31")),
    })
    const response = await read(path, token)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: "Narrow the overview date range to at most 10,000 records",
    })
    assert.equal(
      (await summary(path.replace("to=2026-12-31", "to=2026-01-01"), token))
        .recordedDays,
      40,
    )
  },
)

test(
  "[PG-014-F001-A019-T002] fresh requests reflect committed placement and headship changes",
  timeout,
  async (t) => {
    const { prisma, actor, summary, read, policy, worker } = await fixture(t)
    const head = await actor("head", "STAFF")
    const replacement = await actor("replacement", "STAFF")
    const admin = await actor("admin", "ADMIN")
    const inside = await prisma.department.create({
      data: { name: "First", headId: head.user.id },
    })
    const outside = await prisma.department.create({ data: { name: "Second" } })
    const { employee, assignment } = await worker(
      "transfer",
      inside.id,
      (await policy()).id,
    )
    const row = await prisma.attendanceWorkday.create({
      data: workday(employee.id, assignment.id, date(day)),
    })
    assert.equal((await summary(overview, head.token)).recordedDays, 1)
    await prisma.employee.update({
      where: { id: employee.id },
      data: { departmentId: outside.id },
    })
    assert.equal((await summary(overview, head.token)).recordedDays, 0)
    assert.equal(
      (await summary(overview + "&departmentId=" + outside.id, admin.token))
        .recordedDays,
      1,
    )
    await prisma.department.update({
      where: { id: inside.id },
      data: { headId: replacement.user.id },
    })
    const audit = await prisma.attendanceAudit.count()
    for (const path of ["/departments", overview])
      assert.equal((await read(path, head.token)).status, 403)
    assert.equal((await summary(overview, replacement.token)).recordedDays, 0)
    assert.deepEqual(await prisma.attendanceWorkday.findMany(), [row])
    assert.equal(await prisma.attendanceAudit.count(), audit)
  },
)
