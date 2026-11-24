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
      policyId = policy.id,
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
          policyId,
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
      actor: Pick<Account, "token">,
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
    function savedLeave(requestId: string) {
      return prisma.leaveRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          days: { orderBy: { id: "asc" } },
          decisions: { orderBy: { id: "asc" } },
          notifications: { orderBy: { id: "asc" } },
        },
      })
    }

    async function expectLeaveReadDenied(response: Response) {
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), {
        error: "Leave request not found",
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
    async function expectLeaveNotifications(
      leaveRequestId: string,
      recipientsByEvent: Record<string, Account[]>,
    ) {
      const notices = await prisma.workflowNotification.findMany({
        where: { leaveRequestId },
        select: { type: true, userId: true },
        orderBy: [{ type: "asc" }, { userId: "asc" }],
      })
      const expected = Object.keys(recipientsByEvent)
        .sort()
        .flatMap((type) =>
          recipientsByEvent[type]
            .map(({ user }) => user.id)
            .sort()
            .map((userId) => ({ type, userId })),
        )
      assert.deepEqual(notices, expected)
    }
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

    // A department move requires the receiving Head to verify again.
    const transferred = await submit("2026-11-24", "2026-11-24")
    const transferredPath = `/leave/requests/${transferred.request.id}`
    const originalVerification = {
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "Confirmed by the original Department Head",
    }
    assert.equal(
      (
        await api(head, `${transferredPath}/verify`, {
          body: originalVerification,
        })
      ).status,
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
    await t.test("decision replay checks department scope", async () => {
      const before = await savedLeave(transferred.request.id)
      await expectLeaveReadDenied(await api(head, transferredPath))
      await expectLeaveReadDenied(
        await api(head, `${transferredPath}/verify`, {
          body: originalVerification,
        }),
      )
      await expectLeaveReadDenied(
        await api(head, `${transferredPath}/verify`, {
          body: { ...originalVerification, note: "Changed after transfer" },
        }),
      )

      const detail = await api(outsider, transferredPath)
      assert.equal(detail.status, 200)
      const retry = await api(outsider, `${transferredPath}/verify`, {
        body: reverification,
      })
      assert.equal(retry.status, 200)
      assert.deepEqual(await retry.json(), await detail.json())
      assert.deepEqual(await savedLeave(transferred.request.id), before)
    })
    assert.equal(
      (await api(employee, `/leave/requests/${transferred.request.id}`)).status,
      200,
    )
    const filtered = await api(
      employee,
      "/leave/requests?scope=mine&from=2026-12-01&to=2026-12-02",
    )
    assert.equal(((await filtered.json()) as { total: number }).total, 0)

    // PG-011-F001-A004-T002 and A005-T002: search is normalized, scoped to
    // supported text fields, bounded, and combined with the API filters.
    const searchActor = await account("pg011-searcher", "STAFF")
    const searchable = await api(searchActor, "/leave/requests", {
      body: {
        requestKey: randomUUID(),
        type: "SICK",
        reason: "Search Needle phrase",
        startDate: "2026-12-08",
        endDate: "2026-12-08",
      },
    })
    assert.equal(searchable.status, 201, await searchable.clone().text())
    const searchableId = (
      (await searchable.json()) as { request: { id: string } }
    ).request.id
    assert.equal((await action(head, searchableId, "verify", 1)).status, 200)
    assert.equal((await action(admin, searchableId, "approve", 2)).status, 200)
    for (const value of ["needle", "pg011-searcher", "LEAVE-pg011-searcher"]) {
      const result = await api(
        searchActor,
        `/leave/requests?scope=mine&search=${encodeURIComponent(value)}`,
      )
      assert.equal(result.status, 200, await result.clone().text())
      assert.equal(((await result.json()) as { total: number }).total, 1, value)
    }
    const maximumSearch = await api(
      searchActor,
      `/leave/requests?scope=mine&search=${"x".repeat(100)}`,
    )
    assert.equal(maximumSearch.status, 200)
    assert.equal(
      (
        await api(
          searchActor,
          `/leave/requests?scope=mine&search=${"x".repeat(101)}`,
        )
      ).status,
      400,
    )
    const combinedFilters = await api(
      searchActor,
      "/leave/requests?scope=mine&type=SICK&status=APPROVED",
    )
    assert.equal(combinedFilters.status, 200)
    assert.deepEqual(
      (
        (await combinedFilters.json()) as {
          requests: { id: string }[]
          total: number
        }
      ).requests.map(({ id }) => id),
      [searchableId],
    )
    assert.equal(
      (await api(searchActor, "/leave/requests?scope=mine&type=VACATION"))
        .status,
      400,
    )
    assert.equal(
      (await api(searchActor, "/leave/requests?scope=mine&status=UNKNOWN"))
        .status,
      400,
    )

    // PG-011-F001-A006-T001: API date filters include request endpoints,
    // require paired ordered values, and accept overlap at either boundary.
    const dateActor = await account("pg011-date-filter", "STAFF")
    const dateIds: string[] = []
    for (const [startDate, endDate] of [
      ["2026-12-10", "2026-12-10"],
      ["2026-12-11", "2026-12-12"],
      ["2026-12-14", "2026-12-14"],
    ]) {
      dateIds.push((await submit(startDate, endDate, dateActor)).request.id)
    }
    const dateWindow = await api(
      dateActor,
      "/leave/requests?scope=mine&from=2026-12-10&to=2026-12-12",
    )
    assert.equal(dateWindow.status, 200)
    const dateWindowBody = (await dateWindow.json()) as {
      requests: { id: string }[]
    }
    assert.deepEqual(
      dateWindowBody.requests.map(({ id }) => id).sort(),
      dateIds.slice(0, 2).sort(),
    )
    const inclusiveEnd = await api(
      dateActor,
      "/leave/requests?scope=mine&from=2026-12-12&to=2026-12-12",
    )
    assert.deepEqual(
      (
        (await inclusiveEnd.json()) as { requests: { id: string }[] }
      ).requests.map(({ id }) => id),
      [dateIds[1]],
    )
    for (const query of [
      "/leave/requests?scope=mine&from=2026-12-10",
      "/leave/requests?scope=mine&to=2026-12-12",
      "/leave/requests?scope=mine&from=2026-12-13&to=2026-12-10",
    ]) {
      assert.equal((await api(dateActor, query)).status, 400, query)
    }

    // PG-011-F001-A014-T001: direct API boundaries reject malformed input
    // without leaving request snapshots, decisions, or notices.
    const boundaryActor = await account("pg011-boundaries", "STAFF")
    const boundaryBase = {
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason: "Valid request reason",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
    }
    async function boundaryCounts() {
      return {
        requests: await prisma.leaveRequest.count({
          where: { requestedById: boundaryActor.user.id },
        }),
        days: await prisma.leaveRequestDay.count({
          where: { employeeId: boundaryActor.employee.id },
        }),
        decisions: await prisma.leaveDecision.count({
          where: { actorId: boundaryActor.user.id },
        }),
        notifications: await prisma.workflowNotification.count(),
      }
    }
    const invalidBoundaryInputs: { label: string; body: object }[] = [
      { label: "extra field", body: { ...boundaryBase, unsupported: true } },
      {
        label: "malformed UUID",
        body: { ...boundaryBase, requestKey: "not-a-uuid" },
      },
      {
        label: "unsupported type",
        body: { ...boundaryBase, type: "VACATION" },
      },
      {
        label: "four-character reason",
        body: { ...boundaryBase, reason: "four" },
      },
      {
        label: "2001-character reason",
        body: { ...boundaryBase, reason: "x".repeat(2001) },
      },
      {
        label: "invalid non-leap date",
        body: {
          ...boundaryBase,
          startDate: "2027-02-29",
          endDate: "2027-02-29",
        },
      },
      {
        label: "reversed date range",
        body: {
          ...boundaryBase,
          startDate: "2026-12-09",
          endDate: "2026-12-08",
        },
      },
      {
        label: "367 inclusive dates",
        body: {
          ...boundaryBase,
          startDate: "2027-01-01",
          endDate: "2028-01-02",
        },
      },
    ]
    for (const { label, body } of invalidBoundaryInputs) {
      const before = await boundaryCounts()
      const result = await api(boundaryActor, "/leave/requests", { body })
      assert.equal(result.status, 400, label)
      assert.deepEqual(await boundaryCounts(), before, label)
    }
    for (const [label, body] of [
      [
        "five-character reason",
        { ...boundaryBase, requestKey: randomUUID(), reason: "12345" },
      ],
      [
        "2000-character reason",
        {
          ...boundaryBase,
          requestKey: randomUUID(),
          reason: "x".repeat(2000),
          startDate: "2026-12-09",
          endDate: "2026-12-09",
        },
      ],
      [
        "valid leap day",
        {
          ...boundaryBase,
          requestKey: randomUUID(),
          startDate: "2028-02-29",
          endDate: "2028-02-29",
        },
      ],
      [
        "366 inclusive dates",
        {
          ...boundaryBase,
          requestKey: randomUUID(),
          startDate: "2027-01-01",
          endDate: "2028-01-01",
        },
      ],
    ] as const) {
      const result = await api(boundaryActor, "/leave/requests", { body })
      assert.equal(result.status, 201, label)
    }

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

    async function expectAttendanceConflict(
      subject: Account,
      request: { id: string; version: number },
    ) {
      const readAudit = () =>
        prisma.attendanceAudit.findMany({
          where: { employeeId: subject.employee.id },
          orderBy: { id: "asc" },
        })
      const before = await savedLeave(request.id)
      const audit = await readAudit()
      const response = await action(
        superadmin,
        request.id,
        "approve",
        request.version,
      )
      assert.equal(response.status, 409, await response.clone().text())
      assert.match(await response.text(), /Resolve recorded attendance/)
      assert.deepEqual(await savedLeave(request.id), before)
      assert.deepEqual(await readAudit(), audit)
    }

    await t.test(
      "a December 7 open shift permits December 10 leave",
      async () => {
        const subject = await account("open-shift-leave", "STAFF")
        now = new Date("2026-12-07T09:00:00+08:00")
        const clockIn = await api(subject, "/attendance/me/clock-in", {
          body: {},
        })
        assert.equal(clockIn.status, 201, await clockIn.text())
        const sameDay = await submit("2026-12-07", "2026-12-07", subject)
        const future = await submit("2026-12-10", "2026-12-10", subject)

        await expectAttendanceConflict(subject, sameDay.request)
        now = new Date("2026-12-07T10:00:00+08:00")
        await expectAttendanceConflict(subject, sameDay.request)
        const approved = await action(
          superadmin,
          future.request.id,
          "approve",
          1,
        )
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
              now = suspended ? new Date("2026-12-10T08:00:00-05:00") : cutoff
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
        const before = await savedLeave(request.id)
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
        assert.deepEqual(await savedLeave(request.id), before)

        const rejection = await action(admin, request.id, "reject", 2)
        assert.equal(rejection.status, 200, await rejection.clone().text())
        const rejected = (await rejection.json()) as {
          request: { status: string }
        }
        assert.equal(rejected.request.status, "REJECTED")
      },
    )

    const setRequesterActive = (subject: Account, isActive: boolean) =>
      api(superadmin, `/users/${subject.user.id}/status`, {
        method: "PATCH",
        body: { isActive },
      })

    async function verifiedLeave(subject: Account) {
      const { request } = await submit("2026-12-07", "2026-12-07", subject)
      const verified = await action(head, request.id, "verify", request.version)
      assert.equal(verified.status, 200, await verified.text())
      return request.id
    }

    async function expectRequesterConflict(requestId: string) {
      const before = await savedLeave(requestId)
      for (const reviewer of [admin, superadmin]) {
        const response = await action(reviewer, requestId, "approve", 2)
        assert.equal(response.status, 409, await response.clone().text())
        assert.match(
          await response.text(),
          /active linked Staff or Admin account/,
        )
        assert.deepEqual(await savedLeave(requestId), before)
      }
    }

    await t.test(
      "leave approval follows the requester account lifecycle",
      async () => {
        const subject = await account("leave-lifecycle", "STAFF")
        const requestId = await verifiedLeave(subject)
        const disabled = await setRequesterActive(subject, false)
        assert.equal(disabled.status, 200, await disabled.text())
        assert.equal((await api(subject, "/auth/me")).status, 401)
        const employment = await prisma.employee.findUniqueOrThrow({
          where: { id: subject.employee.id },
          select: { status: true, userId: true },
        })
        assert.deepEqual(employment, {
          status: "ACTIVE",
          userId: subject.user.id,
        })
        await expectRequesterConflict(requestId)

        const archived = await api(superadmin, `/users/${subject.user.id}`, {
          method: "DELETE",
        })
        assert.equal(archived.status, 200, await archived.text())
        await expectRequesterConflict(requestId)

        const restored = await api(
          superadmin,
          `/users/${subject.user.id}/restore`,
          {
            method: "POST",
          },
        )
        assert.equal(restored.status, 200, await restored.text())
        await expectRequesterConflict(requestId)

        const reactivated = await setRequesterActive(subject, true)
        assert.equal(reactivated.status, 200, await reactivated.text())
        const approved = await action(admin, requestId, "approve", 2)
        assert.equal(approved.status, 200, await approved.text())
        const committed = await savedLeave(requestId)
        assert.equal(committed.status, "APPROVED")
        assert.equal(committed.version, 3)
        assert.equal(
          committed.decisions.filter(({ action }) => action === "APPROVED")
            .length,
          1,
        )
        assert.equal(
          committed.notifications.filter(
            ({ type }) => type === "LEAVE_APPROVED",
          ).length,
          1,
        )

        const disabledAfterApproval = await setRequesterActive(subject, false)
        assert.equal(
          disabledAfterApproval.status,
          200,
          await disabledAfterApproval.text(),
        )
        assert.deepEqual(await savedLeave(requestId), committed)
      },
    )

    await t.test(
      "leave approval requires the original eligible login",
      async () => {
        const subject = await account("leave-unlinked", "STAFF")
        const requestId = await verifiedLeave(subject)
        const setLinkedUser = (userId: string | null) =>
          prisma.employee.update({
            where: { id: subject.employee.id },
            data: { userId },
          })

        await setLinkedUser(null)
        await expectRequesterConflict(requestId)
        const replacement = await prisma.user.create({
          data: {
            fullName: "Replacement login",
            email: "leave-replacement-login@leave.test",
            passwordHash: "test-only",
            role: "STAFF",
          },
        })
        await setLinkedUser(replacement.id)
        await expectRequesterConflict(requestId)
        await setLinkedUser(subject.user.id)
        await prisma.user.update({
          where: { id: subject.user.id },
          data: { role: "USER" },
        })
        await expectRequesterConflict(requestId)

        const rejected = await action(admin, requestId, "reject", 2)
        assert.equal(rejected.status, 200, await rejected.text())
        assert.equal((await savedLeave(requestId)).status, "REJECTED")
      },
    )

    await t.test(
      "leave approval accepts an eligible Admin on leave",
      async () => {
        const subject = await account("leave-admin-requester", "ADMIN")
        const requestId = await verifiedLeave(subject)
        await prisma.employee.update({
          where: { id: subject.employee.id },
          data: { status: "ON_LEAVE" },
        })
        const approved = await action(superadmin, requestId, "approve", 2)
        assert.equal(approved.status, 200, await approved.text())
        assert.equal((await savedLeave(requestId)).status, "APPROVED")
      },
    )

    await t.test(
      "leave approval serializes with a concurrent account disable",
      async (race) => {
        const subject = await account("leave-approval-race", "STAFF")
        const requestId = await verifiedLeave(subject)
        const before = await savedLeave(requestId)
        const [disabled, approved] = await Promise.all([
          setRequesterActive(subject, false),
          action(admin, requestId, "approve", 2),
        ])
        assert.equal(disabled.status, 200, await disabled.text())
        assert.equal((await api(subject, "/auth/me")).status, 401)

        const after = await savedLeave(requestId)
        if (approved.status === 409) {
          assert.match(
            await approved.text(),
            /active linked Staff or Admin account/,
          )
          assert.deepEqual(after, before)
          race.diagnostic("Account disable took effect before approval")
        } else {
          assert.equal(approved.status, 200, await approved.text())
          assert.equal(after.status, "APPROVED")
          assert.equal(after.version, 3)
          const decision = after.decisions.find(
            ({ action }) => action === "APPROVED",
          )
          assert.ok(decision?.writerTransaction)
          // The isolated fixture uses one connection. Confirm which write ran first.
          const [accountWrite] = await prisma.$queryRaw<{ xid: string }[]>`
          SELECT xmin::text AS xid FROM "User" WHERE "id" = ${subject.user.id}
        `
          assert.ok(
            BigInt(decision.writerTransaction) < BigInt(accountWrite.xid),
          )
          race.diagnostic("Approval committed before account disable")
        }
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
          now = new Date(at)
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
    await t.test("decision replay checks Head and account status", async () => {
      const team = await prisma.department.create({
        data: { name: "Leave replay team" },
      })
      const subject = await account("replay-subject", "STAFF", team.id)
      const originalHead = await account("replay-head", "STAFF", team.id)
      const replacementHead = await account("replacement", "STAFF", team.id)
      const setHead = (headId: string) =>
        prisma.department.update({ where: { id: team.id }, data: { headId } })
      await setHead(originalHead.user.id)

      const { request } = await submit("2027-01-06", "2027-01-06", subject)
      const path = `/leave/requests/${request.id}`
      const verification = {
        actionId: randomUUID(),
        expectedVersion: 1,
        note: "Verified before the Head handoff",
      }
      const verify = () =>
        api(originalHead, `${path}/verify`, { body: verification })
      const verified = await verify()
      assert.equal(verified.status, 200)
      const beforeRetry = await savedLeave(request.id)
      const exactRetry = await verify()
      assert.equal(exactRetry.status, 200)
      assert.deepEqual(await exactRetry.json(), await verified.json())
      assert.deepEqual(await savedLeave(request.id), beforeRetry)

      await setHead(replacementHead.user.id)
      const approval = {
        actionId: randomUUID(),
        expectedVersion: 2,
        note: "Approved after the Head handoff",
      }
      const approve = () =>
        api(superadmin, `${path}/approve`, { body: approval })
      const approved = await approve()
      assert.equal(approved.status, 200)
      const beforeDenials = await savedLeave(request.id)
      assert.equal((await api(replacementHead, path)).status, 200)
      await expectLeaveReadDenied(await api(originalHead, path))
      await expectLeaveReadDenied(await verify())

      await prisma.user.update({
        where: { id: originalHead.user.id },
        data: { isActive: false },
      })
      const revoked = await verify()
      assert.equal(revoked.status, 401)
      assert.deepEqual(await revoked.json(), {
        error: "Invalid or expired session",
      })
      const approvedRetry = await approve()
      assert.equal(approvedRetry.status, 200)
      assert.deepEqual(await approvedRetry.json(), await approved.json())
      assert.deepEqual(await savedLeave(request.id), beforeDenials)
    })

    await t.test(
      "decision replay matches the original canonical payload",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Leave decision payload team" },
        })
        const subject = await account("payload-subject", "STAFF", team.id)
        const reviewer = await account("payload-head", "STAFF", team.id)
        await setDepartmentHead(team.id, reviewer.user.id)
        const { request } = await submit("2027-03-08", "2027-03-08", subject)
        const path = `/leave/requests/${request.id}`
        const body = {
          actionId: randomUUID(),
          expectedVersion: request.version,
          note: "  Original verification note \n",
        }
        const verified = await api(reviewer, `${path}/verify`, { body })
        assert.equal(verified.status, 200, await verified.clone().text())
        const verifiedResult: unknown = await verified.json()
        const before = await savedLeave(request.id)
        const receipt = before.decisions.find(
          ({ actionId }) => actionId === body.actionId,
        )
        assert.ok(receipt)
        assert.equal(receipt.note, "Original verification note")
        assert.equal(receipt.version, body.expectedVersion + 1)

        async function audit() {
          const response = await api(
            superadmin,
            `/workforce-compliance-logs?source=leave&subjectId=${request.id}`,
          )
          assert.equal(response.status, 200, await response.clone().text())
          const { total, events } = (await response.json()) as {
            total: number
            events: unknown[]
          }
          return { total, events }
        }
        const auditBefore = await audit()
        assert.equal(auditBefore.total, 2)

        for (const note of [body.note, "Original verification note"]) {
          const retry = await api(reviewer, `${path}/verify`, {
            body: { ...body, note },
          })
          assert.equal(retry.status, 200)
          assert.deepEqual(await retry.json(), verifiedResult)
        }

        const reused = []
        for (const [endpoint, retryBody] of [
          ["verify", { ...body, note: "Different verification note" }],
          ["verify", { ...body, expectedVersion: 99 }],
          ["reject", body],
        ] as const) {
          const response = await api(reviewer, `${path}/${endpoint}`, {
            body: retryBody,
          })
          const { error } = (await response.json()) as { error?: string }
          reused.push({ status: response.status, error })
        }
        assert.deepEqual(reused, [
          { status: 409, error: "Action ID has already been used" },
          { status: 409, error: "Action ID has already been used" },
          { status: 409, error: "Action ID has already been used" },
        ])
        assert.deepEqual(await savedLeave(request.id), before)
        assert.deepEqual(await audit(), auditBefore)

        const approved = await action(
          admin,
          request.id,
          "approve",
          receipt.version,
        )
        assert.equal(approved.status, 200, await approved.text())
        const afterApproval = await savedLeave(request.id)
        const approvalAudit = await audit()
        assert.equal(approvalAudit.total, 3)
        const detail = await api(reviewer, path)
        assert.equal(detail.status, 200)
        const retry = await api(reviewer, `${path}/verify`, { body })
        assert.equal(retry.status, 200)
        assert.deepEqual(await retry.json(), await detail.json())
        assert.deepEqual(await savedLeave(request.id), afterApproval)
        assert.deepEqual(await audit(), approvalAudit)
      },
    )

    await t.test(
      "replaying a cancellation preserves an omitted note",
      async () => {
        const subject = await account("optional-note-subject", "STAFF")
        const { request } = await submit("2027-03-09", "2027-03-09", subject)
        const path = `/leave/requests/${request.id}/cancel`
        const body = {
          actionId: randomUUID(),
          expectedVersion: request.version,
        }
        const cancelled = await api(subject, path, { body })
        assert.equal(cancelled.status, 200, await cancelled.clone().text())
        const before = await savedLeave(request.id)
        assert.equal(
          before.decisions.find(({ action }) => action === "CANCELLED")?.note,
          null,
        )

        const retry = await api(subject, path, { body })
        assert.equal(retry.status, 200)
        assert.deepEqual(await retry.json(), await cancelled.json())
        const changed = await api(subject, path, {
          body: { ...body, note: "Added a cancellation note" },
        })
        assert.equal(changed.status, 409)
        assert.deepEqual(await changed.json(), {
          error: "Action ID has already been used",
        })
        const explicitNull = await api(subject, path, {
          body: { ...body, note: null },
        })
        assert.equal(explicitNull.status, 400)
        assert.deepEqual(await explicitNull.json(), {
          error: "Provide a valid cancellation note",
        })
        assert.deepEqual(await savedLeave(request.id), before)
      },
    )

    async function setDepartmentHead(id: string, headId: string | null) {
      const response = await api(admin, `/departments/${id}`, {
        method: "PUT",
        body: { headId },
      })
      assert.equal(response.status, 200, await response.text())
    }

    async function pendingLeaveQueue(requestId: string, reviewer = admin) {
      const list = await api(
        reviewer,
        "/leave/requests?scope=team&status=SUBMITTED",
      )
      const overview = await api(reviewer, "/leave/overview?scope=team")
      assert.equal(list.status, 200)
      assert.equal(overview.status, 200)
      const { requests } = (await list.json()) as {
        requests: {
          id: string
          capabilities: { approve: boolean; reject: boolean; verify: boolean }
        }[]
      }
      const { groups } = (await overview.json()) as {
        groups: { status: string; type: string; count: number }[]
      }
      return {
        entry: requests.find(({ id }) => id === requestId),
        submittedAnnual:
          groups.find(
            ({ status, type }) => status === "SUBMITTED" && type === "ANNUAL",
          )?.count ?? 0,
      }
    }

    async function inboxFor(reviewer: Account, requestId: string) {
      const response = await api(reviewer, noticePath)
      assert.equal(response.status, 200)
      const result = (await response.json()) as {
        notifications: {
          id: string
          leaveRequestId: string
          type: string
          readAt: string | null
          summary: string
        }[]
        unreadCount: number
      }
      return {
        ...result,
        notifications: result.notifications.filter(
          ({ leaveRequestId }) => leaveRequestId === requestId,
        ),
      }
    }

    const markLeaveNoticeRead = (reviewer: Account, id: string) =>
      api(reviewer, `${noticePath}/${id}/read`, { method: "PATCH" })

    await t.test(
      "an unlinked Superadmin can open organization leave in every status",
      async () => {
        const reviewer = await prisma.user.create({
          data: {
            email: "organization-leave-reader@leave.test",
            fullName: "Organization leave reader",
            passwordHash: "test-only",
            role: "SUPERADMIN",
          },
        })
        const reader = await issueSession(reviewer)
        const team = await prisma.department.create({
          data: { name: "Organization leave detail team" },
        })
        const subject = await account("detail-subject", "STAFF", team.id)
        const teamHead = await account("detail-head", "STAFF", team.id)
        const coworker = await account("detail-peer", "STAFF", team.id)
        await setDepartmentHead(team.id, teamHead.user.id)

        async function expectOrganizationDetail(id: string, status: string) {
          const before = await savedLeave(id)
          const list = await api(
            reader,
            `/leave/requests?scope=team&status=${status}&search=detail-subject`,
          )
          assert.equal(list.status, 200)
          const { requests } = (await list.json()) as {
            requests: { id: string; status: string }[]
          }
          const row = requests.find((item) => item.id === id)
          assert.equal(row?.status, status)

          const path = `/leave/requests/${id}`
          await expectLeaveReadDenied(await api(coworker, path))
          assert.equal((await api(teamHead, path)).status, 200)
          if (status === "SUBMITTED") {
            await expectLeaveReadDenied(await api(admin, path))
          } else {
            assert.equal((await api(admin, path)).status, 200)
          }
          const detail = await api(reader, path)
          assert.equal(detail.status, 200, await detail.clone().text())
          assert.deepEqual(await detail.json(), { request: row })
          assert.deepEqual(await savedLeave(id), before)
        }

        const { request } = await submit("2027-03-01", "2027-03-01", subject)
        const inbox = await api(reader, noticePath)
        assert.equal(inbox.status, 200)
        const { notifications } = (await inbox.json()) as {
          notifications: { entityId: string; type: string }[]
        }
        const notice = notifications.find(
          ({ entityId, type }) =>
            entityId === request.id && type === "LEAVE_SUBMITTED",
        )
        assert.ok(notice)
        await expectOrganizationDetail(notice.entityId, "SUBMITTED")

        for (const [actor, decision, version, status] of [
          [teamHead, "verify", 1, "VERIFIED"],
          [admin, "approve", 2, "APPROVED"],
          [superadmin, "reverse", 3, "REVERSED"],
        ] as const) {
          const result = await action(actor, request.id, decision, version)
          assert.equal(result.status, 200, await result.text())
          await expectOrganizationDetail(request.id, status)
        }

        const rejected = await submit("2027-03-02", "2027-03-02", subject)
        const rejection = await action(
          teamHead,
          rejected.request.id,
          "reject",
          1,
        )
        assert.equal(rejection.status, 200, await rejection.text())
        await expectOrganizationDetail(rejected.request.id, "REJECTED")

        const cancelled = await submit("2027-03-03", "2027-03-03", subject)
        const cancellation = await action(
          subject,
          cancelled.request.id,
          "cancel",
          1,
        )
        assert.equal(cancellation.status, 200, await cancellation.text())
        await expectOrganizationDetail(cancelled.request.id, "CANCELLED")

        // PG-013-F001-A008-T002: compare the organization summary projection
        // with all persisted status/type groups visible to Superadmin.
        const persistedLeave = await prisma.leaveRequest.findMany({
          select: { status: true, type: true },
        })
        const expectedGroups = new Map<
          string,
          { status: string; type: string; count: number }
        >()
        for (const row of persistedLeave) {
          const key = `${row.status}:${row.type}`
          const group = expectedGroups.get(key)
          expectedGroups.set(key, {
            status: row.status,
            type: row.type,
            count: (group?.count ?? 0) + 1,
          })
        }
        const overview = await api(reader, "/leave/overview?scope=team")
        assert.equal(overview.status, 200, await overview.clone().text())
        const { groups } = (await overview.json()) as {
          groups: { status: string; type: string; count: number }[]
        }
        assert.ok(
          groups.every(
            (group) =>
              JSON.stringify(Object.keys(group).sort()) ===
              JSON.stringify(["count", "status", "type"]),
          ),
        )
        const sortGroups = (
          values: { status: string; type: string; count: number }[],
        ) =>
          values.sort((left, right) =>
            `${left.status}:${left.type}`.localeCompare(
              `${right.status}:${right.type}`,
            ),
          )
        assert.deepEqual(
          sortGroups(groups),
          sortGroups([...expectedGroups.values()]),
        )

        await expectLeaveReadDenied(
          await api(reader, `/leave/requests/${randomUUID()}`),
        )

        // PG-013-F001-A015-T002: cover query allowlists, authentication,
        // supported roles, and the Staff team-scope boundary.
        const unsupported = await account("overview-user", "USER")
        const anonymousOverview = await fetch(
          `${base}/leave/overview?scope=team`,
        )
        const missingScope = await api(superadmin, "/leave/overview")
        const invalidScope = await api(
          superadmin,
          "/leave/overview?scope=invalid",
        )
        const unknownQuery = await api(
          superadmin,
          "/leave/overview?scope=team&unexpected=true",
        )
        assert.equal(anonymousOverview.status, 401)
        assert.equal(missingScope.status, 400)
        assert.equal(invalidScope.status, 400)
        assert.equal(unknownQuery.status, 400)
        const unsupportedRole = await api(
          unsupported,
          "/leave/overview?scope=mine",
        )
        const nonHeadTeam = await api(employee, "/leave/overview?scope=team")
        assert.equal(unsupportedRole.status, 403)
        assert.equal(nonHeadTeam.status, 403)
        for (const denied of [
          anonymousOverview,
          unsupportedRole,
          nonHeadTeam,
        ]) {
          const body = (await denied.json()) as Record<string, unknown>
          assert.equal("groups" in body, false)
        }
        for (const [actor, scope] of [
          [employee, "mine"],
          [head, "team"],
          [admin, "team"],
          [superadmin, "team"],
        ] as const) {
          assert.equal(
            (await api(actor, `/leave/overview?scope=${scope}`)).status,
            200,
          )
        }
      },
    )

    await t.test(
      "appointing the requester as Head makes pending leave discoverable to HR",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Self Head routing" },
        })
        const subject = await account("self-head-subject", "STAFF", team.id)
        const previousHead = await account("self-head-former", "STAFF", team.id)
        await setDepartmentHead(team.id, previousHead.user.id)
        const { request } = await submit("2026-12-02", "2026-12-02", subject)
        const path = `/leave/requests/${request.id}`
        const before = await savedLeave(request.id)
        const priorNotice = before.notifications.find(
          ({ userId }) => userId === previousHead.user.id,
        )
        assert.ok(priorNotice)
        const beforeQueue = await pendingLeaveQueue(request.id)
        assert.equal(beforeQueue.entry, undefined)

        await setDepartmentHead(team.id, subject.user.id)
        const detail = await api(admin, path)
        const queue = await pendingLeaveQueue(request.id)
        const inbox = await inboxFor(admin, request.id)
        const selfDetail = await api(subject, path)
        const owner = (await selfDetail.json()) as {
          request: { capabilities: { fallback: boolean } }
        }
        assert.equal(owner.request.capabilities.fallback, true)
        assert.deepEqual(
          {
            listed: Boolean(queue.entry),
            overviewAdded: queue.submittedAnnual - beforeQueue.submittedAnnual,
            detailStatus: detail.status,
            noticeTypes: inbox.notifications.map(({ type }) => type),
            selfVerifyStatus: (await action(subject, request.id, "verify", 1))
              .status,
          },
          {
            listed: true,
            overviewAdded: 1,
            detailStatus: 200,
            noticeTypes: ["LEAVE_SUBMITTED"],
            selfVerifyStatus: 403,
          },
        )
        assert.ok(queue.entry)
        assert.equal(queue.entry.capabilities.approve, true)
        assert.equal(queue.entry.capabilities.reject, true)
        assert.deepEqual(
          ((await detail.json()) as { request: typeof queue.entry }).request
            .capabilities,
          queue.entry.capabilities,
        )
        assert.equal(
          (await inboxFor(previousHead, request.id)).notifications.length,
          0,
        )
        assert.equal(
          (await markLeaveNoticeRead(previousHead, priorNotice.id)).status,
          404,
        )
        const after = await savedLeave(request.id)
        assert.deepEqual(after.decisions, before.decisions)
        assert.deepEqual(after.days, before.days)
        assert.equal(after.routeDepartmentId, team.id)
        assert.equal(after.version, 1)
        assert.equal(
          after.notifications.find(({ id }) => id === priorNotice.id)?.readAt,
          null,
        )
        assert.equal(
          inbox.notifications[0]?.summary,
          "A leave request is awaiting review.",
        )
        const newNotice = inbox.notifications[0]!
        assert.equal(
          (await markLeaveNoticeRead(admin, newNotice.id)).status,
          200,
        )

        await setDepartmentHead(team.id, previousHead.user.id)
        assert.equal(
          (await inboxFor(admin, request.id)).notifications.length,
          0,
        )
        await setDepartmentHead(team.id, subject.user.id)
        await setDepartmentHead(team.id, subject.user.id)
        const again = await inboxFor(admin, request.id)
        assert.equal(again.notifications.length, 1)
        assert.equal(again.notifications[0]?.id, newNotice.id)
        assert.ok(again.notifications[0]?.readAt)
        assert.deepEqual(
          (await savedLeave(request.id)).decisions,
          before.decisions,
        )
        assert.equal(
          (await action(admin, queue.entry.id, "approve", 1)).status,
          200,
        )
      },
    )

    await t.test(
      "appointing an eligible Head withdraws pending HR fallback visibility",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Headless routing" },
        })
        const subject = await account("headless-subject", "STAFF", team.id)
        const newHead = await account("headless-new-head", "STAFF", team.id)
        const { request } = await submit("2026-12-02", "2026-12-02", subject)
        const path = `/leave/requests/${request.id}`
        const oldQueue = await pendingLeaveQueue(request.id)
        assert.equal(oldQueue.entry?.capabilities.approve, true)
        const oldInbox = await inboxFor(admin, request.id)
        const oldNotice = oldInbox.notifications[0]
        assert.ok(oldNotice)
        assert.equal(oldNotice.readAt, null)

        await setDepartmentHead(team.id, newHead.user.id)
        const beforeDenials = await savedLeave(request.id)
        const detail = await api(admin, path)
        const queue = await pendingLeaveQueue(request.id)
        const inbox = await inboxFor(admin, request.id)
        assert.deepEqual(
          {
            listed: Boolean(queue.entry),
            overviewRemoved: oldQueue.submittedAnnual - queue.submittedAnnual,
            detailStatus: detail.status,
            notices: inbox.notifications.length,
            unreadRemoved: oldInbox.unreadCount - inbox.unreadCount,
            markReadStatus: (await markLeaveNoticeRead(admin, oldNotice.id))
              .status,
            approveStatus: (await action(admin, request.id, "approve", 1))
              .status,
            rejectStatus: (await action(admin, request.id, "reject", 1)).status,
          },
          {
            listed: false,
            overviewRemoved: 1,
            detailStatus: 404,
            notices: 0,
            unreadRemoved: 1,
            markReadStatus: 404,
            approveStatus: 403,
            rejectStatus: 403,
          },
        )
        await expectLeaveReadDenied(detail)
        assert.equal(
          (await api(admin, `${noticePath}/read-all`, { method: "PATCH" }))
            .status,
          200,
        )
        assert.deepEqual(await savedLeave(request.id), beforeDenials)
        assert.equal(
          (await pendingLeaveQueue(request.id, newHead)).entry?.capabilities
            .verify,
          true,
        )
        assert.equal(
          (await inboxFor(newHead, request.id)).notifications.length,
          1,
        )
        assert.equal(
          (await action(newHead, request.id, "verify", 1)).status,
          200,
        )
        const verified = await api(admin, path)
        assert.equal(verified.status, 200)
        assert.equal(
          (
            (await verified.json()) as {
              request: { capabilities: { approve: boolean } }
            }
          ).request.capabilities.approve,
          true,
        )
        assert.deepEqual(
          (await inboxFor(admin, request.id)).notifications.map(
            ({ type }) => type,
          ),
          ["LEAVE_VERIFIED"],
        )
        assert.equal(
          (await action(admin, request.id, "approve", 2)).status,
          200,
        )
      },
    )

    await t.test(
      "ordinary Head replacement reroutes pending notices and preserves verification",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Ordinary Head replacement" },
        })
        const subject = await account("replacement-subject", "STAFF", team.id)
        const previousHead = await account(
          "replacement-original",
          "STAFF",
          team.id,
        )
        const newHead = await account("replacement-new", "STAFF", team.id)
        await setDepartmentHead(team.id, previousHead.user.id)
        const { request: verified } = await submit(
          "2026-12-02",
          "2026-12-02",
          subject,
        )
        assert.equal(
          (await action(previousHead, verified.id, "verify", 1)).status,
          200,
        )
        const verifiedBefore = await savedLeave(verified.id)
        const { request: pending } = await submit(
          "2026-12-03",
          "2026-12-03",
          subject,
        )
        const oldNotice = (await inboxFor(previousHead, pending.id))
          .notifications[0]
        assert.ok(oldNotice)

        await setDepartmentHead(team.id, newHead.user.id)
        assert.equal((await pendingLeaveQueue(pending.id)).entry, undefined)
        await expectLeaveReadDenied(
          await api(admin, `/leave/requests/${pending.id}`),
        )
        assert.equal(
          (await pendingLeaveQueue(pending.id, newHead)).entry?.capabilities
            .verify,
          true,
        )
        assert.equal(
          (await inboxFor(previousHead, pending.id)).notifications.length,
          0,
        )
        assert.equal(
          (await markLeaveNoticeRead(previousHead, oldNotice.id)).status,
          404,
        )
        assert.equal(
          (await inboxFor(newHead, pending.id)).notifications.length,
          1,
        )
        const beforeDenial = await savedLeave(pending.id)
        assert.equal(
          (await action(previousHead, pending.id, "verify", 1)).status,
          403,
        )
        assert.deepEqual(await savedLeave(pending.id), beforeDenial)
        assert.deepEqual(await savedLeave(verified.id), verifiedBefore)
        assert.equal(
          (await action(admin, verified.id, "approve", 2)).status,
          200,
        )
        assert.equal(
          (await action(newHead, pending.id, "verify", 1)).status,
          200,
        )
      },
    )

    await t.test(
      "Head account deactivation and reactivation switch pending reviewers",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Head account changes" },
        })
        const subject = await account("head-account-subject", "STAFF", team.id)
        const reviewer = await account(
          "head-account-reviewer",
          "STAFF",
          team.id,
        )
        await setDepartmentHead(team.id, reviewer.user.id)
        const { request } = await submit("2026-12-02", "2026-12-02", subject)
        const path = `/leave/requests/${request.id}`
        const before = await savedLeave(request.id)
        const changeStatus = async (isActive: boolean) => {
          const response = await api(
            superadmin,
            `/users/${reviewer.user.id}/status`,
            {
              method: "PATCH",
              body: { isActive },
            },
          )
          assert.equal(response.status, 200, await response.text())
        }

        await changeStatus(false)
        assert.equal((await api(reviewer, path)).status, 401)
        assert.equal(
          (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
          true,
        )
        assert.equal((await api(admin, path)).status, 200)
        const notice = (await inboxFor(admin, request.id)).notifications[0]
        assert.ok(notice)

        await changeStatus(true)
        await expectLeaveReadDenied(await api(admin, path))
        assert.equal(
          (await inboxFor(admin, request.id)).notifications.length,
          0,
        )
        assert.equal((await markLeaveNoticeRead(admin, notice.id)).status, 404)
        assert.equal(
          (await action(admin, request.id, "approve", 1)).status,
          403,
        )
        assert.deepEqual(
          (await savedLeave(request.id)).decisions,
          before.decisions,
        )

        // Department Management rejects non-Staff Heads, so inject a legacy linkage.
        await prisma.user.update({
          where: { id: reviewer.user.id },
          data: { role: "USER" },
        })
        assert.equal(
          (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
          true,
        )
        assert.equal((await api(admin, path)).status, 200)
        const restored = (await inboxFor(admin, request.id)).notifications
        assert.equal(restored.length, 1)
        assert.equal(restored[0]?.id, notice.id)
        assert.equal(restored[0]?.readAt, null)
        assert.equal(
          (await action(admin, request.id, "approve", 1)).status,
          200,
        )
      },
    )

    await t.test(
      "temporary self-Head handoff and restoration update pending notice visibility",
      async () => {
        const team = await prisma.department.create({
          data: { name: "Temporary Head routing" },
        })
        const subject = await account("temp-head-subject", "STAFF", team.id)
        const originalHead = await account(
          "temp-head-original",
          "STAFF",
          team.id,
        )
        await setDepartmentHead(team.id, originalHead.user.id)
        const { request } = await submit("2026-12-02", "2026-12-02", subject)
        const path = `/employees/${originalHead.employee.id}`
        const before = await savedLeave(request.id)
        const update = async (body: object) => {
          const response = await api(admin, path, { method: "PUT", body })
          assert.equal(response.status, 200, await response.text())
        }
        await update({
          status: "ON_LEAVE",
          replacementHeadEmployeeId: subject.employee.id,
        })
        assert.equal(
          (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
          true,
        )
        const notice = (await inboxFor(admin, request.id)).notifications[0]
        assert.ok(notice)
        await update({ status: "ACTIVE" })
        assert.equal((await pendingLeaveQueue(request.id)).entry, undefined)
        assert.equal(
          (await inboxFor(admin, request.id)).notifications.length,
          0,
        )
        assert.equal((await markLeaveNoticeRead(admin, notice.id)).status, 404)
        assert.deepEqual(
          (await savedLeave(request.id)).decisions,
          before.decisions,
        )
      },
    )

    await t.test(
      "a submitted fallback follows the receiving department's Head",
      async () => {
        const origin = await prisma.department.create({
          data: { name: "Fallback transfer origin" },
        })
        const destination = await prisma.department.create({
          data: { name: "Fallback transfer destination" },
        })
        const subject = await account(
          "fallback-transfer-subject",
          "STAFF",
          origin.id,
        )
        const receivingHead = await account(
          "fallback-transfer-head",
          "STAFF",
          destination.id,
        )
        await setDepartmentHead(destination.id, receivingHead.user.id)
        const { request } = await submit("2026-12-02", "2026-12-02", subject)
        const oldNotice = (await inboxFor(admin, request.id)).notifications[0]
        assert.ok(oldNotice)
        const moved = await api(admin, `/employees/${subject.employee.id}`, {
          method: "PUT",
          body: { departmentId: destination.id },
        })
        assert.equal(moved.status, 200, await moved.text())
        assert.equal((await pendingLeaveQueue(request.id)).entry, undefined)
        await expectLeaveReadDenied(
          await api(admin, `/leave/requests/${request.id}`),
        )
        assert.equal(
          (await markLeaveNoticeRead(admin, oldNotice.id)).status,
          404,
        )
        assert.equal(
          (await pendingLeaveQueue(request.id, receivingHead)).entry
            ?.capabilities.verify,
          true,
        )
        assert.equal(
          (await action(receivingHead, request.id, "verify", 1)).status,
          200,
        )
        assert.deepEqual(
          (await inboxFor(admin, request.id)).notifications.map(
            ({ type }) => type,
          ),
          ["LEAVE_VERIFIED"],
        )
        const verified = await savedLeave(request.id)
        assert.equal(verified.routeDepartmentId, destination.id)
        assert.equal(verified.verifiedById, receivingHead.user.id)
        assert.equal(
          (await action(admin, request.id, "approve", 2)).status,
          200,
        )
      },
    )

    await t.test(
      "[PG-011-F001-A007-T001] leave-list pages keep metadata and deterministic tie order",
      async () => {
        const subject = await account("pg011-page-order", "STAFF")
        const dates = [
          "2026-12-01",
          "2026-12-02",
          "2026-12-03",
          "2026-12-04",
          "2026-12-07",
          "2026-12-08",
          "2026-12-09",
          "2026-12-10",
          "2026-12-11",
          "2026-12-14",
          "2026-12-15",
        ]
        const tieTime = new Date("2026-12-20T12:00:00.000Z")
        const ids: string[] = []
        for (const date of dates) {
          const result = await submit(date, date, subject)
          ids.push(result.request.id)
          await prisma.leaveRequest.update({
            where: { id: result.request.id },
            data: { createdAt: tieTime },
          })
        }
        const expected = [...ids].sort().reverse()
        const firstResponse = await api(
          subject,
          "/leave/requests?scope=mine&page=1",
        )
        assert.equal(
          firstResponse.status,
          200,
          await firstResponse.clone().text(),
        )
        const first = (await firstResponse.json()) as {
          requests: { id: string }[]
          total: number
          page: number
          pageSize: number
        }
        assert.deepEqual(
          { total: first.total, page: first.page, pageSize: first.pageSize },
          { total: 11, page: 1, pageSize: 10 },
        )
        assert.deepEqual(
          first.requests.map(({ id }) => id),
          expected.slice(0, 10),
        )
        const secondResponse = await api(
          subject,
          "/leave/requests?scope=mine&page=2",
        )
        const second = (await secondResponse.json()) as {
          requests: { id: string }[]
          total: number
          page: number
          pageSize: number
        }
        assert.equal(secondResponse.status, 200)
        assert.deepEqual(
          { total: second.total, page: second.page, pageSize: second.pageSize },
          { total: 11, page: 2, pageSize: 10 },
        )
        assert.deepEqual(
          second.requests.map(({ id }) => id),
          expected.slice(10),
        )
        const repeated = await api(subject, "/leave/requests?scope=mine&page=1")
        assert.deepEqual(
          (
            (await repeated.json()) as { requests: { id: string }[] }
          ).requests.map(({ id }) => id),
          expected.slice(0, 10),
        )
        assert.equal(
          (await api(subject, "/leave/requests?scope=mine&page=0")).status,
          400,
        )
        const outside = await api(subject, "/leave/requests?scope=mine&page=99")
        assert.equal(outside.status, 200)
        const outsideBody = (await outside.json()) as {
          requests: unknown[]
          total: number
          page: number
          pageSize: number
        }
        assert.deepEqual(
          {
            requests: outsideBody.requests,
            total: outsideBody.total,
            page: outsideBody.page,
            pageSize: outsideBody.pageSize,
          },
          { requests: [], total: 11, page: 99, pageSize: 10 },
        )
      },
    )

    await t.test(
      "[PG-011-F001-A014-T002] policy gaps reject preview and submission without partial writes",
      async () => {
        const noAssignment = await account("pg011-no-policy", "STAFF")
        await prisma.attendancePolicyAssignment.deleteMany({
          where: { employeeId: noAssignment.employee.id },
        })

        const ambiguous = await account("pg011-ambiguous-policy", "STAFF")
        // Model legacy-corrupt overlap only to exercise this service branch.
        // The isolated database guard is restored before any API request.
        await prisma.$executeRaw`ALTER TABLE "AttendancePolicyAssignment" DISABLE TRIGGER USER`
        try {
          await prisma.attendancePolicyAssignment.create({
            data: {
              employeeId: ambiguous.employee.id,
              policyId: policy.id,
              effectiveFrom: new Date("2026-12-01T00:00:00.000Z"),
            },
          })
        } finally {
          await prisma.$executeRaw`ALTER TABLE "AttendancePolicyAssignment" ENABLE TRIGGER USER`
        }

        const incompletePolicy = await prisma.attendancePolicy.create({
          data: {
            name: "PG-011 incomplete weekday policy",
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
        const incomplete = await account(
          "pg011-incomplete-policy",
          "STAFF",
          department.id,
          incompletePolicy.id,
        )
        // Assignment guards require all weekday rows. Remove one only after
        // assignment to represent a legacy-corrupt/incomplete policy state.
        await prisma.$executeRaw`ALTER TABLE "AttendancePolicyDay" DISABLE TRIGGER USER`
        try {
          await prisma.attendancePolicyDay.deleteMany({
            where: { policyId: incompletePolicy.id, weekday: 3 },
          })
        } finally {
          await prisma.$executeRaw`ALTER TABLE "AttendancePolicyDay" ENABLE TRIGGER USER`
        }

        const zeroPolicy = await prisma.attendancePolicy.create({
          data: {
            name: "PG-011 zero-work policy",
            timeZone: "Asia/Manila",
            days: {
              create: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: false,
                requiredMinutes: 0,
              })),
            },
          },
        })
        const zero = await account(
          "pg011-zero-policy",
          "STAFF",
          department.id,
          zeroPolicy.id,
        )

        async function counts() {
          return {
            requests: await prisma.leaveRequest.count(),
            days: await prisma.leaveRequestDay.count(),
            decisions: await prisma.leaveDecision.count(),
            notifications: await prisma.workflowNotification.count(),
          }
        }
        const cases = [
          {
            actor: noAssignment,
            startDate: "2026-12-08",
            endDate: "2026-12-08",
            expected: 409,
          },
          {
            actor: ambiguous,
            startDate: "2026-12-08",
            endDate: "2026-12-08",
            expected: 409,
          },
          {
            actor: incomplete,
            startDate: "2026-12-09",
            endDate: "2026-12-09",
            expected: 409,
          },
          {
            actor: zero,
            startDate: "2026-12-06",
            endDate: "2026-12-06",
            expected: 400,
          },
        ] as const
        for (const { actor, startDate, endDate, expected } of cases) {
          const before = await counts()
          const previewResult = await api(actor, "/leave/preview", {
            body: { startDate, endDate },
          })
          assert.equal(previewResult.status, expected, "preview")
          const submitted = await api(actor, "/leave/requests", {
            body: {
              requestKey: randomUUID(),
              type: "ANNUAL",
              reason: "Policy coverage failure",
              startDate,
              endDate,
            },
          })
          assert.equal(submitted.status, expected, "submission")
          assert.deepEqual(await counts(), before)
        }
      },
    )
  },
)
