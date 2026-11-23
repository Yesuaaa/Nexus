import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type Logs = {
  events: {
    id: string
    source: string
    event: string
    effects: { id: string }[]
  }[]
  asOf: string
  snapshot: string
  total: number
  page: number
  pageSize: number
}

test(
  "WC-07-F04 finds literal and display area names through the Workforce Logs API",
  { timeout: 120_000 },
  async (t) => {
    let now = new Date("2026-11-14T08:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    async function account(name: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          fullName: name,
          email: `${role.toLowerCase()}-private-contact@area.test`,
          passwordHash: "test-only",
          role,
        },
      })
      return { ...user, ...(await issueSession(user)) }
    }
    const superadmin = await account("Area Reader", "SUPERADMIN")
    const hr = await account("Area HR", "ADMIN")
    const staff = await account("Area Worker", "STAFF")
    const client = await account("Area Client", "USER")
    const employee = await prisma.employee.create({
      data: {
        employeeId: "EXP-AREA-SEARCH",
        fullName: "Area Worker",
        userId: staff.id,
        contactNumber: "09173428761",
      },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Area policy",
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
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    function request(path: string, actor?: typeof staff, body?: object) {
      return fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(actor && { authorization: `Bearer ${actor.token}` }),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
    }
    const endpoint = "/workforce-compliance-logs"
    const privateFields = [
      "fixture-private-reason",
      "fixture-private-note",
      "fixture-raw-payload",
      "fixture-private-key",
      staff.email,
      employee.contactNumber!,
    ]
    async function read(query: Record<string, string>) {
      const response = await request(
        `${endpoint}?${new URLSearchParams(query)}`,
        superadmin,
      )
      const body = await response.text()
      assert.equal(response.status, 200, body)
      for (const value of privateFields) assert.ok(!body.includes(value), value)
      assert.doesNotMatch(body, /"requestKey"|"originalSession"|"reviewNote"/)
      return JSON.parse(body) as Logs
    }
    const ids = (result: Logs) => result.events.map(({ id }) => id)
    const correlations: string[] = []
    const from = new Date(Date.now() - 1000).toISOString()
    for (const date of ["2026-11-14", "2026-11-15"]) {
      now = new Date(`${date}T08:00:00+08:00`)
      const opened = await request("/attendance/me/clock-in", staff, {})
      assert.equal(opened.status, 201, await opened.clone().text())
      const { workday } = (await opened.json()) as {
        workday: { activeSessionId: string }
      }
      now = new Date(`${date}T16:00:00+08:00`)
      const closed = await request("/attendance/me/clock-out", staff, {
        sessionId: workday.activeSessionId,
      })
      assert.equal(closed.status, 200, await closed.clone().text())
      for (const response of [opened, closed]) {
        const trace = response.headers.get("x-correlation-id")
        assert.ok(trace)
        correlations.push(trace)
      }
    }
    const punchRows = await prisma.attendanceAudit.findMany({
      where: {
        correlationId: { in: correlations },
        entityType: "AttendanceWorkSession",
      },
    })
    assert.equal(punchRows.length, 4)
    const punchIds = [...punchRows]
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.operationId! < b.operationId! ? 1 : -1),
      )
      .map(({ operationId }) => operationId)
    const timeLogs = { source: "time-logs" }
    const display = await read({ ...timeLogs, search: "Time Logs" })
    const literal = await read({ ...timeLogs, search: "time-logs" })
    assert.equal(display.total, 4)
    assert.deepEqual(ids(display), punchIds)
    assert.equal(
      literal.total,
      4,
      JSON.stringify({
        display: display.total,
        literal: literal.total,
        stored: punchIds,
      }),
    )
    assert.deepEqual(ids(literal), punchIds)

    const sample = punchRows.find(({ action }) => action === "UPDATE")!
    const filtered = await read({
      ...timeLogs,
      search: "TIME-LOGS",
      event: "UPDATED",
      actorId: staff.id,
      subjectId: sample.entityId,
      correlationId: sample.correlationId!,
      operationId: sample.operationId!,
      from,
      to: new Date().toISOString(),
    })
    assert.equal(filtered.total, 1)
    assert.deepEqual(ids(filtered), [sample.operationId])
    assert.deepEqual(
      filtered.events[0].effects.map(({ id }) => id),
      [sample.id],
    )
    assert.equal(
      (
        await read({
          ...timeLogs,
          search: "time-logs",
          correlationId: sample.correlationId!,
          event: "CREATED",
        })
      ).total,
      0,
    )
    assert.equal(
      (
        await read({
          ...timeLogs,
          search: "time-logs",
          from: "2020-01-01",
          to: "2020-01-02",
        })
      ).total,
      0,
    )

    const stamp = Date.now() - 60_000
    await prisma.attendanceAudit.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        id: `area-history-${index}`,
        actionId: randomUUID(),
        entityId: `fixture-session-${index}`,
        entityType: "AttendanceWorkSession",
        employeeId: employee.id,
        actorId: staff.id,
        action: "INSERT",
        reason: privateFields[0],
        createdAt: new Date(stamp - index * 1000),
        after: {
          startedAt: new Date(stamp).toISOString(),
          endedAt: null,
          email: staff.email,
          contactNumber: employee.contactNumber,
          originalSession: privateFields[2],
          requestKey: privateFields[3],
        },
      })),
    })
    for (const [id, type] of [
      ["area-correction", "CORRECTION"],
      ["area-overtime", "OVERTIME"],
    ]) {
      await prisma.attendanceAudit.create({
        data: {
          id,
          actionId: randomUUID(),
          entityId: id,
          entityType: "AttendanceAdjustment",
          employeeId: employee.id,
          actorId: staff.id,
          action: "INSERT",
          reason: privateFields[0],
          createdAt: new Date(stamp),
          after: { type, status: "PENDING", reviewNote: privateFields[1] },
        },
      })
    }
    const submitted = await request("/leave/requests", staff, {
      requestKey: randomUUID(),
      type: "SICK",
      reason: privateFields[0],
      startDate: "2026-11-16",
      endDate: "2026-11-16",
    })
    assert.equal(submitted.status, 201, await submitted.clone().text())
    const { request: leave } = (await submitted.json()) as {
      request: { id: string }
    }
    const approved = await request(
      `/leave/requests/${leave.id}/approve`,
      superadmin,
      {
        actionId: randomUUID(),
        expectedVersion: 1,
        note: privateFields[1],
      },
    )
    assert.equal(approved.status, 200, await approved.clone().text())
    const state = async () => ({
      audits: await prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } }),
      leaveDecisions: await prisma.leaveDecision.findMany({
        orderBy: { id: "asc" },
      }),
      leave: await prisma.leaveRequest.findUnique({ where: { id: leave.id } }),
      sessions: await prisma.attendanceWorkSession.findMany({
        orderBy: { id: "asc" },
      }),
      employee: await prisma.employee.findUnique({
        where: { id: employee.id },
      }),
    })
    const beforeReads = await state()
    const expected = [
      ...punchIds,
      ...Array.from(
        { length: 25 },
        (_, index) => `attendance:area-history-${index}`,
      ),
    ]
    for (const search of ["Time Logs", "time-logs", "TiMe-LoGs", "TIME LOGS"]) {
      const query = { ...timeLogs, search }
      const first = await read(query)
      const second = await read({
        ...query,
        page: "2",
        asOf: first.asOf,
        snapshot: first.snapshot,
      })
      assert.equal(first.total, 29)
      assert.equal(second.total, first.total)
      assert.equal(first.pageSize, 25)
      assert.equal(second.page, 2)
      assert.equal(second.asOf, first.asOf)
      assert.equal(second.snapshot, first.snapshot)
      assert.deepEqual(ids(first), expected.slice(0, 25))
      assert.deepEqual(ids(second), expected.slice(25))
      assert.ok(
        [...first.events, ...second.events].every(
          ({ source }) => source === timeLogs.source,
        ),
      )
    }
    assert.deepEqual(
      ids(await read({ search: "time-logs" })),
      expected.slice(0, 25),
    )
    for (const [source, subjectId, expectedIds] of [
      [
        "policies",
        policy.id,
        beforeReads.audits
          .filter(({ entityId }) => entityId === policy.id)
          .map(({ id }) => `attendance:${id}`),
      ],
      ["corrections", "area-correction", ["attendance:area-correction"]],
      ["overtime", "area-overtime", ["attendance:area-overtime"]],
      [
        "leave",
        leave.id,
        beforeReads.leaveDecisions.map(({ operationId }) => operationId),
      ],
    ] as const) {
      assert.ok(expectedIds.length > 0)
      for (const search of [source, source.toUpperCase()]) {
        const result = await read({ source, subjectId, search })
        assert.equal(result.total, expectedIds.length)
        assert.deepEqual(ids(result).sort(), [...expectedIds].sort())
      }
    }
    for (const search of [
      ...privateFields,
      "time-logz",
      "time-lo",
      "area without matches",
      "time_logs",
      "%",
    ]) {
      assert.equal((await read({ search })).total, 0, search)
    }
    assert.equal(
      (await read({ source: "policies", search: "time-logs" })).total,
      0,
    )
    const url = `${endpoint}?source=time-logs&search=time-logs`
    assert.equal((await request(url)).status, 401)
    for (const account of [hr, staff, client])
      assert.equal((await request(url, account)).status, 403)
    for (const invalid of [
      "source=invalid",
      "search=time-logs&search=again",
      "page=0",
      "correlationId=invalid",
    ])
      assert.equal(
        (await request(`${endpoint}?${invalid}`, superadmin)).status,
        400,
      )
    assert.deepEqual(await state(), beforeReads)
  },
)
