import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { LeaveContext } from "./context.js"

/** Submission, overlap, review, approval, reversal and cancellation. */
export async function leaveLifecycle({
  api,
  employee,
  submit,
  prisma,
  admin,
  action,
  outsider,
  head,
  clock,
  superadmin,
  expectLeaveNotifications,
}: LeaveContext) {
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

  // PG-011-F001-A014-T003: overlapping active requests are rejected without
  // leaving request, snapshot, decision, or notification records behind.
  const overlapBefore = {
    requests: await prisma.leaveRequest.count({
      where: { employeeId: employee.employee.id },
    }),
    days: await prisma.leaveRequestDay.count({
      where: { employeeId: employee.employee.id },
    }),
    decisions: await prisma.leaveDecision.count({
      where: { requestId: created.request.id },
    }),
    notifications: await prisma.workflowNotification.count({
      where: { leaveRequestId: created.request.id },
    }),
  }
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
  assert.deepEqual(
    {
      requests: await prisma.leaveRequest.count({
        where: { employeeId: employee.employee.id },
      }),
      days: await prisma.leaveRequestDay.count({
        where: { employeeId: employee.employee.id },
      }),
      decisions: await prisma.leaveDecision.count({
        where: { requestId: created.request.id },
      }),
      notifications: await prisma.workflowNotification.count({
        where: { leaveRequestId: created.request.id },
      }),
    },
    overlapBefore,
  )

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

  clock.now = new Date("2026-11-18T08:00:00+08:00")
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

  const calendar = await api(
    employee,
    "/projects/calendar?scope=mine&month=2026-11",
  )
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

  clock.now = new Date("2026-11-17T08:00:00+08:00")
  const workedClock = await api(employee, "/attendance/me/clock-in", {
    body: {},
  })
  assert.equal(workedClock.status, 201, "worked clock in")
  const workedClockBody = (await workedClock.json()) as {
    workday: { activeSessionId: string }
  }
  clock.now = new Date("2026-11-17T17:00:00+08:00")
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
  await expectLeaveNotifications(created.request.id, {
    LEAVE_SUBMITTED: [head, superadmin],
    LEAVE_VERIFIED: [employee, admin, superadmin],
    LEAVE_APPROVED: [employee],
    LEAVE_REVERSED: [employee],
  })
  await expectLeaveNotifications(pending.request.id, {
    LEAVE_SUBMITTED: [head, superadmin],
    LEAVE_CANCELLED: [employee],
  })
}
