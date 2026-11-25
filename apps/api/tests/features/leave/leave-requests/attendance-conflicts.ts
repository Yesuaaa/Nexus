import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { LeaveContext } from "./context.js"
import type { departmentTransfers } from "./transfers.js"

/** Overnight shifts, overtime, corrections and open sessions. */
export async function attendanceConflicts(
  t: TestContext,
  {
    api,
    employee,
    clock,
    prisma,
    transferred,
    outsider,
    admin,
    superadmin,
    submit,
    action,
    account,
    expectAttendanceConflict,
    savedLeave,
    policy,
    department,
  }: LeaveContext & Awaited<ReturnType<typeof departmentTransfers>>,
) {
  const overnight = await api(employee, "/attendance/me/clock-in", {
    body: {},
  })
  assert.equal(overnight.status, 201)
  const overnightBody = (await overnight.json()) as {
    workday: { activeSessionId: string }
  }
  const sessionId = overnightBody.workday.activeSessionId
  clock.now = new Date("2026-11-24T02:00:00+08:00")
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
  assert.equal(session.endedAt?.getTime(), clock.now.getTime())
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
      proposedEndedAt: clock.now,
      reason: "Overtime submitted before the leave overlap check",
      status: "VERIFIED",
      verifiedById: outsider.user.id,
      verifiedAt: clock.now,
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
      clock.now = new Date(scenario.workEnd)
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: employee.employee.id,
          startedAt: new Date(scenario.workStart),
          endedAt: clock.now,
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
      clock.now = new Date("2026-12-10T00:00:00.001+08:00")
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: employee.employee.id,
          startedAt: new Date("2026-12-09T22:00:00+08:00"),
          endedAt: clock.now,
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
    "a December 7 open shift permits December 10 leave",
    async () => {
      const subject = await account("open-shift-leave", "STAFF")
      clock.now = new Date("2026-12-07T09:00:00+08:00")
      const clockIn = await api(subject, "/attendance/me/clock-in", {
        body: {},
      })
      assert.equal(clockIn.status, 201, await clockIn.text())
      const sameDay = await submit("2026-12-07", "2026-12-07", subject)
      const future = await submit("2026-12-10", "2026-12-10", subject)

      await expectAttendanceConflict(subject, sameDay.request)
      clock.now = new Date("2026-12-07T10:00:00+08:00")
      await expectAttendanceConflict(subject, sameDay.request)
      const approved = await action(superadmin, future.request.id, "approve", 1)
      assert.equal(approved.status, 200, await approved.text())
      assert.equal((await savedLeave(future.request.id)).status, "APPROVED")
      assert.equal(
        await prisma.attendanceWorkSession.count({
          where: { employeeId: subject.employee.id, endedAt: null },
        }),
        1,
      )
    },
  )

  await t.test(
    "open and suspended shifts use the leave policy's midnight",
    async (boundaries) => {
      const newYork = await prisma.attendancePolicy.create({
        data: {
          name: "New York weekdays",
          timeZone: "America/New_York",
          days: {
            create: await prisma.attendancePolicyDay.findMany({
              where: { policyId: policy.id },
              select: {
                weekday: true,
                isWorkingDay: true,
                requiredMinutes: true,
              },
            }),
          },
        },
      })

      for (const { mode, milliseconds } of [
        { mode: "active", milliseconds: 0 },
        { mode: "active", milliseconds: 1 },
        { mode: "suspended", milliseconds: 0 },
        { mode: "suspended", milliseconds: 1 },
      ]) {
        await boundaries.test(
          `${mode} shift ends its elapsed interval ${milliseconds} ms after midnight`,
          async () => {
            const subject = await account(
              `leave-${mode}-${milliseconds}`,
              "STAFF",
              department.id,
              newYork.id,
            )
            const startedAt = new Date("2026-12-09T22:00:00-05:00")
            const cutoff = new Date(
              Date.parse("2026-12-10T00:00:00-05:00") + milliseconds,
            )
            const suspended = mode === "suspended"
            const session = await prisma.attendanceWorkSession.create({
              data: {
                employeeId: subject.employee.id,
                startedAt,
                suspendedAt: suspended ? cutoff : null,
              },
              include: { workday: { select: { workDate: true } } },
            })
            assert.equal(
              session.workday.workDate.toISOString(),
              "2026-12-09T00:00:00.000Z",
            )
            clock.now = suspended
              ? new Date("2026-12-10T08:00:00-05:00")
              : cutoff
            const { request } = await submit(
              "2026-12-10",
              "2026-12-10",
              subject,
            )

            if (milliseconds > 0) {
              await expectAttendanceConflict(subject, request)
              return
            }

            const approved = await action(
              superadmin,
              request.id,
              "approve",
              request.version,
            )
            assert.equal(approved.status, 200, await approved.text())
            assert.equal((await savedLeave(request.id)).status, "APPROVED")
            if (suspended) {
              const endedAt = new Date(cutoff.getTime() + 1)
              const reconcile = await api(
                admin,
                `/attendance/employees/${subject.employee.id}/sessions/${session.id}/reconcile`,
                {
                  body: {
                    endedAt: endedAt.toISOString(),
                    note: "Confirmed work just after midnight",
                  },
                },
              )
              assert.equal(reconcile.status, 200, await reconcile.text())
              const saved =
                await prisma.attendanceWorkSession.findUniqueOrThrow({
                  where: { id: session.id },
                })
              assert.deepEqual(saved.endedAt, endedAt)
              const leave = await savedLeave(request.id)
              assert.equal(leave.status, "APPROVED")
              assert.ok(
                leave.notifications.some(
                  ({ userId, type }) =>
                    userId === admin.user.id &&
                    type === "LEAVE_ATTENDANCE_CONFLICT",
                ),
              )
            }
          },
        )
      }
    },
  )
}
