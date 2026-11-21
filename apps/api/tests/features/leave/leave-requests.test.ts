import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "leave requests enforce staged review, conflicts, and attendance exceptions",
  { timeout: 120000 },
  async (t) => {
    let now = new Date("2026-11-17T08:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    const department = await prisma.department.create({
      data: { name: "Leave team" },
    })
    const outsideDepartment = await prisma.department.create({
      data: { name: "Outside leave team" },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Weekdays",
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: weekday > 0 && weekday < 6,
            requiredMinutes: weekday > 0 && weekday < 6 ? 480 : 0,
          })),
        },
      },
    })
    async function account(
      name: string,
      role: Role,
      departmentId: string | null = department.id,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@leave.test`,
          fullName: name,
          passwordHash: "test-only",
          role,
          departmentId,
        },
      })
      const employee = await prisma.employee.create({
        data: {
          employeeId: `LEAVE-${name}`,
          fullName: name,
          userId: user.id,
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
      return { user, employee, token: (await issueSession(user)).token }
    }
    const employee = await account("employee", "STAFF")
    const head = await account("head", "STAFF")
    const admin = await account("admin", "ADMIN")
    const superadmin = await account("superadmin", "SUPERADMIN")
    const outsider = await account("outsider", "STAFF", outsideDepartment.id)
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })

    type Account = typeof employee
    async function api(
      actor: Account,
      path: string,
      options: { method?: string; body?: unknown } = {},
    ) {
      return fetch(`${base}${path}`, {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        headers: {
          Authorization: `Bearer ${actor.token}`,
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      })
    }
    async function submit(
      startDate = "2026-11-18",
      endDate = "2026-11-20",
      actor = employee,
    ) {
      const response = await api(actor, "/leave/requests", {
        body: {
          requestKey: randomUUID(),
          type: "ANNUAL",
          reason: "Planned personal leave",
          startDate,
          endDate,
        },
      })
      assert.equal(response.status, 201, await response.clone().text())
      return (await response.json()) as {
        request: { id: string; version: number; status: string }
      }
    }
    async function action(
      actor: Account,
      id: string,
      name: string,
      expectedVersion: number,
      note = "Reviewed and confirmed",
    ) {
      return api(actor, `/leave/requests/${id}/${name}`, {
        body: { actionId: randomUUID(), expectedVersion, note },
      })
    }

    const preview = await api(employee, "/leave/preview", {
      body: { startDate: "2026-11-20", endDate: "2026-11-23" },
    })
    assert.equal(preview.status, 200, "preview")
    const previewBody = (await preview.json()) as {
      totalMinutes: number
      days: { leaveMinutes: number }[]
    }
    assert.equal(previewBody.days.length, 4)
    assert.equal(previewBody.totalMinutes, 960)

    const created = await submit()
    assert.equal(created.request.status, "SUBMITTED")

    const overlap = await api(employee, "/leave/requests", {
      body: {
        requestKey: randomUUID(),
        type: "SICK",
        reason: "Overlapping leave dates",
        startDate: "2026-11-19",
        endDate: "2026-11-21",
      },
    })
    assert.equal(overlap.status, 409)

    assert.equal(
      (await api(admin, "/leave/requests?scope=team&page=1")).status,
      200,
      "admin list",
    )
    const adminPending = (await (
      await api(admin, "/leave/requests?scope=team&page=1")
    ).json()) as { total: number }
    assert.equal(adminPending.total, 0)
    assert.equal(
      (await action(outsider, created.request.id, "verify", 1)).status,
      403,
    )
    const verifiedResponse = await action(head, created.request.id, "verify", 1)
    assert.equal(
      verifiedResponse.status,
      200,
      `verify: ${await verifiedResponse.clone().text()}`,
    )
    const verified = (await verifiedResponse.json()) as {
      request: { version: number; status: string }
    }
    assert.equal(verified.request.status, "VERIFIED")

    const approvedResponse = await action(
      admin,
      created.request.id,
      "approve",
      verified.request.version,
    )
    assert.equal(
      approvedResponse.status,
      200,
      `approve: ${await approvedResponse.clone().text()}`,
    )
    const approved = (await approvedResponse.json()) as {
      request: { version: number; status: string }
    }
    assert.equal(approved.request.status, "APPROVED")

    now = new Date("2026-11-18T08:00:00+08:00")
    const current = await api(employee, "/attendance/me/current")
    assert.equal(current.status, 200, "attendance current")
    const currentBody = (await current.json()) as {
      workday: {
        baseRequiredMinutes: number
        approvedLeaveMinutes: number
        requiredMinutes: number
      }
    }
    assert.equal(currentBody.workday.baseRequiredMinutes, 480)
    assert.equal(currentBody.workday.approvedLeaveMinutes, 480)
    assert.equal(currentBody.workday.requiredMinutes, 0)

    const calendar = await api(employee, "/projects/calendar?scope=mine&month=2026-11")
    assert.equal(calendar.status, 200)
    const calendarBody = (await calendar.json()) as {
      events: { id: string; type: string; allDay?: boolean; context: string }[]
    }
    assert.ok(
      calendarBody.events.some(
        (event) =>
          event.id.startsWith(`leave-${created.request.id}-`) &&
          event.type === "leave" &&
          event.allDay === true &&
          event.context === employee.employee.fullName,
      ),
    )

    const workload = await api(head, "/workload?week=2026-11-16")
    assert.equal(workload.status, 200)
    const workloadBody = (await workload.json()) as {
      staff: {
        id: string
        planning: { approvedLeaveHours: number }
      }[]
    }
    assert.equal(
      workloadBody.staff.find((item) => item.id === employee.employee.id)
        ?.planning.approvedLeaveHours,
      24,
    )

    const clockOnLeave = await api(employee, "/attendance/me/clock-in", {
      body: {},
    })
    assert.equal(clockOnLeave.status, 409)

    const reverseResponse = await action(
      superadmin,
      created.request.id,
      "reverse",
      approved.request.version,
      "Leave was withdrawn by HR",
    )
    assert.equal(
      reverseResponse.status,
      200,
      `reverse: ${await reverseResponse.clone().text()}`,
    )

    now = new Date("2026-11-17T08:00:00+08:00")
    const workedClock = await api(employee, "/attendance/me/clock-in", {
      body: {},
    })
    assert.equal(workedClock.status, 201, "worked clock in")
    const workedClockBody = (await workedClock.json()) as {
      workday: { activeSessionId: string }
    }
    now = new Date("2026-11-17T17:00:00+08:00")
    const workedClockOut = await api(employee, "/attendance/me/clock-out", {
      body: { sessionId: workedClockBody.workday.activeSessionId },
    })
    assert.equal(workedClockOut.status, 200, "worked clock out")

    const worked = await submit("2026-11-17", "2026-11-17")
    const verifiedWorked = await action(head, worked.request.id, "verify", 1)
    assert.equal(verifiedWorked.status, 200)
    const approveWorked = await action(admin, worked.request.id, "approve", 2)
    assert.equal(approveWorked.status, 409)

    const pending = await submit("2026-11-23", "2026-11-23")
    const cancel = await action(
      employee,
      pending.request.id,
      "cancel",
      pending.request.version,
      "Plans changed before approval",
    )
    assert.equal(cancel.status, 200)

    const decisions = await prisma.leaveDecision.count()
    assert.equal(decisions, 8)
    assert.equal(
      await prisma.workflowNotification.count({
        where: { leaveRequestId: created.request.id },
      }),
      6,
    )

    // A department move requires the receiving Head to verify again.
    const transferred = await submit("2026-11-24", "2026-11-24")
    assert.equal(
      (await action(head, transferred.request.id, "verify", 1)).status,
      200,
    )
    const noticePath = "/request-workflows/notifications"
    const originalNotice = await prisma.workflowNotification.findFirstOrThrow({
      where: {
        userId: admin.user.id,
        leaveRequestId: transferred.request.id,
        type: "LEAVE_VERIFIED",
      },
    })
    assert.equal(
      (
        await api(admin, `${noticePath}/${originalNotice.id}/read`, {
          method: "PATCH",
        })
      ).status,
      200,
    )

    await prisma.employee.update({
      where: { id: employee.employee.id },
      data: { departmentId: outsideDepartment.id },
    })
    async function transferCapabilities(reviewer: Account) {
      const list = await api(
        reviewer,
        "/leave/requests?scope=team&status=VERIFIED",
      )
      assert.equal(list.status, 200, await list.clone().text())
      const { requests } = (await list.json()) as {
        requests: {
          id: string
          capabilities: {
            approve: boolean
            verify: boolean
            fallback: boolean
            requiresReverification: boolean
          }
        }[]
      }
      const request = requests.find(({ id }) => id === transferred.request.id)
      assert.ok(request)
      return request.capabilities
    }
    const fallbackAccess = await transferCapabilities(admin)
    assert.equal(fallbackAccess.approve, false)
    assert.equal(fallbackAccess.requiresReverification, true)
    assert.equal(fallbackAccess.fallback, true)

    await prisma.department.update({
      where: { id: outsideDepartment.id },
      data: { headId: outsider.user.id },
    })
    for (const reviewer of [admin, superadmin]) {
      const access = await transferCapabilities(reviewer)
      assert.equal(access.approve, false)
      assert.equal(access.requiresReverification, true)
      assert.equal(
        (await action(reviewer, transferred.request.id, "approve", 2)).status,
        409,
      )
    }
    assert.equal((await transferCapabilities(outsider)).verify, true)
    assert.equal(
      (await action(head, transferred.request.id, "verify", 2)).status,
      403,
    )
    const reverification = {
      actionId: randomUUID(),
      expectedVersion: 2,
      note: "Confirmed by the receiving Department Head",
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const verifiedAgain = await api(
        outsider,
        `/leave/requests/${transferred.request.id}/verify`,
        { body: reverification },
      )
      assert.equal(verifiedAgain.status, 200, await verifiedAgain.text())
    }
    const restoredAccess = await transferCapabilities(admin)
    assert.equal(restoredAccess.approve, true)
    assert.equal(restoredAccess.requiresReverification, false)

    // A delayed read of the original notice must leave the new one unread.
    assert.equal(
      (
        await api(admin, `${noticePath}/${originalNotice.id}/read`, {
          method: "PATCH",
        })
      ).status,
      200,
    )
    const notices = await api(admin, noticePath)
    assert.equal(notices.status, 200, await notices.clone().text())
    const { notifications } = (await notices.json()) as {
      notifications: {
        id: string
        type: string
        leaveRequestId: string
        readAt: string | null
      }[]
    }
    const verifications = notifications.filter(
      ({ leaveRequestId, type }) =>
        leaveRequestId === transferred.request.id && type === "LEAVE_VERIFIED",
    )
    assert.equal(verifications.length, 2)
    assert.equal(
      verifications.filter(
        ({ id, readAt }) => id !== originalNotice.id && readAt === null,
      ).length,
      1,
    )
    assert.ok(verifications.find(({ id }) => id === originalNotice.id)?.readAt)
    assert.equal(
      (await action(admin, transferred.request.id, "approve", 3)).status,
      200,
    )
    assert.equal(
      (await api(head, `/leave/requests/${transferred.request.id}`)).status,
      404,
    )
    assert.equal(
      (await api(employee, `/leave/requests/${transferred.request.id}`)).status,
      200,
    )
    const filtered = await api(
      employee,
      "/leave/requests?scope=mine&from=2026-12-01&to=2026-12-02",
    )
    assert.equal(((await filtered.json()) as { total: number }).total, 0)

    const policyEdit = await api(admin, `/attendance/policies/${policy.id}`, {
      method: "PATCH",
      body: {
        name: "Weekdays",
        timeZone: "Asia/Manila",
        unpaidBreaksEnabled: true,
        overnightRequiresReview: true,
        days: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          isWorkingDay: weekday > 0 && weekday < 6,
          requiredMinutes: weekday > 0 && weekday < 6 ? 600 : 0,
        })),
      },
    })
    assert.equal(policyEdit.status, 409)
    assert.equal(
      (
        await api(admin, "/attendance/assignments", {
          body: {
            employeeId: employee.employee.id,
            policyId: policy.id,
            effectiveFrom: "2026-11-24",
          },
        })
      ).status,
      409,
    )

    // An eleven-hour shift has three hours of overtime, two of them during leave.
    now = new Date("2026-11-23T15:00:00+08:00")
    const overnight = await api(employee, "/attendance/me/clock-in", {
      body: {},
    })
    assert.equal(overnight.status, 201)
    const overnightBody = (await overnight.json()) as {
      workday: { activeSessionId: string }
    }
    const sessionId = overnightBody.workday.activeSessionId
    now = new Date("2026-11-24T02:00:00+08:00")
    const closed = await api(employee, "/attendance/me/clock-out", {
      body: { sessionId },
    })
    assert.equal(closed.status, 200)
    assert.equal(
      ((await closed.json()) as { leaveConflict: boolean }).leaveConflict,
      true,
    )
    assert.ok(
      await prisma.workflowNotification.count({
        where: {
          leaveRequestId: transferred.request.id,
          type: "LEAVE_ATTENDANCE_CONFLICT",
        },
      }),
    )
    const session = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: sessionId },
    })
    assert.equal(session.endedAt?.getTime(), now.getTime())
    assert.equal(
      await prisma.attendanceAdjustment.count({
        where: { sessionId, type: "OVERTIME" },
      }),
      0,
      "clock-out recovery skips automatic overtime that crosses approved leave",
    )

    const overtime = {
      type: "OVERTIME",
      sessionId,
      startedAt: "2026-11-23T23:00:00+08:00",
      endedAt: "2026-11-24T02:00:00+08:00",
      reason: "Recorded overnight overtime",
    }
    const overlapping = await api(employee, "/attendance/adjustments", {
      body: { ...overtime, requestKey: randomUUID() },
    })
    assert.equal(overlapping.status, 409)
    assert.match(await overlapping.text(), /Overtime overlaps approved leave/)

    const beforeLeave = await api(employee, "/attendance/adjustments", {
      body: {
        ...overtime,
        requestKey: randomUUID(),
        endedAt: "2026-11-24T00:00:00+08:00",
      },
    })
    assert.equal(beforeLeave.status, 201, await beforeLeave.clone().text())
    const { adjustment } = (await beforeLeave.json()) as {
      adjustment: { id: string; overtimeMinutes: number }
    }
    assert.equal(adjustment.overtimeMinutes, 60)

    const legacyOvertime = await prisma.attendanceAdjustment.create({
      data: {
        requestKey: randomUUID(),
        employeeId: employee.employee.id,
        requestedById: employee.user.id,
        sessionId,
        type: "OVERTIME",
        overtimeMinutes: 120,
        proposedStartedAt: new Date("2026-11-24T00:00:00+08:00"),
        proposedEndedAt: now,
        reason: "Overtime submitted before the leave overlap check",
        status: "VERIFIED",
        verifiedById: outsider.user.id,
        verifiedAt: now,
        verificationNote: "Previously verified overnight work",
      },
    })
    for (const reviewer of [admin, superadmin]) {
      const review = await api(
        reviewer,
        `/attendance/adjustments/${legacyOvertime.id}/review`,
        { body: { decision: "APPROVED", note: "Review overtime request" } },
      )
      assert.equal(review.status, 409)
      assert.match(await review.text(), /Overtime overlaps approved leave/)
    }
    const adjacentApproval = await api(
      superadmin,
      `/attendance/adjustments/${adjustment.id}/review`,
      { body: { decision: "APPROVED", note: "Approve work before leave" } },
    )
    assert.equal(adjacentApproval.status, 200, await adjacentApproval.text())

    const correction = await api(employee, "/attendance/adjustments", {
      body: {
        requestKey: randomUUID(),
        type: "CORRECTION",
        reason: "Correct overnight hours",
        startedAt: "2026-11-23T23:00:00+08:00",
        endedAt: "2026-11-24T01:00:00+08:00",
      },
    })
    assert.equal(correction.status, 409, await correction.clone().text())

    for (const scenario of [
      {
        name: "leave can start at the midnight when work and pending overtime end",
        workStart: "2026-11-30T15:00:00+08:00",
        overtimeStart: "2026-11-30T23:00:00+08:00",
        workEnd: "2026-12-01T00:00:00+08:00",
        leaveStart: "2026-12-01",
        leaveEnd: "2026-12-01",
        expectedMinutes: [480],
      },
      {
        name: "work and pending overtime on a rest day do not block leave for the next working day",
        workStart: "2026-12-06T13:00:00+08:00",
        overtimeStart: "2026-12-06T13:00:00+08:00",
        workEnd: "2026-12-06T14:00:00+08:00",
        leaveStart: "2026-12-06",
        leaveEnd: "2026-12-07",
        expectedMinutes: [0, 480],
      },
    ]) {
      await t.test(scenario.name, async () => {
        now = new Date(scenario.workEnd)
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: employee.employee.id,
            startedAt: new Date(scenario.workStart),
            endedAt: now,
          },
        })
        const pendingOvertime = await api(employee, "/attendance/adjustments", {
          body: {
            type: "OVERTIME",
            requestKey: randomUUID(),
            startedAt: scenario.overtimeStart,
            endedAt: scenario.workEnd,
            reason: "Recorded overtime outside requested leave hours",
          },
        })
        assert.equal(pendingOvertime.status, 201, await pendingOvertime.text())
        const leave = await submit(scenario.leaveStart, scenario.leaveEnd)
        const approval = await action(
          superadmin,
          leave.request.id,
          "approve",
          leave.request.version,
        )
        assert.equal(approval.status, 200, await approval.clone().text())
        const { request } = (await approval.json()) as {
          request: { status: string; days: { leaveMinutes: number }[] }
        }
        assert.equal(request.status, "APPROVED")
        assert.deepEqual(
          request.days.map((day) => day.leaveMinutes),
          scenario.expectedMinutes,
        )
      })
    }

    await t.test(
      "a shift that runs past midnight still conflicts with next-day leave",
      async () => {
        now = new Date("2026-12-10T00:00:00.001+08:00")
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: employee.employee.id,
            startedAt: new Date("2026-12-09T22:00:00+08:00"),
            endedAt: now,
          },
        })
        const leave = await submit("2026-12-10", "2026-12-10")
        const approval = await action(
          superadmin,
          leave.request.id,
          "approve",
          leave.request.version,
        )
        assert.equal(approval.status, 409)
        assert.match(await approval.text(), /Resolve recorded attendance/)
      },
    )

    await t.test(
      "leave approval rechecks the employee's current status",
      async () => {
        const subject = await account("inactive-after-submitting", "STAFF")
        const { request } = await submit("2026-12-11", "2026-12-11", subject)
        const verification = await action(
          head,
          request.id,
          "verify",
          request.version,
        )
        assert.equal(verification.status, 200, await verification.text())

        await prisma.employee.update({
          where: { id: subject.employee.id },
          data: { status: "INACTIVE" },
        })
        for (const reviewer of [admin, superadmin]) {
          const approval = await action(reviewer, request.id, "approve", 2)
          assert.equal(approval.status, 409, await approval.clone().text())
          assert.match(await approval.text(), /employee is inactive/i)
        }
        const pendingRequest = await prisma.leaveRequest.findUniqueOrThrow({
          where: { id: request.id },
          select: { status: true, version: true },
        })
        assert.deepEqual(pendingRequest, { status: "VERIFIED", version: 2 })

        const rejection = await action(admin, request.id, "reject", 2)
        assert.equal(rejection.status, 200, await rejection.clone().text())
        const rejected = (await rejection.json()) as {
          request: { status: string }
        }
        assert.equal(rejected.request.status, "REJECTED")
      },
    )

    await t.test(
      "attendance reports include approved leave without clock records",
      async () => {
        now = new Date("2026-12-28T08:00:00+08:00")
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
        assert.equal(
          scopedRecords.workdays[0].employee?.id,
          subject.employee.id,
        )
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
        now = new Date("2026-12-28T08:00:00+08:00")
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
        assert.equal(
          (await api(subject, unassignPath, { body: {} })).status,
          403,
        )
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
        assert.equal(restoredPreview.status, 200, await restoredPreview.clone().text())
        const restoredDay = ((await restoredPreview.json()) as {days: {policyName: string; assignmentId: string}[]}).days[0]
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
          now = new Date(at)
          const current = await api(subject, "/attendance/me/current")
          assert.equal(current.status, 200, await current.clone().text())
          assert.equal(
            ((await current.json()) as {workday: {assignmentId: string}}).workday.assignmentId,
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
  },
)
