import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type Log = {
  operationId?: string
  message: string
  summaryDetail: string | null
  correlationId: string | null
  source: string
  event: string
  actor: { id: string | null; role: Role | null; attribution: string }
  effects: {
    target: { type: string; id: string }
    changes: { field: string; before?: unknown; after?: unknown }[]
  }[]
}

test(
  "Workforce Compliance logs group new operations and safely merge attendance and leave",
  { timeout: 120_000 },
  async (t) => {
    let now = new Date("2026-11-17T08:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    async function account(role: Role) {
      const user = await prisma.user.create({
        data: {
          role,
          fullName: role,
          email: `${role}@compliance.test`,
          passwordHash: "PRIVATE-HASH",
        },
      })
      return { user, token: (await issueSession(user)).token }
    }
    const superadmin = await account("SUPERADMIN")
    const admin = await account("ADMIN")
    const staff = await account("STAFF")
    const client = await account("USER")
    const endpoint = "/workforce-compliance-logs"
    const spoofed = randomUUID()

    function request(path: string, actor = superadmin, body?: object) {
      return fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
          "Content-Type": "application/json",
          "X-Correlation-ID": spoofed,
        },
        body: body && JSON.stringify(body),
      })
    }
    async function read(query = "") {
      const response = await request(endpoint + query)
      const text = await response.text()
      assert.equal(response.status, 200, text)
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.doesNotMatch(
        text,
        /PRIVATE|SICK|requestKey|originalSession|reviewNote|actionId/,
      )
      return JSON.parse(text) as {
        events: Log[]
        total: number
        page: number
        pageSize: number
      }
    }

    assert.equal((await fetch(base + endpoint)).status, 401)
    for (const account of [admin, staff, client])
      assert.equal((await request(endpoint, account)).status, 403)
    for (const query of [
      "page=0",
      "source=unknown",
      "event=unknown",
      "correlationId=bad",
      "from=bad",
      "search=%00",
      "actorId[]=x",
    ])
      assert.equal((await request(`${endpoint}?${query}`)).status, 400)
    assert.equal((await read()).total, 0)

    const policyResponse = await request("/attendance/policies", admin, {
      name: "PRIVATE-POLICY-LABEL",
      timeZone: "Asia/Manila",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
      days: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        isWorkingDay: true,
        requiredMinutes: 60,
      })),
    })
    assert.equal(
      policyResponse.status,
      201,
      await policyResponse.clone().text(),
    )
    const trace = policyResponse.headers.get("X-Correlation-ID")
    assert.ok(trace && trace !== spoofed)
    const { policy } = (await policyResponse.json()) as {
      policy: { id: string }
    }
    const policyLog = await read(`?subjectId=${policy.id}&event=CREATED`)
    assert.equal(policyLog.total, 1)
    const [operation] = policyLog.events
    assert.ok(operation.operationId && operation.operationId !== trace)
    assert.equal(operation.correlationId, trace)
    assert.equal(operation.actor.role, "ADMIN")
    assert.equal(operation.actor.id, admin.user.id)
    assert.equal(operation.effects.length, 8)
    assert.equal(operation.effects[0].target.type, "Attendance policy")
    assert.deepEqual(
      operation.effects[0].changes.find(({ field }) => field === "Policy name"),
      { field: "Policy name" },
    )

    const employee = await prisma.employee.create({
      data: {
        employeeId: "COMP-01",
        fullName: "Workforce Employee",
        userId: staff.user.id,
      },
    })
    const assignment = await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    const legacy = (await read(`?subjectId=${assignment.id}`)).events[0]
    assert.equal(legacy.operationId, undefined)
    assert.equal(legacy.correlationId, null)
    assert.equal(legacy.actor.attribution, "UNKNOWN")
    assert.equal(
      legacy.message,
      "Assigned an attendance policy for Workforce Employee.",
    )

    const clockIn = await request("/attendance/me/clock-in", staff, {})
    assert.equal(clockIn.status, 201, await clockIn.clone().text())
    const session = await prisma.attendanceWorkSession.findFirstOrThrow({
      where: { employeeId: employee.id },
    })
    now = new Date("2026-11-17T10:00:00+08:00")
    const clockOut = await request("/attendance/me/clock-out", staff, {
      sessionId: session.id,
    })
    assert.equal(clockOut.status, 200, await clockOut.clone().text())
    const overtime = await read("?source=overtime&event=SUBMITTED")
    assert.equal(overtime.total, 1)
    assert.equal(
      overtime.events[0].correlationId,
      clockOut.headers.get("X-Correlation-ID"),
    )
    assert.equal(
      overtime.events[0].message,
      "Recorded clock-out for Workforce Employee.",
    )
    assert.equal(
      overtime.events[0].summaryDetail,
      "Overtime request also submitted",
    )
    assert.deepEqual(
      overtime.events[0].effects.map(({ target }) => target.type),
      ["Attendance session", "Overtime request"],
    )

    const input = {
      requestKey: randomUUID(),
      type: "SICK",
      reason: "PRIVATE-LEAVE-REASON",
      startDate: "2026-11-18",
      endDate: "2026-11-18",
    }
    const leave = await request("/leave/requests", staff, input)
    assert.equal(leave.status, 201, await leave.clone().text())
    const { request: leaveRequest } = (await leave.json()) as {
      request: { id: string }
    }
    assert.equal((await request("/leave/requests", staff, input)).status, 201)
    const decision = await request(
      `/leave/requests/${leaveRequest.id}/approve`,
      superadmin,
      {
        actionId: randomUUID(),
        expectedVersion: 1,
        note: "PRIVATE-REVIEW-NOTE",
      },
    )
    assert.equal(decision.status, 200, await decision.clone().text())
    const leaveLogs = await read("?source=leave&search=Workforce+Employee")
    assert.equal(leaveLogs.total, 2)
    const approval = leaveLogs.events.find(({ event }) => event === "APPROVED")
    assert.ok(approval)
    assert.equal(
      approval.message,
      "Approved a leave request for Workforce Employee.",
    )
    assert.equal(
      approval.correlationId,
      decision.headers.get("X-Correlation-ID"),
    )
    assert.deepEqual(approval.effects[0].changes, [
      { field: "Status", before: "SUBMITTED", after: "APPROVED" },
    ])
    assert.equal((await read("?search=PRIVATE")).total, 0)
    assert.equal((await read("?from=2020-01-01&to=2020-01-02")).total, 0)

    for (let index = 0; index < 26; index++)
      await prisma.attendancePolicy.create({
        data: { name: "Legacy policy", timeZone: "Asia/Manila" },
      })
    const first = await read("?source=policies")
    const last = await read("?source=policies&page=999")
    assert.equal(first.total, 28)
    assert.equal(first.pageSize, 25)
    assert.equal(last.page, 2)
    assert.equal(last.events.length, 3)
  },
)
