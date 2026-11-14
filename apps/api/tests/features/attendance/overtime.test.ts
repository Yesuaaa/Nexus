import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { startPgliteApp } from "../../support/pglite-app.js"
import { createAttendanceManagement } from "../../../src/features/attendance/attendance.management.js"
import { createAttendanceService } from "../../../src/features/attendance/attendance.service.js"
import {
  listWorkflowNotifications,
  readAllWorkflowNotifications,
} from "../../../src/features/request-workflow/workflow.notifications.js"

test(
  "combined requests validate overtime, preserve attendance, and enforce HR final approval",
  { timeout: 120000 },
  async (t) => {
    const { prisma } = await startPgliteApp(t)
    const management = createAttendanceManagement(
      () => new Date("2026-11-14T20:00:00+08:00"),
    )
    const department = await prisma.department.create({
      data: { name: "OT team" },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Eight hours",
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
    async function actor(name: string, role: "STAFF" | "ADMIN" = "STAFF") {
      return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: `${name}@ot.test`, passwordHash: "test", role },
        })
        const employee = await tx.employee.create({
          data: {
            fullName: name,
            employeeId: `OT-${name}`,
            userId: user.id,
            departmentId: department.id,
          },
        })
        await tx.attendancePolicyAssignment.create({
          data: {
            employeeId: employee.id,
            policyId: policy.id,
            effectiveFrom: new Date("2026-01-01"),
          },
        })
        return { user, employee }
      })
    }
    const staff = await actor("staff"),
      head = await actor("head"),
      hr = await actor("hr", "ADMIN"),
      outsider = await actor("outsider")
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: staff.employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
        endedAt: new Date("2026-11-13T20:00:00+08:00"),
        breaks: {
          create: {
            startedAt: new Date("2026-11-13T12:00:00+08:00"),
            endedAt: new Date("2026-11-13T13:00:00+08:00"),
            isPaid: false,
          },
        },
      },
    })
    const input = {
      type: "OVERTIME",
      requestKey: randomUUID(),
      startedAt: "2026-11-13T18:00:00+08:00",
      endedAt: "2026-11-13T20:00:00+08:00",
      reason: "Completed urgent client deliverables",
    }
    const { adjustment } = await management.requestAdjustment(
      staff.user.id,
      input,
    )
    assert.equal(adjustment.overtimeMinutes, 120)
    assert.equal(adjustment.sessionId, session.id)
    assert.equal(
      (await management.requestAdjustment(staff.user.id, input)).adjustment.id,
      adjustment.id,
    )
    await assert.rejects(
      management.requestAdjustment(staff.user.id, {
        ...input,
        requestKey: randomUUID(),
      }),
      /overlaps/,
    )
    await assert.rejects(
      management.requestAdjustment(staff.user.id, {
        ...input,
        requestKey: randomUUID(),
        startedAt: "2026-11-13T08:00:00+08:00",
      }),
      /completed attendance/,
    )
    await assert.rejects(
      management.reviewAdjustment(staff.user.id, adjustment.id, {
        decision: "APPROVED",
        note: "Own request approval",
      }),
    )
    await assert.rejects(
      management.reviewAdjustment(outsider.user.id, adjustment.id, {
        decision: "APPROVED",
        note: "Unauthorized approval",
      }),
    )
    await assert.rejects(
      management.requestAdjustment(staff.user.id, {
        ...input,
        requestKey: randomUUID(),
        startedAt: "2026-11-13T12:00:00+08:00",
        endedAt: "2026-11-13T13:00:00+08:00",
      }),
      /worked minute/,
    )
    await assert.rejects(
      management.requestAdjustment(staff.user.id, {
        ...input,
        requestKey: randomUUID(),
        startedAt: "2026-11-13T09:00:00+08:00",
        endedAt: "2026-11-13T18:00:00+08:00",
      }),
      /exceeds/,
    )
    await assert.rejects(
      management.reviewAdjustment(hr.user.id, adjustment.id, {
        decision: "APPROVED",
        note: "Attempting to skip department verification",
      }),
      /verification/,
    )
    const verified = await management.reviewAdjustment(
      head.user.id,
      adjustment.id,
      { decision: "APPROVED", note: "Work confirmed by department head" },
    )
    assert.equal(verified.adjustment.status, "VERIFIED")
    assert.equal(verified.adjustment.verifiedById, head.user.id)
    await assert.rejects(
      management.reviewAdjustment(head.user.id, adjustment.id, {
        decision: "APPROVED",
        note: "Trying final approval",
      }),
      /HR/,
    )
    const approved = await management.reviewAdjustment(
      hr.user.id,
      adjustment.id,
      { decision: "APPROVED", note: "HR confirms overtime approval" },
    )
    assert.equal(approved.adjustment.status, "APPROVED")
    assert.equal(approved.adjustment.reviewedById, hr.user.id)
    const after = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: session.id },
    })
    assert.equal(after.startedAt.toISOString(), session.startedAt.toISOString())
    assert.equal(after.endedAt?.toISOString(), session.endedAt?.toISOString())
    assert.equal(
      (
        await management.adjustments(hr.user.id, {
          scope: "team",
          type: "OVERTIME",
        })
      ).total,
      1,
    )
    assert.equal(
      (
        await management.adjustments(hr.user.id, {
          scope: "team",
          type: "CORRECTION",
        })
      ).total,
      0,
    )
    await assert.rejects(
      management.requestAdjustment(staff.user.id, {
        requestKey: randomUUID(),
        sessionId: session.id,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt!.toISOString(),
        reason: "Trying to change approved OT",
      }),
      /overtime/,
    )

    const automatic = await actor("automatic")
    let now = new Date("2026-11-14T09:00:00+08:00")
    const service = createAttendanceService(() => now)
    const clockedIn = await service.act(automatic.user.id, "clock-in", {})
    const sessionId = clockedIn.workday!.activeSessionId!
    now = new Date("2026-11-14T12:00:00+08:00")
    const onBreak = await service.act(automatic.user.id, "break-start", {
      sessionId,
    })
    now = new Date("2026-11-14T14:00:00+08:00")
    await service.act(automatic.user.id, "break-end", {
      sessionId,
      breakId: onBreak.workday!.activeBreakId!,
    })
    assert.equal(
      await prisma.attendanceAdjustment.count({
        where: { employeeId: automatic.employee.id },
      }),
      0,
    )
    now = new Date("2026-11-14T20:00:00+08:00")
    await service.act(automatic.user.id, "clock-out", { sessionId })
    const auto = await prisma.attendanceAdjustment.findFirstOrThrow({
      where: { employeeId: automatic.employee.id },
    })
    assert.equal(auto.status, "PENDING")
    assert.equal(auto.overtimeMinutes, 60)
    assert.equal(
      auto.proposedStartedAt.toISOString(),
      "2026-11-14T11:00:00.000Z",
    )
    await assert.rejects(
      service.act(automatic.user.id, "clock-out", { sessionId }),
    )
    assert.equal(
      await prisma.attendanceAdjustment.count({
        where: { employeeId: automatic.employee.id },
      }),
      1,
    )
    const headInbox = await listWorkflowNotifications(head.user.id)
    assert.ok(headInbox.notifications.some((item) => item.entityId === auto.id))
    assert.ok(
      (await listWorkflowNotifications(hr.user.id)).notifications.some(
        (item) => item.entityId === auto.id,
      ),
    )
    assert.equal(
      (await listWorkflowNotifications(outsider.user.id)).unreadCount,
      0,
    )
    const autoManagement = createAttendanceManagement(() => now)
    await autoManagement.reviewAdjustment(head.user.id, auto.id, {
      decision: "APPROVED",
      note: "Verified recorded excess work",
    })
    assert.ok(
      (await listWorkflowNotifications(hr.user.id)).notifications.some(
        (item) =>
          item.type === "ATTENDANCE_OVERTIME_VERIFIED" &&
          item.entityId === auto.id,
      ),
    )
    await autoManagement.reviewAdjustment(hr.user.id, auto.id, {
      decision: "APPROVED",
      note: "Final overtime approval",
    })
    await readAllWorkflowNotifications(hr.user.id)
    assert.equal((await listWorkflowNotifications(hr.user.id)).unreadCount, 0)
    now = new Date("2026-11-14T21:00:00+08:00")
    const resumed = await service.act(automatic.user.id, "clock-in", {})
    now = new Date("2026-11-14T22:00:00+08:00")
    await service.act(automatic.user.id, "clock-out", {
      sessionId: resumed.workday!.activeSessionId!,
    })
    const requests = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: automatic.employee.id },
    })
    assert.equal(requests.length, 2)
    assert.equal(
      requests.reduce((sum, item) => sum + item.overtimeMinutes, 0),
      120,
    )
    const latest = requests.find((item) => item.id !== auto.id)!
    await autoManagement.reviewAdjustment(head.user.id, latest.id, {
      decision: "REJECTED",
      note: "Excess work was not authorized",
    })
    now = new Date("2026-11-14T23:00:00+08:00")
    const overnight = await service.act(automatic.user.id, "clock-in", {})
    now = new Date("2026-11-15T02:00:00+08:00")
    await service.act(automatic.user.id, "clock-out", {
      sessionId: overnight.workday!.activeSessionId!,
    })
    const all = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: automatic.employee.id },
    })
    assert.equal(all.length, 3)
    assert.equal(
      all.find((item) => item.sessionId === overnight.workday!.activeSessionId)!
        .overtimeMinutes,
      180,
    )
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: outsider.user.id },
    })
    assert.equal(
      (await listWorkflowNotifications(head.user.id)).notifications.length,
      0,
    )
    assert.equal(
      (await listWorkflowNotifications(automatic.user.id)).unreadCount,
      0,
    )
    now = new Date("2026-11-15T09:00:00+08:00")
    const short = await service.act(outsider.user.id, "clock-in", {})
    now = new Date("2026-11-15T10:00:00+08:00")
    await service.act(outsider.user.id, "clock-out", {
      sessionId: short.workday!.activeSessionId!,
    })
    assert.equal(
      await prisma.attendanceAdjustment.count({
        where: { employeeId: outsider.employee.id },
      }),
      0,
    )
  },
)
