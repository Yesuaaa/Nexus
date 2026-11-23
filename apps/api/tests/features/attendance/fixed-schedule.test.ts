import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { attendancePolicyDays } from "../../../src/features/attendance/attendance.validation.js"
import { startPgliteApp } from "../../support/pglite-app.js"

const days = Array.from({ length: 7 }, (_, weekday) => {
  const rule = { weekday, isWorkingDay: [1, 2, 3].includes(weekday) }
  if (!rule.isWorkingDay) return rule
  return {
    ...rule,
    scheduledStartMinute: weekday === 2 ? 540 : 1320,
    scheduledEndMinute: weekday === 2 ? 1020 : 360,
    scheduledUnpaidBreakMinutes: 30,
  }
})

test("fixed schedule validation derives required minutes and rejects ambiguous rules", () => {
  const rules = attendancePolicyDays(days, "FIXED")
  assert.equal(rules[0].requiredMinutes, 0)
  assert.equal(rules[1].requiredMinutes, 450)
  assert.equal(rules[2].requiredMinutes, 450)
  const changeMonday = (change: Record<string, unknown>) =>
    days.map((day) => (day.weekday === 1 ? { ...day, ...change } : day))
  assert.throws(
    () => attendancePolicyDays(days, "FIXED", false),
    /Enable unpaid breaks/,
  )
  assert.throws(
    () =>
      attendancePolicyDays(changeMonday({ scheduledEndMinute: 1320 }), "FIXED"),
    /different start and end/,
  )
  assert.throws(
    () =>
      attendancePolicyDays(changeMonday({ scheduledEndMinute: 1440 }), "FIXED"),
    /different start and end/,
  )
  assert.throws(
    () =>
      attendancePolicyDays(changeMonday({ scheduledEndMinute: 541 }), "FIXED"),
    /overlap/,
  )
  assert.throws(
    () =>
      attendancePolicyDays(
        changeMonday({ scheduledUnpaidBreakMinutes: 480 }),
        "FIXED",
      ),
    /shorter/,
  )
  assert.throws(
    () => attendancePolicyDays(changeMonday({ requiredMinutes: 120 }), "FIXED"),
    /calculated/,
  )
})

type Workday = {
  id: string | null
  workDate: string
  requiredMinutes: number
  workedMinutes: number
  activeSessionId: string
  activeBreakId: string
  overnightRequiresReview: boolean
  schedule: {
    startsAt: string
    endsAt: string
    unpaidBreakMinutes: number
    lateArrivalMinutes: number
    earlyDepartureMinutes: number
  }
}

test(
  "fixed schedules preserve punches, historical rules, and existing permissions",
  { timeout: 120000 },
  async (t) => {
    let now = new Date("2026-11-23T12:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    const [gap] = await prisma.$queryRaw<
      { scheduledStartAt: Date; scheduledEndAt: Date }[]
    >`SELECT * FROM attendance_schedule_at('2026-03-08'::date, 'America/New_York', 165, 195)`
    assert.equal(gap.scheduledStartAt.toISOString(), "2026-03-08T07:45:00.000Z")
    assert.equal(gap.scheduledEndAt.toISOString(), "2026-03-08T08:15:00.000Z")
    const admin = await prisma.user.create({
      data: {
        email: "fixed-admin@test.example",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "fixed-staff@test.example",
        passwordHash: "test-only",
        role: "STAFF",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "FIXED-001",
        fullName: "Fixed Employee",
        userId: staff.id,
      },
    })
    const adminToken = (await issueSession(admin)).token
    const staffToken = (await issueSession(staff)).token
    async function request(
      path: string,
      token: string,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${base}/attendance${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }
    async function punch(path: string, body: unknown, expected = 200) {
      const response = await request(`/me/${path}`, staffToken, "POST", body)
      assert.equal(response.status, expected, await response.clone().text())
      return ((await response.json()) as { workday: Workday }).workday
    }
    const input = {
      name: "Scheduled team",
      timeZone: "Asia/Manila",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: true,
      scheduleMode: "FIXED",
      days,
    }
    assert.equal(
      (await request("/policies", staffToken, "POST", input)).status,
      403,
    )
    const created = await request("/policies", adminToken, "POST", input)
    assert.equal(created.status, 201, await created.clone().text())
    const { policy } = (await created.json()) as { policy: { id: string } }
    const assigned = await request("/assignments", adminToken, "POST", {
      policyId: policy.id,
      employeeId: employee.id,
      effectiveFrom: "2026-11-23",
    })
    assert.equal(assigned.status, 201, await assigned.clone().text())

    now = new Date("2026-11-24T00:15:00+08:00")
    const previewResponse = await request("/me/current", staffToken)
    assert.equal(
      previewResponse.status,
      200,
      await previewResponse.clone().text(),
    )
    const preview = ((await previewResponse.json()) as { workday: Workday })
      .workday
    assert.equal(preview.id, null)
    assert.equal(preview.workDate, "2026-11-23")
    assert.equal(preview.requiredMinutes, 450)
    assert.equal(preview.schedule.startsAt, "2026-11-23T14:00:00.000Z")
    assert.equal(preview.schedule.endsAt, "2026-11-23T22:00:00.000Z")
    assert.equal(await prisma.attendanceWorkday.count(), 0)
    assert.equal(
      (await request("/me/clock-in", staffToken, "POST", { startedAt: now }))
        .status,
      400,
    )
    const started = await punch("clock-in", {}, 201)
    assert.equal(started.workDate, preview.workDate)
    assert.equal(started.schedule.lateArrivalMinutes, 135)
    const { activeSessionId: sessionId } = started
    now = new Date("2026-11-24T01:00:00+08:00")
    const { activeBreakId: breakId } = await punch("breaks/start", {
      sessionId,
    })
    now = new Date("2026-11-24T01:10:00+08:00")
    await punch("breaks/end", { sessionId, breakId })
    now = new Date("2026-11-24T05:45:00+08:00")
    const ended = await punch("clock-out", { sessionId })
    assert.equal(ended.workedMinutes, 320)
    assert.equal(ended.schedule.earlyDepartureMinutes, 0)
    assert.equal(ended.schedule.unpaidBreakMinutes, 30)

    const policyPath = `/policies/${policy.id}`
    const legacy = {
      ...input,
      scheduleMode: undefined,
      days: days.map(({ weekday, isWorkingDay }) => ({
        weekday,
        isWorkingDay,
        requiredMinutes: isWorkingDay ? 450 : 0,
      })),
    }
    assert.equal(
      (await request(policyPath, staffToken, "PATCH", input)).status,
      403,
    )
    assert.equal(
      (await request(policyPath, adminToken, "PATCH", legacy)).status,
      409,
    )
    const updated = await request(policyPath, adminToken, "PATCH", {
      ...input,
      days: days.map((day) =>
        day.weekday === 1 ? { ...day, scheduledEndMinute: 300 } : day,
      ),
    })
    assert.equal(updated.status, 200, await updated.clone().text())
    now = new Date("2026-11-24T05:50:00+08:00")
    const current = await request("/me/current", staffToken)
    assert.equal(
      ((await current.json()) as { workday: Workday }).workday.id,
      started.id,
    )
    const resumed = await punch("clock-in", {}, 201)
    assert.equal(resumed.id, started.id)
    now = new Date("2026-11-24T05:55:00+08:00")
    const finished = await punch("clock-out", {
      sessionId: resumed.activeSessionId,
    })
    assert.equal(finished.workedMinutes, 325)
    assert.equal(finished.schedule.earlyDepartureMinutes, 0)
    now = new Date("2026-11-24T06:00:00+08:00")
    const history = await request(
      "/me/history?from=2026-11-23&to=2026-11-23",
      staffToken,
    )
    const [record] = ((await history.json()) as { workdays: Workday[] })
      .workdays
    assert.equal(record.requiredMinutes, 450)
    assert.equal(record.schedule.endsAt, preview.schedule.endsAt)
    assert.equal(record.schedule.earlyDepartureMinutes, 5)

    now = new Date("2026-11-24T09:00:00+08:00")
    const daytime = await punch("clock-in", {}, 201)
    assert.equal(daytime.workDate, "2026-11-24")
    now = new Date("2026-11-25T00:15:00+08:00")
    assert.equal(
      (await punch("clock-out", { sessionId: daytime.activeSessionId }))
        .overnightRequiresReview,
      true,
    )
    now = new Date("2026-11-25T22:00:00+08:00")
    const overnight = await punch("clock-in", {}, 201)
    now = new Date("2026-11-26T06:00:00+08:00")
    const completed = await punch("clock-out", {
      sessionId: overnight.activeSessionId,
    })
    assert.equal(completed.workDate, "2026-11-25")
    assert.equal(completed.workedMinutes, 480)
    assert.equal(completed.overnightRequiresReview, false)
  },
)
