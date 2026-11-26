import assert from "node:assert/strict"
import type { TestContext } from "node:test"
import type { LeaveContext, Account } from "./context.js"

/** Attendance reports and cancelled policy assignments. */
export async function reportsAndAssignments(
  t: TestContext,
  {
    clock,
    account,
    prisma,
    submit,
    action,
    superadmin,
    api,
    head,
    outsider,
    admin,
    policy,
  }: LeaveContext,
) {
  await t.test(
    "attendance reports include approved leave without clock records",
    async () => {
      clock.now = new Date("2026-12-28T08:00:00+08:00")
      const subject = await account("leave-reporting", "STAFF")
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: subject.employee.id,
          startedAt: new Date("2026-12-11T08:00:00+08:00"),
          endedAt: new Date("2026-12-11T16:00:00+08:00"),
        },
      })
      const { request: leave } = await submit(
        "2026-12-14",
        "2026-12-27",
        subject,
      )
      const approved = await action(
        superadmin,
        leave.id,
        "approve",
        leave.version,
      )
      assert.equal(approved.status, 200, await approved.text())
      await submit("2026-12-28", "2026-12-28", subject)

      const range = "from=2026-12-11&to=2026-12-28"
      const personalHistory = `/attendance/me/history?${range}`
      const records = `/attendance/records?${range}&employeeId=${subject.employee.id}`
      type History = {
        total: number
        page: number
        workdays: {
          id: string | null
          workDate: string
          approvedLeaveMinutes: number
          baseRequiredMinutes: number
          requiredMinutes: number
          status: string
          sessions: { id: string }[]
          employee?: { id: string }
        }[]
      }
      async function history(actor: Account, path: string) {
        const result = await api(actor, path)
        assert.equal(result.status, 200, await result.clone().text())
        return (await result.json()) as History
      }

      const firstPage = await history(subject, personalHistory)
      assert.equal(firstPage.total, 11)
      assert.equal(firstPage.workdays.length, 10)
      assert.equal(firstPage.workdays[0].workDate, "2026-12-25")
      assert.equal(firstPage.workdays.at(-1)?.workDate, "2026-12-14")
      for (const day of firstPage.workdays) {
        assert.equal(day.id, null)
        assert.equal(day.approvedLeaveMinutes, 480)
        assert.equal(day.baseRequiredMinutes, 480)
        assert.equal(day.requiredMinutes, 0)
        assert.equal(day.status, "NOT_REQUIRED")
        assert.deepEqual(day.sessions, [])
      }
      const secondPage = await history(subject, `${personalHistory}&page=2`)
      assert.equal(secondPage.total, 11)
      assert.equal(secondPage.workdays.length, 1)
      assert.equal(secondPage.workdays[0].workDate, "2026-12-11")
      assert.equal(secondPage.workdays[0].sessions.length, 1)

      const scopedRecords = await history(head, records)
      assert.equal(scopedRecords.total, 11)
      assert.equal(scopedRecords.workdays[0].employee?.id, subject.employee.id)
      assert.equal((await api(outsider, records)).status, 404)

      async function overview(actor: Account, path: string) {
        const result = await api(actor, path)
        assert.equal(result.status, 200, await result.clone().text())
        return (await result.json()) as {
          recordedDays: number
          approvedLeaveDays: number
          approvedLeaveHours: number
          statusBreakdown: { NOT_REQUIRED: number }
          checkIns: { total: number; closed: number }
        }
      }

      for (const report of [
        await overview(subject, `/attendance/me/overview?${range}`),
        await overview(head, `/attendance/overview?${range}`),
      ]) {
        assert.equal(report.recordedDays, 1)
        assert.equal(report.approvedLeaveDays, 10)
        assert.equal(report.approvedLeaveHours, 80)
        assert.equal(report.statusBreakdown.NOT_REQUIRED, 10)
        assert.equal(report.checkIns.total, 1)
        assert.equal(report.checkIns.closed, 1)
      }
      assert.equal(
        (await overview(outsider, `/attendance/overview?${range}`))
          .approvedLeaveDays,
        0,
      )

      assert.equal(
        await prisma.attendanceWorkday.count({
          where: { employeeId: subject.employee.id },
        }),
        1,
      )
      // Older data may already have a recorded session on a date with approved leave.
      const legacySession = await prisma.attendanceWorkSession.create({
        data: {
          employeeId: subject.employee.id,
          startedAt: new Date("2026-12-25T08:00:00+08:00"),
          endedAt: new Date("2026-12-25T09:00:00+08:00"),
        },
      })
      const mergedHistory = await history(subject, personalHistory)
      assert.equal(mergedHistory.total, 11)
      assert.equal(mergedHistory.workdays[0].id, legacySession.workdayId)
      assert.equal(mergedHistory.workdays[0].approvedLeaveMinutes, 480)
      assert.equal(mergedHistory.workdays[0].sessions[0].id, legacySession.id)

      const reversed = await action(
        superadmin,
        leave.id,
        "reverse",
        leave.version + 1,
      )
      assert.equal(reversed.status, 200, await reversed.text())
      assert.equal((await history(subject, personalHistory)).total, 2)
      const emptyPage = await history(head, `${records}&page=2`)
      assert.equal(emptyPage.total, 2)
      assert.equal(emptyPage.page, 2)
      assert.deepEqual(emptyPage.workdays, [])
      assert.equal(
        await prisma.attendanceWorkday.count({
          where: { employeeId: subject.employee.id },
        }),
        2,
      )
    },
  )

  await t.test(
    "a cancelled leave request preserves a cancelled policy assignment without blocking a replacement",
    async () => {
      clock.now = new Date("2026-12-28T08:00:00+08:00")
      const subject = await account("cancelled-assignment", "STAFF")
      const futurePolicy = await prisma.attendancePolicy.create({
        data: {
          name: "Scheduled UTC policy",
          timeZone: "UTC",
          days: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              isWorkingDay: true,
              requiredMinutes: 360,
            })),
          },
        },
      })
      const startDate = "2027-01-04"
      async function assign(policyId: string) {
        const response = await api(admin, "/attendance/assignments", {
          body: {
            employeeId: subject.employee.id,
            policyId,
            effectiveFrom: startDate,
          },
        })
        assert.equal(response.status, 201, await response.clone().text())
        const { assignment } = (await response.json()) as {
          assignment: { id: string }
        }
        return assignment.id
      }

      const assignmentId = await assign(futurePolicy.id)
      const { request: leave } = await submit(startDate, startDate, subject)
      const unassignPath = `/attendance/assignments/${assignmentId}/unassign`
      assert.equal((await api(subject, unassignPath, { body: {} })).status, 403)
      const blocked = await api(admin, unassignPath, { body: {} })
      assert.equal(blocked.status, 409)
      assert.match(await blocked.text(), /Resolve future leave requests/)
      const cancelledLeave = await action(
        subject,
        leave.id,
        "cancel",
        leave.version,
      )
      assert.equal(cancelledLeave.status, 200, await cancelledLeave.text())

      const cancelledAssignment = await api(admin, unassignPath, { body: {} })
      assert.equal(
        cancelledAssignment.status,
        200,
        await cancelledAssignment.text(),
      )
      assert.equal((await api(admin, unassignPath, { body: {} })).status, 200)
      const listed = await api(
        admin,
        `/attendance/policies/${futurePolicy.id}/assignments`,
      )
      assert.equal(listed.status, 200, await listed.clone().text())
      const { assignments } = (await listed.json()) as {
        assignments: { id: string; status: string }[]
      }
      assert.equal(
        assignments.find(({ id }) => id === assignmentId)?.status,
        "CANCELLED",
      )

      const savedLeave = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: leave.id },
        include: { days: true, decisions: true },
      })
      assert.equal(savedLeave.status, "CANCELLED")
      assert.equal(savedLeave.days[0].assignmentId, assignmentId)
      assert.equal(savedLeave.days[0].policyName, futurePolicy.name)
      assert.equal(savedLeave.decisions.length, 2)
      const logs = await api(
        superadmin,
        `/workforce-compliance-logs?source=policies&event=CANCELLED&subjectId=${assignmentId}`,
      )
      assert.equal(logs.status, 200, await logs.clone().text())
      assert.equal(((await logs.json()) as { total: number }).total, 1)

      const preview = () =>
        api(subject, "/leave/preview", {
          body: { startDate, endDate: startDate },
        })
      const restoredPreview = await preview()
      assert.equal(
        restoredPreview.status,
        200,
        await restoredPreview.clone().text(),
      )
      const restoredDay = (
        (await restoredPreview.json()) as {
          days: { policyName: string; assignmentId: string }[]
        }
      ).days[0]
      assert.equal(restoredDay.policyName, policy.name)
      assert.notEqual(restoredDay.assignmentId, assignmentId)
      const workload = await api(head, `/workload?week=${startDate}`)
      assert.equal(workload.status, 200, await workload.clone().text())
      const planning = (await workload.json()) as {
        staff: {
          id: string
          planning: { requirement: { totalHours: number | null } }
        }[]
      }
      assert.equal(
        planning.staff.find(({ id }) => id === subject.employee.id)?.planning
          .requirement.totalHours,
        40,
      )

      async function expectRestoredPolicy(at: string) {
        clock.now = new Date(at)
        const current = await api(subject, "/attendance/me/current")
        assert.equal(current.status, 200, await current.clone().text())
        assert.equal(
          ((await current.json()) as { workday: { assignmentId: string } })
            .workday.assignmentId,
          restoredDay.assignmentId,
        )
      }
      await expectRestoredPolicy("2027-01-04T04:00:00+08:00")
      await expectRestoredPolicy("2027-01-04T09:00:00+08:00")

      const replacementId = await assign(policy.id)
      assert.notEqual(replacementId, assignmentId)
      const replacement = await preview()
      assert.equal(replacement.status, 200, await replacement.clone().text())
      assert.equal(
        ((await replacement.json()) as { days: { assignmentId: string }[] })
          .days[0].assignmentId,
        replacementId,
      )
      const clockIn = await api(subject, "/attendance/me/clock-in", {
        body: {},
      })
      assert.equal(clockIn.status, 201, await clockIn.clone().text())
      assert.equal(
        ((await clockIn.json()) as { workday: { assignmentId: string } })
          .workday.assignmentId,
        replacementId,
      )
    },
  )
}
