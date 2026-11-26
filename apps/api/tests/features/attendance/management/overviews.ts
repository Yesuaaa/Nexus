import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import type { TestContext } from "node:test"
import type { ManagementContext } from "./context.js"

/** Request, check-in, record-audit and personal overview summaries. */
export async function overviews(
  t: TestContext,
  {
    prisma,
    other,
    request,
    staff,
    head,
    admin,
    account,
    base,
    department,
    outside,
  }: ManagementContext,
) {
  await t.test(
    "request summaries count all rows and preserve scope and status filtering",
    async () => {
      for (let index = 0; index < 27; index += 1) {
        await prisma.attendanceAdjustment.create({
          data: {
            employeeId: other.employee.id,
            requestedById: other.user.id,
            requestKey: randomUUID(),
            type: "CORRECTION",
            status: "PENDING",
            reason: "Outside department request",
            proposedStartedAt: new Date("2026-11-12T01:00:00Z"),
            proposedEndedAt: new Date("2026-11-12T02:00:00Z"),
          },
        })
      }
      assert.equal(
        (await request(staff, "/adjustments/overview?scope=team")).status,
        403,
      )
      assert.equal(
        (await request(head, "/adjustments/overview?scope=team")).status,
        403,
      )
      assert.equal(
        (await request(admin, "/adjustments/overview?scope=invalid")).status,
        400,
      )
      assert.equal(
        (await request(admin, "/adjustments?status=invalid")).status,
        400,
      )
      const summaryUser = await account("summary-user", "USER")
      const anonymous = await fetch(
        base + "/attendance/adjustments/overview?scope=mine",
      )
      assert.equal(anonymous.status, 401)
      const unsupportedRole = await request(
        summaryUser,
        "/adjustments/overview?scope=mine",
      )
      assert.equal(unsupportedRole.status, 403)
      const unknownQuery = await request(
        other,
        "/adjustments/overview?scope=mine&unexpected=true",
      )
      assert.equal(unknownQuery.status, 400)
      const deniedBody = (await unsupportedRole.json()) as Record<
        string,
        unknown
      >
      assert.equal("groups" in deniedBody, false)
      const anonymousBody = (await anonymous.json()) as Record<string, unknown>
      assert.equal("groups" in anonymousBody, false)

      const result = await request(other, "/adjustments/overview?scope=mine")
      assert.equal(result.status, 200)
      const summary = (await result.json()) as {
        groups: {
          type: string
          status: string
          count: number
          overtimeMinutes: number
          awaitingHrPending: number
        }[]
      }
      const pendingCorrection = summary.groups.find(
        (group) => group.type === "CORRECTION" && group.status === "PENDING",
      )
      assert.ok(pendingCorrection)
      assert.deepEqual(Object.keys(pendingCorrection).sort(), [
        "awaitingHrPending",
        "count",
        "overtimeMinutes",
        "status",
        "type",
      ])
      assert.deepEqual(
        {
          type: pendingCorrection.type,
          status: pendingCorrection.status,
          count: pendingCorrection.count,
          overtimeMinutes: pendingCorrection.overtimeMinutes,
          awaitingHrPending: pendingCorrection.awaitingHrPending,
        },
        {
          type: "CORRECTION",
          status: "PENDING",
          count: 27,
          overtimeMinutes: 0,
          awaitingHrPending: 27,
        },
      )
      // PG-013-F001-A014-T002: omission defaults to the personal scope.
      const omittedScope = await request(other, "/adjustments/overview")
      assert.equal(omittedScope.status, 200)
      assert.deepEqual(await omittedScope.json(), summary)

      await prisma.department.update({
        where: { id: department.id },
        data: { headId: head.user.id },
      })
      const scoped = (await (
        await request(head, "/adjustments/overview?scope=team")
      ).json()) as typeof summary
      const expected = await prisma.attendanceAdjustment.count({
        where: { employee: { departmentId: department.id } },
      })
      assert.equal(
        scoped.groups.reduce((sum, g) => sum + g.count, 0),
        expected,
      )
      const filtered = (await (
        await request(
          admin,
          "/adjustments?scope=team&type=CORRECTION&status=REJECTED",
        )
      ).json()) as {
        adjustments: { type: string; status: string }[]
        total: number
      }
      assert.equal(
        filtered.total,
        await prisma.attendanceAdjustment.count({
          where: { type: "CORRECTION", status: "REJECTED" },
        }),
      )
      assert.ok(
        filtered.adjustments.every(
          (g) => g.type === "CORRECTION" && g.status === "REJECTED",
        ),
      )
    },
  )
  await t.test(
    "check-in overview counts sessions and breaks and scopes recent overnight activity",
    async () => {
      const closed = await account("checkin-closed", "STAFF")
      const working = await account("checkin-working", "STAFF")
      const paused = await account("checkin-paused", "STAFF")
      const suspended = await account("checkin-suspended", "STAFF")
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: closed.employee.id,
          startedAt: new Date("2026-11-10T09:00:00+08:00"),
          endedAt: new Date("2026-11-10T10:00:00+08:00"),
        },
      })
      const overnight = await prisma.attendanceWorkSession.create({
        data: {
          employeeId: closed.employee.id,
          startedAt: new Date("2026-11-10T20:00:00+08:00"),
          endedAt: new Date("2026-11-11T04:00:00+08:00"),
        },
      })
      await prisma.attendanceBreak.create({
        data: {
          sessionId: overnight.id,
          startedAt: new Date("2026-11-10T22:00:00+08:00"),
          endedAt: new Date("2026-11-10T22:30:00+08:00"),
          isPaid: false,
        },
      })
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: working.employee.id,
          startedAt: new Date("2026-11-10T10:00:00+08:00"),
        },
      })
      const open = await prisma.attendanceWorkSession.create({
        data: {
          employeeId: paused.employee.id,
          startedAt: new Date("2026-11-10T11:00:00+08:00"),
        },
      })
      await prisma.attendanceBreak.create({
        data: {
          sessionId: open.id,
          startedAt: new Date("2026-11-10T12:00:00+08:00"),
          isPaid: false,
        },
      })
      const suspendedSession = await prisma.attendanceWorkSession.create({
        data: {
          employeeId: suspended.employee.id,
          startedAt: new Date("2026-11-10T07:00:00+08:00"),
          suspendedAt: new Date("2026-11-10T08:00:00+08:00"),
        },
      })
      await prisma.attendanceBreak.create({
        data: {
          sessionId: suspendedSession.id,
          startedAt: new Date("2026-11-10T07:30:00+08:00"),
          isPaid: false,
        },
      })
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: other.employee.id,
          startedAt: new Date("2026-11-10T13:00:00+08:00"),
          endedAt: new Date("2026-11-10T14:00:00+08:00"),
        },
      })
      type Summary = {
        checkIns: {
          employees: number
          total: number
          closed: number
          working: number
          onBreak: number
          suspended: number
          recentActivity: {
            id: string
            action: string
            at: string
            employeeName: string
          }[]
        }
      }
      const response = await request(
        head,
        "/overview?from=2026-11-10&to=2026-11-10",
      )
      assert.equal(response.status, 200)
      const { checkIns } = (await response.json()) as Summary
      assert.deepEqual(
        { ...checkIns, recentActivity: undefined },
        {
          employees: 4,
          total: 5,
          closed: 2,
          working: 1,
          onBreak: 1,
          suspended: 1,
          recentActivity: undefined,
        },
      )
      assert.equal(checkIns.recentActivity.length, 8)
      assert.ok(
        checkIns.recentActivity.every(
          (event) => event.employeeName !== other.employee.fullName,
        ),
      )
      assert.equal(checkIns.recentActivity[0].at, "2026-11-10T20:00:00.000Z")
      assert.equal(checkIns.recentActivity[0].action, "CLOCK_OUT")
      assert.ok(
        checkIns.recentActivity.some((event) => event.action === "BREAK_START"),
      )
      assert.ok(
        checkIns.recentActivity.some((event) => event.action === "BREAK_END"),
      )
      for (let index = 1; index < checkIns.recentActivity.length; index++)
        assert.ok(
          Date.parse(checkIns.recentActivity[index - 1].at) >=
            Date.parse(checkIns.recentActivity[index].at),
        )
      const empty = (await (
        await request(head, "/overview?from=2026-11-09&to=2026-11-09")
      ).json()) as Summary
      assert.deepEqual(empty.checkIns, {
        employees: 0,
        total: 0,
        closed: 0,
        working: 0,
        onBreak: 0,
        suspended: 0,
        recentActivity: [],
      })
      assert.equal(
        (await request(staff, "/overview?from=2026-11-10&to=2026-11-10"))
          .status,
        403,
      )
    },
  )
  await t.test(
    "record audit summaries filter before pagination and preserve department boundaries",
    async () => {
      const latest = await prisma.attendanceAudit.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
      })
      const date = latest.createdAt.toISOString().slice(0, 10)
      const from = new Date(date + "T00:00:00Z"),
        to = new Date(from.getTime() + 86400000)
      const query = "?from=" + date + "&to=" + date + "&recordsOnly=true"
      const response = await request(head, "/audit" + query)
      assert.equal(response.status, 200)
      type Audit = {
        total: number
        events: {
          entityType: string
          employeeId: string | null
          createdAt: string
        }[]
        actionCounts: { action: string; count: number }[]
      }
      const result = (await response.json()) as Audit
      const types = [
        "AttendanceWorkday",
        "AttendanceWorkSession",
        "AttendanceBreak",
      ]
      const where = {
        entityType: { in: types },
        createdAt: { gte: from, lt: to },
        employee: { is: { departmentId: department.id } },
      }
      assert.equal(result.total, await prisma.attendanceAudit.count({ where }))
      assert.ok(result.total > result.events.length)
      assert.equal(
        result.actionCounts.reduce((sum, row) => sum + row.count, 0),
        result.total,
      )
      assert.ok(
        result.events.every(
          (event) =>
            types.includes(event.entityType) &&
            event.employeeId !== other.employee.id,
        ),
      )
      const grouped = await prisma.attendanceAudit.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { action: "asc" },
      })
      assert.deepEqual(
        result.actionCounts,
        grouped.map((row) => ({
          action: row.action,
          count: row._count._all,
        })),
      )
      const all = (await (
        await request(admin, "/audit?from=" + date + "&to=" + date)
      ).json()) as Audit
      const records = (await (
        await request(admin, "/audit" + query)
      ).json()) as Audit
      assert.ok(all.total > records.total)
      assert.equal((await request(staff, "/audit" + query)).status, 403)
      assert.equal(
        (await request(head, "/audit?recordsOnly=false")).status,
        400,
      )
      assert.equal(
        (await request(head, "/audit?recordsOnly[]=true")).status,
        400,
      )
      assert.equal(
        (await request(head, "/records?recordsOnly=true")).status,
        400,
      )
      const empty = (await (
        await request(
          head,
          "/audit?from=2020-01-01&to=2020-01-01&recordsOnly=true",
        )
      ).json()) as Audit
      assert.equal(empty.total, 0)
      assert.deepEqual(empty.actionCounts, [])
      await prisma.department.update({
        where: { id: department.id },
        data: { headId: null },
      })
      assert.equal((await request(head, "/audit" + query)).status, 403)
    },
  )
  await t.test(
    "personal overview derives identity from the session and rejects scope overrides",
    async () => {
      const response = await request(
        staff,
        "/me/overview?from=2026-11-13&to=2026-11-13",
      )
      assert.equal(response.status, 200)
      const data = (await response.json()) as {
        scope: string
        checkIns: {
          total: number
          employees: number
          recentActivity: { employeeName: string }[]
        }
      }
      assert.equal(data.scope, "PERSONAL")
      assert.equal(
        data.checkIns.total,
        await prisma.attendanceWorkSession.count({
          where: {
            employeeId: staff.employee.id,
            workday: { workDate: new Date("2026-11-13") },
          },
        }),
      )
      assert.equal(data.checkIns.employees, 1)
      assert.ok(
        data.checkIns.recentActivity.every(
          (event) => event.employeeName === staff.employee.fullName,
        ),
      )
      const own = await request(
        admin,
        "/me/overview?from=2026-11-13&to=2026-11-13",
      )
      assert.equal(own.status, 200)
      const adminData = (await own.json()) as typeof data
      assert.equal(adminData.checkIns.total, 0)
      assert.equal(
        (await request(staff, "/me/overview?departmentId=" + outside.id))
          .status,
        400,
      )
      assert.equal(
        (await request(staff, "/me/overview?employeeId=" + other.employee.id))
          .status,
        400,
      )

      // PG-007-F001-A011-T016 additive authorization assertions.
      const anonymous = await fetch(
        `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
      )
      assert.equal(anonymous.status, 401)
      const anonymousBody = (await anonymous.json()) as {
        scope?: unknown
        checkIns?: unknown
      }
      assert.equal("scope" in anonymousBody, false)
      assert.equal("checkIns" in anonymousBody, false)

      const basicUser = await prisma.user.create({
        data: {
          email: "pg007-overview-user@management.test",
          fullName: "PG-007 basic user",
          role: "USER",
          passwordHash: "test-only",
        },
      })
      const basicUserToken = (await issueSession(basicUser)).token
      const forbidden = await fetch(
        `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
        { headers: { authorization: `Bearer ${basicUserToken}` } },
      )
      assert.equal(forbidden.status, 403)
      const forbiddenBody = (await forbidden.json()) as {
        scope?: unknown
        checkIns?: unknown
      }
      assert.equal("scope" in forbiddenBody, false)
      assert.equal("checkIns" in forbiddenBody, false)
    },
  )
}
