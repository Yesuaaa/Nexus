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

    const calendar = await api(employee, "/projects/calendar?scope=mine")
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
    await prisma.employee.update({
      where: { id: employee.employee.id },
      data: { departmentId: outsideDepartment.id },
    })
    await prisma.department.update({
      where: { id: outsideDepartment.id },
      data: { headId: outsider.user.id },
    })
    assert.equal(
      (await action(admin, transferred.request.id, "approve", 2)).status,
      409,
    )
    assert.equal(
      (await action(head, transferred.request.id, "verify", 2)).status,
      403,
    )
    assert.equal(
      (await action(outsider, transferred.request.id, "verify", 2)).status,
      200,
    )
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

    // Clock-out recovery records a conflict and alerts HR instead of trapping an open shift.
    now = new Date("2026-11-23T23:00:00+08:00")
    const overnight = await api(employee, "/attendance/me/clock-in", {
      body: {},
    })
    assert.equal(overnight.status, 201)
    const overnightBody = (await overnight.json()) as {
      workday: { activeSessionId: string }
    }
    now = new Date("2026-11-24T02:00:00+08:00")
    const closed = await api(employee, "/attendance/me/clock-out", {
      body: { sessionId: overnightBody.workday.activeSessionId },
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
  },
)
