import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test, type TestContext } from "node:test"
import { startPgliteApp } from "../../support/pglite-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { createAttendanceManagement } from "../../../src/features/attendance/attendance.management.js"
import { createAttendanceService } from "../../../src/features/attendance/attendance.service.js"
import {
  listWorkflowNotifications,
  readAllWorkflowNotifications,
} from "../../../src/features/request-workflow/workflow.notifications.js"

const overtimeClock = new Date("2026-11-16T20:00:00+08:00")

async function overtimeWorld(t: TestContext) {
  const { prisma, base } = await startPgliteApp(t, {
    app: { attendanceClock: () => overtimeClock },
  })
  const department = await prisma.department.create({
    data: { name: "PG-012 Overtime department" },
  })
  const outside = await prisma.department.create({
    data: { name: "PG-012 Overtime outside department" },
  })
  const policy = await prisma.attendancePolicy.create({
    data: {
      name: "PG-012 Eight hour policy",
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

  async function account(
    name: string,
    role: Role,
    departmentId = department.id,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${name}-${randomUUID()}@pg012-overtime.test`,
        fullName: name,
        passwordHash: "synthetic-test-only",
        role,
        departmentId,
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: `EXP-PG012-${randomUUID().slice(0, 12)}`,
        fullName: name,
        userId: user.id,
        departmentId,
      },
    })
    const assignment = await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    })
    return {
      user,
      employee,
      assignment,
      token: (await issueSession(user)).token,
    }
  }

  async function session(
    employeeId: string,
    startedAt = "2026-11-14T09:00:00+08:00",
    endedAt: string | null = "2026-11-14T19:00:00+08:00",
    unpaidBreak?: { startedAt: string; endedAt: string },
  ) {
    return prisma.attendanceWorkSession.create({
      data: {
        employeeId,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
        ...(unpaidBreak
          ? {
              breaks: {
                create: {
                  startedAt: new Date(unpaidBreak.startedAt),
                  endedAt: new Date(unpaidBreak.endedAt),
                  isPaid: false,
                },
              },
            }
          : {}),
      },
    })
  }

  return { prisma, base, department, outside, policy, account, session }
}

async function overtimeRequest(
  base: string,
  actor: { token: string } | null,
  path: string,
  method = "GET",
  body?: unknown,
) {
  return fetch(`${base}/attendance${path}`, {
    method,
    headers: {
      ...(actor ? { authorization: `Bearer ${actor.token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function manualOvertimeBody(startedAt: string, endedAt: string) {
  return {
    type: "OVERTIME",
    requestKey: randomUUID(),
    startedAt,
    endedAt,
    reason: "Recorded eligible overtime for QA",
  }
}

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
    async function actor(
      name: string,
      role: "STAFF" | "ADMIN" | "SUPERADMIN" = "STAFF",
    ) {
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
      !(await listWorkflowNotifications(hr.user.id)).notifications.some(
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
    const superadmin = await actor("superadmin", "SUPERADMIN")

    // PG-012-F001-A013-T001: preserve the pending-stage Superadmin override
    // above and verify the same policy after a Department Head has verified.
    const verifiedOverrideActor = await actor("verified-override")
    await prisma.attendanceWorkSession.create({
      data: {
        employeeId: verifiedOverrideActor.employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
        endedAt: new Date("2026-11-13T19:00:00+08:00"),
      },
    })
    const verifiedOverrideRequest = await management.requestAdjustment(
      verifiedOverrideActor.user.id,
      manualOvertimeBody(
        "2026-11-13T18:00:00+08:00",
        "2026-11-13T19:00:00+08:00",
      ),
    )
    const headVerification = await management.reviewAdjustment(
      head.user.id,
      verifiedOverrideRequest.adjustment.id,
      { decision: "APPROVED", note: "Department verified the recorded work" },
    )
    assert.equal(headVerification.adjustment.status, "VERIFIED")
    const verifiedStageOverride = await management.reviewAdjustment(
      superadmin.user.id,
      verifiedOverrideRequest.adjustment.id,
      { decision: "REJECTED", note: "Superadmin final verified-stage review" },
    )
    assert.equal(verifiedStageOverride.adjustment.status, "REJECTED")
    assert.equal(verifiedStageOverride.adjustment.verifiedById, head.user.id)
    assert.equal(
      verifiedStageOverride.adjustment.reviewedById,
      superadmin.user.id,
    )
    assert.equal(
      verifiedStageOverride.adjustment.reviewNote,
      "Superadmin final verified-stage review",
    )
    const verifiedApprovalActor = await actor("verified-approval")
    await prisma.attendanceWorkSession.create({
      data: {
        employeeId: verifiedApprovalActor.employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
        endedAt: new Date("2026-11-13T19:00:00+08:00"),
      },
    })
    const verifiedApprovalRequest = await management.requestAdjustment(
      verifiedApprovalActor.user.id,
      manualOvertimeBody(
        "2026-11-13T18:00:00+08:00",
        "2026-11-13T19:00:00+08:00",
      ),
    )
    await management.reviewAdjustment(
      head.user.id,
      verifiedApprovalRequest.adjustment.id,
      { decision: "APPROVED", note: "Department verified for final approval" },
    )
    const verifiedStageApproval = await management.reviewAdjustment(
      superadmin.user.id,
      verifiedApprovalRequest.adjustment.id,
      { decision: "APPROVED", note: "Superadmin approves verified overtime" },
    )
    assert.equal(verifiedStageApproval.adjustment.status, "APPROVED")
    assert.equal(verifiedStageApproval.adjustment.verifiedById, head.user.id)
    assert.equal(
      verifiedStageApproval.adjustment.reviewedById,
      superadmin.user.id,
    )

    const pending = requests.find((item) => item.status === "PENDING")!
    assert.ok(pending)
    const hidden = await autoManagement.adjustments(hr.user.id, {
      scope: "team",
      status: "PENDING",
    })
    assert.equal(hidden.total, 0)
    const visible = await autoManagement.adjustments(superadmin.user.id, {
      scope: "team",
      status: "PENDING",
    })
    assert.ok(
      visible.adjustments.some(
        (item) =>
          item.id === pending.id &&
          item.capabilities.approve &&
          item.capabilities.reject,
      ),
    )
    const override = await autoManagement.reviewAdjustment(
      superadmin.user.id,
      pending.id,
      {
        decision: "APPROVED",
        note: "Superadmin directly approves recorded overtime",
      },
    )
    assert.equal(override.adjustment.status, "APPROVED")
    assert.equal(override.adjustment.verifiedById, null)
    assert.equal(
      requests.reduce((sum, item) => sum + item.overtimeMinutes, 0),
      120,
    )
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
    const overnightRequest = all.find(
      (item) => item.sessionId === overnight.workday!.activeSessionId,
    )!
    await autoManagement.reviewAdjustment(
      superadmin.user.id,
      overnightRequest.id,
      {
        decision: "REJECTED",
        note: "Superadmin rejects pending excess work",
      },
    )
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
    const requesterInbox = await listWorkflowNotifications(automatic.user.id)
    assert.deepEqual(
      requesterInbox.notifications
        .map(({ type, entityId, readAt }) => [type, entityId, readAt])
        .sort(),
      [
        ["ATTENDANCE_OVERTIME_APPROVED", auto.id, null],
        ["ATTENDANCE_OVERTIME_APPROVED", pending.id, null],
        ["ATTENDANCE_OVERTIME_REJECTED", overnightRequest.id, null],
        ["ATTENDANCE_OVERTIME_VERIFIED", auto.id, null],
      ].sort(),
    )
    assert.equal(
      requesterInbox.unreadCount,
      requesterInbox.notifications.length,
    )
    now = new Date("2026-11-15T09:00:00+08:00")
    const short = await service.act(outsider.user.id, "clock-in", {})
    now = new Date("2026-11-15T10:00:00+08:00")
    const closedShort = await service.act(outsider.user.id, "clock-out", {
      sessionId: short.workday!.activeSessionId!,
    })
    assert.equal(closedShort.workday?.workedMinutes, 60)
    assert.equal(closedShort.workday?.requiredMinutes, 480)
    assert.equal(closedShort.workday?.excessMinutes, 0)
    assert.equal(
      await prisma.attendanceAdjustment.count({
        where: { employeeId: outsider.employee.id },
      }),
      0,
    )
  },
)

test(
  "[PG-012-F001-A001-T003] API rejects anonymous and USER overtime reads",
  { timeout: 120000 },
  async (t) => {
    const world = await overtimeWorld(t)
    const staff = await world.account("read-owner", "STAFF")
    const user = await world.account("workforce-user", "USER")
    const adjustment = await world.prisma.attendanceAdjustment.create({
      data: {
        requestKey: randomUUID(),
        type: "OVERTIME",
        overtimeMinutes: 60,
        employeeId: staff.employee.id,
        requestedById: staff.user.id,
        proposedStartedAt: new Date("2026-11-14T18:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-14T19:00:00+08:00"),
        reason: "Private overtime detail for access test",
      },
    })
    const listPath = "/adjustments?scope=mine&type=OVERTIME"
    const detailPath = `/adjustments/${adjustment.id}`

    assert.equal(
      (await overtimeRequest(world.base, null, listPath)).status,
      401,
    )
    assert.equal(
      (await overtimeRequest(world.base, null, detailPath)).status,
      401,
    )
    assert.equal(
      (await overtimeRequest(world.base, user, listPath)).status,
      403,
    )
    const deniedDetail = await overtimeRequest(world.base, user, detailPath)
    assert.equal(deniedDetail.status, 403)
    const deniedBody = await deniedDetail.text()
    assert.equal(deniedBody.includes(adjustment.reason), false)
    assert.equal(deniedBody.includes(staff.employee.fullName), false)
  },
)

test(
  "[PG-012-F001-A003-T002] department Head list and detail remain scoped",
  { timeout: 120000 },
  async (t) => {
    const world = await overtimeWorld(t)
    const head = await world.account("scope-head", "STAFF")
    const inside = await world.account("scope-inside", "STAFF")
    const outside = await world.account(
      "scope-outside",
      "STAFF",
      world.outside.id,
    )
    await world.prisma.department.update({
      where: { id: world.department.id },
      data: { headId: head.user.id },
    })
    async function row(employee: typeof inside, reason: string) {
      return world.prisma.attendanceAdjustment.create({
        data: {
          requestKey: randomUUID(),
          type: "OVERTIME",
          overtimeMinutes: 60,
          employeeId: employee.employee.id,
          requestedById: employee.user.id,
          proposedStartedAt: new Date("2026-11-14T18:00:00+08:00"),
          proposedEndedAt: new Date("2026-11-14T19:00:00+08:00"),
          reason,
        },
      })
    }
    const visible = await row(inside, "Visible department overtime")
    const hidden = await row(outside, "Private outside overtime reason")

    const response = await overtimeRequest(
      world.base,
      head,
      "/adjustments?scope=team&type=OVERTIME",
    )
    assert.equal(response.status, 200, await response.clone().text())
    const list = (await response.json()) as {
      adjustments: { id: string; type: string }[]
      total: number
    }
    assert.equal(list.total, 1)
    assert.deepEqual(list.adjustments, [
      {
        ...list.adjustments[0],
        id: visible.id,
        type: "OVERTIME",
      },
    ])
    assert.equal(
      list.adjustments.some(({ id }) => id === hidden.id),
      false,
    )

    const hiddenDetail = await overtimeRequest(
      world.base,
      head,
      `/adjustments/${hidden.id}`,
    )
    assert.equal(hiddenDetail.status, 404)
    const body = await hiddenDetail.text()
    assert.equal(body.includes(hidden.reason), false)
    assert.equal(body.includes(outside.employee.fullName), false)
  },
)

test(
  "[PG-012-F001-A010-T002] current Department Head can reject pending overtime",
  { timeout: 120000 },
  async (t) => {
    const world = await overtimeWorld(t)
    const staff = await world.account("reject-pending-staff", "STAFF")
    const head = await world.account("reject-pending-head", "STAFF")
    await world.prisma.department.update({
      where: { id: world.department.id },
      data: { headId: head.user.id },
    })
    await world.session(staff.employee.id)
    const submitted = await overtimeRequest(
      world.base,
      staff,
      "/adjustments",
      "POST",
      manualOvertimeBody(
        "2026-11-14T18:00:00+08:00",
        "2026-11-14T19:00:00+08:00",
      ),
    )
    assert.equal(submitted.status, 201, await submitted.clone().text())
    const { adjustment } = (await submitted.json()) as {
      adjustment: { id: string; status: string }
    }
    assert.equal(adjustment.status, "PENDING")

    const rejected = await overtimeRequest(
      world.base,
      head,
      `/adjustments/${adjustment.id}/review`,
      "POST",
      { decision: "REJECTED", note: "Head rejects recorded overtime" },
    )
    assert.equal(rejected.status, 200, await rejected.clone().text())
    const body = (await rejected.json()) as {
      adjustment: {
        status: string
        verifiedById: string | null
        reviewedById: string | null
        reviewNote: string | null
      }
    }
    assert.equal(body.adjustment.status, "REJECTED")
    assert.equal(body.adjustment.verifiedById, null)
    assert.equal(body.adjustment.reviewedById, head.user.id)
    assert.equal(body.adjustment.reviewNote, "Head rejects recorded overtime")
    const persisted = await world.prisma.attendanceAdjustment.findUniqueOrThrow(
      {
        where: { id: adjustment.id },
      },
    )
    assert.equal(persisted.status, "REJECTED")
    assert.equal(persisted.reviewedById, head.user.id)
  },
)

test(
  "[PG-012-F001-A011-T002] HR can reject verified overtime without changing attendance",
  { timeout: 120000 },
  async (t) => {
    const world = await overtimeWorld(t)
    const staff = await world.account("reject-verified-staff", "STAFF")
    const head = await world.account("reject-verified-head", "STAFF")
    const hr = await world.account("reject-verified-hr", "ADMIN")
    await world.prisma.department.update({
      where: { id: world.department.id },
      data: { headId: head.user.id },
    })
    const sourceSession = await world.session(staff.employee.id)
    const request = await overtimeRequest(
      world.base,
      staff,
      "/adjustments",
      "POST",
      manualOvertimeBody(
        "2026-11-14T18:00:00+08:00",
        "2026-11-14T19:00:00+08:00",
      ),
    )
    assert.equal(request.status, 201, await request.clone().text())
    const { adjustment } = (await request.json()) as {
      adjustment: { id: string }
    }
    const verified = await overtimeRequest(
      world.base,
      head,
      `/adjustments/${adjustment.id}/review`,
      "POST",
      { decision: "APPROVED", note: "Head verifies recorded overtime" },
    )
    assert.equal(verified.status, 200, await verified.clone().text())
    assert.equal(
      ((await verified.json()) as { adjustment: { status: string } }).adjustment
        .status,
      "VERIFIED",
    )

    const rejected = await overtimeRequest(
      world.base,
      hr,
      `/adjustments/${adjustment.id}/review`,
      "POST",
      { decision: "REJECTED", note: "HR rejects verified overtime" },
    )
    assert.equal(rejected.status, 200, await rejected.clone().text())
    const body = (await rejected.json()) as {
      adjustment: {
        status: string
        verifiedById: string | null
        verificationNote: string | null
        reviewedById: string | null
        reviewNote: string | null
      }
    }
    assert.equal(body.adjustment.status, "REJECTED")
    assert.equal(body.adjustment.verifiedById, head.user.id)
    assert.equal(
      body.adjustment.verificationNote,
      "Head verifies recorded overtime",
    )
    assert.equal(body.adjustment.reviewedById, hr.user.id)
    assert.equal(body.adjustment.reviewNote, "HR rejects verified overtime")
    const persistedSession =
      await world.prisma.attendanceWorkSession.findUniqueOrThrow({
        where: { id: sourceSession.id },
      })
    assert.equal(
      persistedSession.startedAt.toISOString(),
      sourceSession.startedAt.toISOString(),
    )
    assert.equal(
      persistedSession.endedAt?.toISOString(),
      sourceSession.endedAt?.toISOString(),
    )
  },
)

test(
  "[PG-012-F001-A017-T001] hidden and missing overtime details return no private projection",
  { timeout: 120000 },
  async (t) => {
    const world = await overtimeWorld(t)
    const reader = await world.account("private-reader", "STAFF")
    const subject = await world.account("private-subject", "STAFF")
    const privateRow = await world.prisma.attendanceAdjustment.create({
      data: {
        requestKey: randomUUID(),
        type: "OVERTIME",
        overtimeMinutes: 90,
        employeeId: subject.employee.id,
        requestedById: subject.user.id,
        proposedStartedAt: new Date("2026-11-14T17:30:00+08:00"),
        proposedEndedAt: new Date("2026-11-14T19:00:00+08:00"),
        reason: "Private overtime details for another employee",
      },
    })

    for (const id of [privateRow.id, randomUUID()]) {
      const response = await overtimeRequest(
        world.base,
        reader,
        `/adjustments/${id}`,
      )
      assert.equal(response.status, 404)
      const body = await response.text()
      assert.equal(body.includes(privateRow.reason), false)
      assert.equal(body.includes(subject.employee.fullName), false)
    }
  },
)

test(
  "[PG-012-F001-A018-T002] overtime interval and worked-minute boundaries",
  { timeout: 180000 },
  async (t) => {
    const world = await overtimeWorld(t)
    async function subject(
      name: string,
      breakRange?: { startedAt: string; endedAt: string },
    ) {
      const actor = await world.account(name, "STAFF")
      await world.session(
        actor.employee.id,
        "2026-11-14T09:00:00+08:00",
        "2026-11-14T19:00:00+08:00",
        breakRange,
      )
      return actor
    }
    async function submit(
      actor: { token: string },
      startedAt: string,
      endedAt: string,
    ) {
      return overtimeRequest(
        world.base,
        actor,
        "/adjustments",
        "POST",
        manualOvertimeBody(startedAt, endedAt),
      )
    }

    const reversedActor = await subject("boundary-reversed")
    const reversed = await submit(
      reversedActor,
      "2026-11-14T19:00:00+08:00",
      "2026-11-14T18:00:00+08:00",
    )
    assert.equal(reversed.status, 400)

    const futureActor = await subject("boundary-future")
    const future = await submit(
      futureActor,
      "2026-11-17T09:00:00+08:00",
      "2026-11-17T10:00:00+08:00",
    )
    assert.equal(future.status, 400)

    const outsideActor = await subject("boundary-outside-session")
    const outside = await submit(
      outsideActor,
      "2026-11-14T20:00:00+08:00",
      "2026-11-14T21:00:00+08:00",
    )
    assert.equal(outside.status, 409)

    const openDayActor = await subject("boundary-open-workday")
    await world.session(
      openDayActor.employee.id,
      "2026-11-14T20:00:00+08:00",
      null,
    )
    const openWorkday = await submit(
      openDayActor,
      "2026-11-14T18:00:00+08:00",
      "2026-11-14T19:00:00+08:00",
    )
    assert.equal(openWorkday.status, 409)

    const leaveActor = await subject("boundary-approved-leave")
    await world.prisma.leaveRequest.create({
      data: {
        requestKey: randomUUID(),
        employeeId: leaveActor.employee.id,
        requestedById: leaveActor.user.id,
        type: "ANNUAL",
        reason: "Approved leave blocks overtime overlap",
        startDate: new Date("2026-11-14T00:00:00.000Z"),
        endDate: new Date("2026-11-14T00:00:00.000Z"),
        status: "APPROVED",
        days: {
          create: {
            employeeId: leaveActor.employee.id,
            assignmentId: leaveActor.assignment.id,
            workDate: new Date("2026-11-14T00:00:00.000Z"),
            timeZone: "Asia/Manila",
            policyName: "PG-012 Eight hour policy",
            baseRequiredMinutes: 480,
            leaveMinutes: 480,
          },
        },
      },
    })
    const leaveOverlap = await submit(
      leaveActor,
      "2026-11-14T18:00:00+08:00",
      "2026-11-14T19:00:00+08:00",
    )
    assert.equal(leaveOverlap.status, 409)

    const subMinuteActor = await subject("boundary-59999ms", {
      startedAt: "2026-11-14T18:58:00.001+08:00",
      endedAt: "2026-11-14T18:59:00.002+08:00",
    })
    const subMinute = await submit(
      subMinuteActor,
      "2026-11-14T18:58:00.000+08:00",
      "2026-11-14T19:00:00.000+08:00",
    )
    assert.equal(subMinute.status, 400)

    const exactMinuteActor = await subject("boundary-60000ms", {
      startedAt: "2026-11-14T18:58:00.000+08:00",
      endedAt: "2026-11-14T18:59:00.000+08:00",
    })
    const exactMinute = await submit(
      exactMinuteActor,
      "2026-11-14T18:58:00.000+08:00",
      "2026-11-14T19:00:00.000+08:00",
    )
    assert.equal(exactMinute.status, 201, await exactMinute.clone().text())
    const exactBody = (await exactMinute.json()) as {
      adjustment: { overtimeMinutes: number; status: string }
    }
    assert.equal(exactBody.adjustment.overtimeMinutes, 1)
    assert.equal(exactBody.adjustment.status, "PENDING")

    const overlapActor = await subject("boundary-overlap")
    const first = await submit(
      overlapActor,
      "2026-11-14T18:58:00+08:00",
      "2026-11-14T19:00:00+08:00",
    )
    assert.equal(first.status, 201, await first.clone().text())
    const overlapping = await submit(
      overlapActor,
      "2026-11-14T18:59:00+08:00",
      "2026-11-14T19:00:00+08:00",
    )
    assert.equal(overlapping.status, 409)

    const excessActor = await subject("boundary-excess")
    const overExcess = await submit(
      excessActor,
      "2026-11-14T16:59:00+08:00",
      "2026-11-14T19:00:00+08:00",
    )
    assert.equal(overExcess.status, 409)

    assert.equal(
      await world.prisma.attendanceAdjustment.count({
        where: {
          requestedById: {
            in: [
              reversedActor.user.id,
              futureActor.user.id,
              outsideActor.user.id,
              openDayActor.user.id,
              leaveActor.user.id,
              subMinuteActor.user.id,
              excessActor.user.id,
            ],
          },
        },
      }),
      0,
    )
    assert.equal(
      await world.prisma.attendanceAdjustment.count({
        where: { requestedById: exactMinuteActor.user.id, type: "OVERTIME" },
      }),
      1,
    )
    assert.equal(
      await world.prisma.attendanceAdjustment.count({
        where: { requestedById: overlapActor.user.id, type: "OVERTIME" },
      }),
      1,
    )
  },
)
