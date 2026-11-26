import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import type { TestContext } from "node:test"
import type { ManagementContext } from "./context.js"

/** Personal overview identity, date boundaries and aggregation. */
export async function personalOverview(
  t: TestContext,
  { prisma, base, request, staff, account, outside }: ManagementContext,
) {
  await t.test(
    "[PG-007-F001-A011-T017] personal overview requires a linked Employee without creating one",
    async () => {
      const profileless = await prisma.user.create({
        data: {
          email: "pg007-profileless-admin@management.test",
          fullName: "PG-007 profileless admin",
          role: "ADMIN",
          passwordHash: "test-only",
        },
      })
      const token = (await issueSession(profileless)).token
      const adjustmentCount = await prisma.attendanceAdjustment.count()
      const correctionList = await fetch(
        `${base}/attendance/adjustments?scope=team&type=CORRECTION`,
        { headers: { authorization: `Bearer ${token}` } },
      )
      assert.equal(
        correctionList.status,
        200,
        await correctionList.clone().text(),
      )
      assert.equal(
        (
          (await correctionList.json()) as {
            capabilities: { requestCorrection: boolean }
          }
        ).capabilities.requestCorrection,
        false,
      )
      const createCorrection = await fetch(`${base}/attendance/adjustments`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00+08:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "Profileless administrator request",
        }),
      })
      assert.equal(createCorrection.status, 409)
      assert.equal(await prisma.attendanceAdjustment.count(), adjustmentCount)
      const before = {
        employees: await prisma.employee.count(),
        workdays: await prisma.attendanceWorkday.count(),
        sessions: await prisma.attendanceWorkSession.count(),
      }
      const response = await fetch(
        `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
        { headers: { authorization: `Bearer ${token}` } },
      )
      assert.equal(response.status, 409)
      const body = (await response.json()) as { error?: string }
      assert.equal(
        body.error,
        "Complete your employee profile before using attendance",
      )
      assert.deepEqual(
        {
          employees: await prisma.employee.count(),
          workdays: await prisma.attendanceWorkday.count(),
          sessions: await prisma.attendanceWorkSession.count(),
        },
        before,
      )
    },
  )
  await t.test(
    "[PG-007-F001-A012-T018] personal overview validates date range boundaries",
    async () => {
      const invalidCalendar = await request(
        staff,
        "/me/overview?from=2026-02-30&to=2026-02-30",
      )
      assert.equal(invalidCalendar.status, 400)
      const reversed = await request(
        staff,
        "/me/overview?from=2026-11-14&to=2026-11-13",
      )
      assert.equal(reversed.status, 400)
      const acceptedBoundary = await request(
        staff,
        "/me/overview?from=2025-01-01&to=2026-01-01",
      )
      assert.equal(acceptedBoundary.status, 200)
      const rejectedBoundary = await request(
        staff,
        "/me/overview?from=2025-01-01&to=2026-01-02",
      )
      assert.equal(rejectedBoundary.status, 400)
      const unsupportedKey = await request(
        staff,
        "/me/overview?from=2026-11-13&to=2026-11-13&unexpected=true",
      )
      assert.equal(unsupportedKey.status, 400)
    },
  )
  await t.test(
    "[PG-007-F001-A012-T019] personal overview aggregates attendance, approved leave, and recent activity",
    async () => {
      const personal = await account("pg007-reporting", "STAFF")
      const foreign = await account("pg007-foreign", "STAFF", outside.id)

      async function createSession(
        employeeId: string,
        startedAt: string,
        endedAt: string | null = null,
        suspendedAt: string | null = null,
      ) {
        return prisma.attendanceWorkSession.create({
          data: {
            employeeId,
            startedAt: new Date(startedAt),
            endedAt: endedAt ? new Date(endedAt) : null,
            suspendedAt: suspendedAt ? new Date(suspendedAt) : null,
          },
        })
      }

      const closedWithBreak = await createSession(
        personal.employee.id,
        "2026-11-13T09:00:00+08:00",
        "2026-11-13T09:30:00+08:00",
      )
      await prisma.attendanceBreak.create({
        data: {
          sessionId: closedWithBreak.id,
          startedAt: new Date("2026-11-13T09:10:00+08:00"),
          endedAt: new Date("2026-11-13T09:15:00+08:00"),
          isPaid: false,
        },
      })
      await createSession(
        personal.employee.id,
        "2026-11-13T10:00:00+08:00",
        "2026-11-13T10:30:00+08:00",
      )
      await createSession(
        personal.employee.id,
        "2026-11-13T11:00:00+08:00",
        "2026-11-13T11:30:00+08:00",
      )
      const onBreak = await createSession(
        personal.employee.id,
        "2026-11-14T09:00:00+08:00",
      )
      await prisma.attendanceBreak.create({
        data: {
          sessionId: onBreak.id,
          startedAt: new Date("2026-11-14T10:00:00+08:00"),
          isPaid: false,
        },
      })
      await createSession(
        foreign.employee.id,
        "2026-11-14T09:30:00+08:00",
        "2026-11-14T09:45:00+08:00",
      )

      const assignment =
        await prisma.attendancePolicyAssignment.findFirstOrThrow({
          where: { employeeId: personal.employee.id },
        })
      for (const workDate of ["2026-11-15", "2026-11-16"])
        await prisma.attendanceWorkday.create({
          data: {
            employeeId: personal.employee.id,
            assignmentId: assignment.id,
            workDate: new Date(`${workDate}T00:00:00.000Z`),
            timeZone: "Asia/Manila",
            isWorkingDay: true,
            requiredMinutes: 480,
            policyName: "Flexible",
            unpaidBreaksEnabled: false,
            overnightRequiresReview: false,
          },
        })

      // The database overlap constraint permits only one unfinished session
      // per employee. Keep the suspended and working status cases isolated.
      const suspendedActor = await account("pg007-suspended", "STAFF")
      await createSession(
        suspendedActor.employee.id,
        "2026-11-15T09:00:00+08:00",
        null,
        "2026-11-15T10:00:00+08:00",
      )
      const workingActor = await account("pg007-working", "STAFF")
      await createSession(workingActor.employee.id, "2026-11-16T09:00:00+08:00")

      await prisma.leaveRequest.create({
        data: {
          requestKey: randomUUID(),
          employeeId: personal.employee.id,
          requestedById: personal.user.id,
          type: "ANNUAL",
          reason: "PG-007 approved leave report fixture",
          startDate: new Date("2026-11-13T00:00:00.000Z"),
          endDate: new Date("2026-11-17T00:00:00.000Z"),
          status: "APPROVED",
          days: {
            create: [
              {
                employeeId: personal.employee.id,
                assignmentId: assignment.id,
                workDate: new Date("2026-11-13T00:00:00.000Z"),
                timeZone: "Asia/Manila",
                policyName: "Flexible",
                baseRequiredMinutes: 480,
                leaveMinutes: 240,
              },
              {
                employeeId: personal.employee.id,
                assignmentId: assignment.id,
                workDate: new Date("2026-11-17T00:00:00.000Z"),
                timeZone: "Asia/Manila",
                policyName: "Flexible",
                baseRequiredMinutes: 480,
                leaveMinutes: 480,
              },
            ],
          },
        },
      })

      const seededWorkdays = await prisma.attendanceWorkday.findMany({
        where: { employeeId: personal.employee.id },
        orderBy: { workDate: "asc" },
        select: { workDate: true },
      })
      assert.deepEqual(
        seededWorkdays.map((day) => day.workDate.toISOString().slice(0, 10)),
        ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"],
      )
      assert.equal(
        await prisma.attendanceWorkSession.count({
          where: { employeeId: personal.employee.id },
        }),
        4,
      )

      type PersonalOverview = {
        scope: string
        employees: number
        recordedDays: number
        approvedLeaveDays: number
        approvedLeaveHours: number
        checkIns: {
          employees: number
          total: number
          closed: number
          working: number
          onBreak: number
          suspended: number
          recentActivity: {
            action: string
            at: string
            employeeName: string
          }[]
        }
      }
      const response = await request(
        personal,
        "/me/overview?from=2026-11-13&to=2026-11-17",
      )
      assert.equal(response.status, 200)
      const result = (await response.json()) as PersonalOverview
      assert.equal(result.scope, "PERSONAL")
      assert.equal(result.employees, 1)
      assert.equal(result.recordedDays, 4)
      assert.equal(result.approvedLeaveDays, 2)
      assert.equal(result.approvedLeaveHours, 12)
      assert.deepEqual(
        {
          employees: result.checkIns.employees,
          total: result.checkIns.total,
          closed: result.checkIns.closed,
          working: result.checkIns.working,
          onBreak: result.checkIns.onBreak,
          suspended: result.checkIns.suspended,
        },
        {
          employees: 1,
          total: 4,
          closed: 3,
          working: 0,
          onBreak: 1,
          suspended: 0,
        },
      )
      assert.equal(result.checkIns.recentActivity.length, 8)
      assert.ok(
        result.checkIns.recentActivity.every(
          (event) => event.employeeName === personal.employee.fullName,
        ),
      )
      assert.deepEqual(
        result.checkIns.recentActivity.map((event) => event.action),
        [
          "BREAK_START",
          "CLOCK_IN",
          "CLOCK_OUT",
          "CLOCK_IN",
          "CLOCK_OUT",
          "CLOCK_IN",
          "CLOCK_OUT",
          "BREAK_END",
        ],
      )
      assert.deepEqual(
        result.checkIns.recentActivity.map((event) => event.at),
        [
          "2026-11-14T02:00:00.000Z",
          "2026-11-14T01:00:00.000Z",
          "2026-11-13T03:30:00.000Z",
          "2026-11-13T03:00:00.000Z",
          "2026-11-13T02:30:00.000Z",
          "2026-11-13T02:00:00.000Z",
          "2026-11-13T01:30:00.000Z",
          "2026-11-13T01:15:00.000Z",
        ],
      )

      const suspendedResponse = await request(
        suspendedActor,
        "/me/overview?from=2026-11-15&to=2026-11-15",
      )
      assert.equal(suspendedResponse.status, 200)
      const suspendedResult =
        (await suspendedResponse.json()) as PersonalOverview
      assert.deepEqual(
        {
          total: suspendedResult.checkIns.total,
          closed: suspendedResult.checkIns.closed,
          working: suspendedResult.checkIns.working,
          onBreak: suspendedResult.checkIns.onBreak,
          suspended: suspendedResult.checkIns.suspended,
        },
        { total: 1, closed: 0, working: 0, onBreak: 0, suspended: 1 },
      )

      const workingResponse = await request(
        workingActor,
        "/me/overview?from=2026-11-16&to=2026-11-16",
      )
      assert.equal(workingResponse.status, 200)
      const workingResult = (await workingResponse.json()) as PersonalOverview
      assert.deepEqual(
        {
          total: workingResult.checkIns.total,
          closed: workingResult.checkIns.closed,
          working: workingResult.checkIns.working,
          onBreak: workingResult.checkIns.onBreak,
          suspended: workingResult.checkIns.suspended,
        },
        { total: 1, closed: 0, working: 1, onBreak: 0, suspended: 0 },
      )
    },
  )
}
