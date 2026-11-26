import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { Role } from "../../../../src/generated/prisma/client.js"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../../support/pglite-app.js"
import type { TestContext } from "node:test"

/** Shared fixtures for the leave request steps, which run in order on one database. */
export async function createLeaveContext(t: TestContext) {
  const clock = { now: new Date("2026-11-17T08:00:00+08:00") }

  const { prisma, base } = await startPgliteApp(t, {
    app: { attendanceClock: () => clock.now },
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
  const noticePath = "/request-workflows/notifications"

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

  return {
    prisma,
    base,
    department,
    outsideDepartment,
    policy,
    account,
    employee,
    head,
    admin,
    superadmin,
    outsider,
    api,
    submit,
    action,
    savedLeave,
    expectLeaveReadDenied,
    expectLeaveNotifications,
    noticePath,
    expectAttendanceConflict,
    setRequesterActive,
    verifiedLeave,
    expectRequesterConflict,
    setDepartmentHead,
    pendingLeaveQueue,
    inboxFor,
    markLeaveNoticeRead,
    clock,
  }
}

export type LeaveContext = Awaited<ReturnType<typeof createLeaveContext>>
export type Account = LeaveContext["employee"]
