import assert from "node:assert/strict"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type Workday = {
  id: string | null
  workDate: string
  timeZone: string
  requiredMinutes: number
  workedHours: number
  workedMilliseconds: number
  remainingMinutes: number
  excessMinutes: number
  excessRequiresReview: boolean
  progressPercent: number | null
  status: string
  isComplete: boolean
  activeSessionId: string | null
  activeBreakId: string | null
  sessions: {
    id: string
    startedAt: string
    endedAt: string | null
    breaks: { id: string; isPaid: boolean; endedAt: string | null }[]
  }[]
}
type State = {
  asOf: string
  employeeId: string
  needsPolicy: boolean
  workday: Workday | null
}
type History = {
  employeeId: string
  total: number
  page: number
  pageSize: number
  workdays: Workday[]
}

test(
  "attendance backend enforces ownership, overnight attribution, progress and breaks",
  { timeout: 120000 },
  async (t) => {
    let time = new Date("2026-11-13T20:00:00+08:00")
    const at = (value: string) => {
      time = new Date(value)
    }
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => new Date(time) },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Eight flexible hours",
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
      role: Role = "STAFF",
      withProfile = true,
      withPolicy = true,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@attendance.test`,
          role,
          isActive: true,
          passwordHash: "test-only",
        },
      })
      const employee = withProfile
        ? await prisma.employee.create({
            data: {
              employeeId: `ATT-${name}`,
              fullName: name,
              userId: user.id,
            },
          })
        : null
      if (employee && withPolicy)
        await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId: employee.id,
            policyId: policy.id,
            effectiveFrom: new Date("2026-01-01"),
          },
        })
      const token = (await issueSession(user)).token
      return { user, employee, token }
    }
    type Actor = Awaited<ReturnType<typeof account>>
    const staff = await account("staff")
    const other = await account("other")
    const admin = await account("admin", "ADMIN")
    const superadmin = await account("superadmin", "SUPERADMIN")
    const client = await account("client", "USER")
    async function request(actor: Actor | null, path: string, body?: unknown) {
      return fetch(`${base}/attendance${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    async function state(
      actor: Actor,
      path: string,
      body?: unknown,
      status = 200,
    ): Promise<State> {
      const result = await request(actor, path, body)
      assert.equal(result.status, status, await result.clone().text())
      return result.json() as Promise<State>
    }
    const historyPath = "/me/history?from=2026-11-13&to=2026-11-14"

    await t.test(
      "authentication and fixed role boundaries apply to all attendance routes",
      async () => {
        for (const path of [
          "/me/current",
          historyPath,
          `/employees/${staff.employee!.id}/history`,
        ])
          assert.equal((await request(null, path)).status, 401)
        for (const path of [
          "/me/clock-in",
          "/me/clock-out",
          "/me/breaks/start",
          "/me/breaks/end",
        ])
          assert.equal((await request(null, path, {})).status, 401)
        for (const actor of [client, superadmin]) {
          assert.equal((await request(actor, "/me/current")).status, 403)
          assert.equal((await request(actor, historyPath)).status, 403)
          assert.equal((await request(actor, "/me/clock-in", {})).status, 403)
        }
        const missing = await account("missing", "STAFF", false)
        assert.equal((await request(missing, "/me/clock-in", {})).status, 409)
        assert.equal(
          (await request(staff, `/employees/${other.employee!.id}/history`))
            .status,
          403,
        )
      },
    )

    let overnightDayId: string
    let overnightSessionId: string
    await t.test("20:00 Nov 13 to 04:00 Nov 14 remains on Nov 13", async () => {
      const before = await state(staff, "/me/current")
      assert.equal(before.workday!.id, null)
      assert.equal(before.workday!.status, "NOT_STARTED")
      assert.equal(await prisma.attendanceWorkday.count(), 0)
      const start = await state(staff, "/me/clock-in", {}, 201)
      overnightDayId = start.workday!.id!
      overnightSessionId = start.workday!.activeSessionId!
      assert.equal(start.workday!.workDate, "2026-11-13")
      assert.equal((await request(staff, "/me/clock-in", {})).status, 409)
      at("2026-11-14T00:30:00+08:00")
      const midnight = await state(staff, "/me/current")
      assert.equal(midnight.workday!.workedHours, 4.5)
      assert.equal(midnight.workday!.workDate, "2026-11-13")
      assert.equal(midnight.workday!.activeSessionId, overnightSessionId)
      assert.equal(midnight.workday!.sessions[0].endedAt, null)
      at("2026-11-14T04:00:00+08:00")
      const end = await state(staff, "/me/clock-out", {
        sessionId: overnightSessionId,
      })
      assert.equal(end.workday!.workedHours, 8)
      assert.equal(end.workday!.status, "COMPLETE")
      assert.equal(end.workday!.progressPercent, 100)
      assert.equal(end.workday!.excessRequiresReview, false)
      assert.equal(
        end.workday!.sessions[0].startedAt,
        "2026-11-13T12:00:00.000Z",
      )
      assert.equal(end.workday!.sessions[0].endedAt, "2026-11-13T20:00:00.000Z")
      const nextDate = await request(
        staff,
        "/me/history?from=2026-11-14&to=2026-11-14",
      )
      assert.equal(((await nextDate.json()) as History).total, 0)
      const current = await state(staff, "/me/current")
      assert.equal(current.workday!.workedHours, 0)
      assert.equal(current.workday!.workDate, "2026-11-14")
      const audit = await prisma.attendanceAudit.findFirstOrThrow({
        where: { entityId: overnightSessionId, action: "UPDATE" },
      })
      assert.equal(audit.actorId, staff.user.id)
      assert.equal(audit.reason, "Employee clock-out")
    })

    await t.test(
      "explicit overnight continuation shares the requirement; excess stays unapproved",
      async () => {
        at("2026-11-14T04:30:00+08:00")
        const resume = await state(
          staff,
          "/me/clock-in",
          { workdayId: overnightDayId },
          201,
        )
        const continuation = resume.workday!.activeSessionId!
        assert.equal(resume.workday!.id, overnightDayId)
        at("2026-11-14T05:30:00+08:00")
        const end = await state(staff, "/me/clock-out", {
          sessionId: continuation,
        })
        assert.equal(end.workday!.sessions.length, 2)
        assert.equal(end.workday!.requiredMinutes, 480)
        assert.equal(end.workday!.workedHours, 9)
        assert.equal(end.workday!.excessMinutes, 60)
        assert.equal(end.workday!.excessRequiresReview, true)
        assert.equal(end.workday!.isComplete, true)
        at("2026-11-14T20:00:00+08:00")
        const next = await state(staff, "/me/clock-in", {}, 201)
        assert.equal(next.workday!.workDate, "2026-11-14")
        assert.equal(next.workday!.workedHours, 0)
        assert.equal(
          (
            await request(staff, "/me/clock-out", {
              sessionId: overnightSessionId,
            })
          ).status,
          409,
        )
        at("2026-11-15T04:00:00+08:00")
        await state(staff, "/me/clock-out", {
          sessionId: next.workday!.activeSessionId,
        })
        const history = (await (
          await request(staff, historyPath)
        ).json()) as History
        assert.deepEqual(
          history.workdays.map((day) => [day.workDate, day.workedHours]),
          [
            ["2026-11-14", 8],
            ["2026-11-13", 9],
          ],
        )
        at("2026-11-16T09:00:00+08:00")
        assert.equal(
          (await request(staff, "/me/clock-in", { workdayId: overnightDayId }))
            .status,
          409,
        )
      },
    )

    await t.test(
      "unpaid breaks crossing midnight freeze progress and enforce transitions",
      async () => {
        at("2026-11-13T20:00:00+08:00")
        const start = await state(other, "/me/clock-in", {}, 201)
        const sessionId = start.workday!.activeSessionId!
        assert.equal(
          (
            await request(other, "/me/breaks/end", {
              sessionId,
              breakId: "missing",
            })
          ).status,
          409,
        )
        at("2026-11-13T23:30:00+08:00")
        const paused = await state(other, "/me/breaks/start", { sessionId })
        const breakId = paused.workday!.activeBreakId!
        assert.equal(paused.workday!.sessions[0].breaks[0].isPaid, false)
        assert.equal(
          (await request(other, "/me/breaks/start", { sessionId })).status,
          409,
        )
        assert.equal(
          (await request(other, "/me/clock-out", { sessionId })).status,
          409,
        )
        assert.equal(
          (await request(other, "/me/breaks/end", { sessionId, breakId }))
            .status,
          409,
        )
        at("2026-11-14T00:00:00+08:00")
        assert.equal(
          (await state(other, "/me/current")).workday!.workedHours,
          3.5,
        )
        at("2026-11-14T00:30:00+08:00")
        const resumed = await state(other, "/me/breaks/end", {
          sessionId,
          breakId,
        })
        assert.equal(resumed.workday!.workedHours, 3.5)
        assert.equal(
          (await request(other, "/me/breaks/end", { sessionId, breakId }))
            .status,
          409,
        )
        at("2026-11-14T04:00:00+08:00")
        const end = await state(other, "/me/clock-out", { sessionId })
        assert.equal(end.workday!.workedHours, 7)
        assert.equal(end.workday!.remainingMinutes, 60)
        assert.equal(end.workday!.status, "INCOMPLETE")
        assert.equal(end.workday!.isComplete, false)
        assert.equal(end.workday!.workDate, "2026-11-13")
        assert.equal(
          (await request(other, "/me/breaks/start", { sessionId })).status,
          409,
        )
      },
    )

    await t.test(
      "clock-out during an overnight break closes both records and preserves unpaid time",
      async () => {
        const employee = await account("break-clock-out")
        at("2026-11-13T13:00:00+08:00")
        const start = await state(employee, "/me/clock-in", {}, 201)
        const sessionId = start.workday!.activeSessionId!
        at("2026-11-13T15:00:00+08:00")
        const first = await state(employee, "/me/breaks/start", { sessionId })
        at("2026-11-13T17:00:00+08:00")
        await state(employee, "/me/breaks/end", {
          sessionId,
          breakId: first.workday!.activeBreakId!,
        })
        at("2026-11-14T00:00:00+08:00")
        const paused = await state(employee, "/me/breaks/start", { sessionId })
        assert.equal(paused.workday!.workedHours, 9)
        at("2026-11-14T02:00:00+08:00")
        const closed = (await state(employee, "/me/clock-out", { sessionId }))
          .workday!
        assert.equal(closed.activeSessionId, null)
        assert.equal(closed.activeBreakId, null)
        assert.equal(closed.workDate, "2026-11-13")
        assert.equal(closed.workedHours, 9)
        assert.equal(closed.status, "COMPLETE")
        assert.equal(closed.excessMinutes, 60)
        const session = closed.sessions[0]
        assert.equal(session.breaks.length, 2)
        assert.equal(session.endedAt, "2026-11-13T18:00:00.000Z")
        assert.equal(session.breaks[1].endedAt, session.endedAt)
        assert.equal(
          (
            await request(employee, "/me/breaks/end", {
              sessionId,
              breakId: paused.workday!.activeBreakId!,
            })
          ).status,
          409,
        )
        assert.equal(
          (await request(employee, "/me/clock-out", { sessionId })).status,
          409,
        )
      },
    )

    await t.test(
      "employees cannot target another employee or supply timestamps or paid breaks",
      async () => {
        at("2026-11-14T04:00:00+08:00")
        for (const body of [
          { employeeId: other.employee!.id },
          { startedAt: "2026-11-13T09:00:00Z" },
          { timeZone: "UTC" },
          { workdayId: "account:fake" },
          null,
          [],
        ])
          assert.equal((await request(staff, "/me/clock-in", body)).status, 400)
        const foreign = await prisma.attendanceWorkSession.findFirstOrThrow({
          where: { employeeId: other.employee!.id },
        })
        for (const actor of [staff, admin]) {
          assert.equal(
            (await request(actor, "/me/clock-out", { sessionId: foreign.id }))
              .status,
            404,
          )
          assert.equal(
            (
              await request(actor, "/me/breaks/start", {
                sessionId: foreign.id,
              })
            ).status,
            404,
          )
          assert.equal(
            (
              await request(actor, "/me/clock-in", {
                workdayId: foreign.workdayId,
              })
            ).status,
            404,
          )
        }
        assert.equal(
          (await request(staff, `/me/history?employeeId=${other.employee!.id}`))
            .status,
          400,
        )
        assert.equal(
          (
            await request(staff, "/me/breaks/start", {
              sessionId: foreign.id,
              isPaid: true,
            })
          ).status,
          400,
        )
        assert.equal((await request(staff, "/me/clock-out", {})).status, 400)
        assert.equal(
          (await request(staff, "/me/breaks/end", { sessionId: foreign.id }))
            .status,
          400,
        )
        const reviewed = await request(
          admin,
          `/employees/${other.employee!.id}/history?from=2026-11-13&to=2026-11-13`,
        )
        assert.equal(reviewed.status, 200)
        assert.equal(
          ((await reviewed.json()) as History).workdays[0].workedHours,
          7,
        )
        assert.equal(
          (
            await request(
              superadmin,
              `/employees/${other.employee!.id}/history`,
            )
          ).status,
          403,
        )
      },
    )

    await t.test(
      "missing policy does not invent hours or create partial workdays",
      async () => {
        const unconfigured = await account("unconfigured", "STAFF", true, false)
        assert.equal(
          (await state(unconfigured, "/me/current")).needsPolicy,
          true,
        )
        assert.equal(
          (await request(unconfigured, "/me/clock-in", {})).status,
          409,
        )
        assert.equal(
          await prisma.attendanceWorkday.count({
            where: { employeeId: unconfigured.employee!.id },
          }),
          0,
        )
      },
    )

    await t.test(
      "same-date split sessions automatically reuse the daily requirement",
      async () => {
        const split = await account("split")
        at("2026-11-13T09:00:00+08:00")
        const morning = await state(split, "/me/clock-in", {}, 201)
        assert.equal(morning.workday!.status, "IN_PROGRESS")
        at("2026-11-13T12:00:00+08:00")
        const early = await state(split, "/me/clock-out", {
          sessionId: morning.workday!.activeSessionId,
        })
        assert.equal(early.workday!.status, "INCOMPLETE")
        at("2026-11-13T13:00:00+08:00")
        const afternoon = await state(split, "/me/clock-in", {}, 201)
        assert.equal(afternoon.workday!.status, "IN_PROGRESS")
        assert.equal(afternoon.workday!.id, morning.workday!.id)
        assert.equal(afternoon.workday!.workedHours, 3)
        at("2026-11-13T18:00:00+08:00")
        assert.equal(
          (await state(split, "/me/current")).workday!.status,
          "HOURS_MET",
        )
        const complete = await state(split, "/me/clock-out", {
          sessionId: afternoon.workday!.activeSessionId,
        })
        assert.equal(complete.workday!.workedHours, 8)
        assert.equal(complete.workday!.requiredMinutes, 480)
        assert.equal(complete.workday!.status, "COMPLETE")
        assert.equal(
          await prisma.attendanceWorkday.count({
            where: { employeeId: split.employee!.id },
          }),
          1,
        )
      },
    )

    await t.test(
      "policy-specific required hours and rest days are reported without defaults",
      async () => {
        const flexible = await account("flexible", "STAFF", true, false)
        const shorter = await prisma.attendancePolicy.create({
          data: {
            name: "Six hours, Sunday rest",
            timeZone: "Asia/Manila",
            days: {
              create: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: weekday !== 0,
                requiredMinutes: weekday === 0 ? 0 : 360,
              })),
            },
          },
        })
        await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId: flexible.employee!.id,
            policyId: shorter.id,
            effectiveFrom: new Date("2026-01-01"),
          },
        })
        at("2026-11-13T11:00:00+08:00")
        const start = await state(flexible, "/me/clock-in", {}, 201)
        at("2026-11-13T14:00:00+08:00")
        const half = await state(flexible, "/me/current")
        assert.equal(half.workday!.progressPercent, 50)
        assert.equal(half.workday!.remainingMinutes, 180)
        at("2026-11-13T17:00:00+08:00")
        assert.equal(
          (
            await state(flexible, "/me/clock-out", {
              sessionId: start.workday!.activeSessionId,
            })
          ).workday!.status,
          "COMPLETE",
        )
        at("2026-11-15T09:00:00+08:00")
        const rest = await state(flexible, "/me/current")
        assert.equal(rest.workday!.status, "NOT_REQUIRED")
        assert.equal(rest.workday!.requiredMinutes, 0)
        assert.equal(rest.workday!.progressPercent, null)
        const extra = await state(flexible, "/me/clock-in", {}, 201)
        at("2026-11-15T10:00:00+08:00")
        const recorded = await state(flexible, "/me/clock-out", {
          sessionId: extra.workday!.activeSessionId,
        })
        assert.equal(recorded.workday!.workedHours, 1)
        assert.equal(recorded.workday!.excessRequiresReview, true)
        assert.equal(recorded.workday!.excessMinutes, 60)
      },
    )

    await t.test(
      "concurrent actions serialize and cannot create duplicate active records",
      async () => {
        const concurrent = await account("concurrent")
        at("2026-11-13T09:00:00+08:00")
        const starts = await Promise.all([
          request(concurrent, "/me/clock-in", {}),
          request(concurrent, "/me/clock-in", {}),
        ])
        assert.deepEqual(
          starts.map((result) => result.status).sort(),
          [201, 409],
        )
        const sessionId = (await state(concurrent, "/me/current")).workday!
          .activeSessionId!
        at("2026-11-13T10:00:00+08:00")
        const pauses = await Promise.all([
          request(concurrent, "/me/breaks/start", { sessionId }),
          request(concurrent, "/me/breaks/start", { sessionId }),
        ])
        assert.deepEqual(
          pauses.map((result) => result.status).sort(),
          [200, 409],
        )
        const breakId = (await state(concurrent, "/me/current")).workday!
          .activeBreakId!
        at("2026-11-13T10:30:00+08:00")
        await state(concurrent, "/me/breaks/end", { sessionId, breakId })
        at("2026-11-13T17:30:00+08:00")
        const ends = await Promise.all([
          request(concurrent, "/me/clock-out", { sessionId }),
          request(concurrent, "/me/clock-out", { sessionId }),
        ])
        assert.deepEqual(ends.map((result) => result.status).sort(), [200, 409])
        assert.equal(
          await prisma.attendanceWorkSession.count({
            where: { employeeId: concurrent.employee!.id },
          }),
          1,
        )
        assert.equal(
          await prisma.attendanceBreak.count({ where: { sessionId } }),
          1,
        )
      },
    )

    await t.test(
      "status changes block new sessions but permit closing already-recorded work",
      async () => {
        const changing = await account("changing")
        at("2026-11-13T09:00:00+08:00")
        const sessionId = (await state(changing, "/me/clock-in", {}, 201))
          .workday!.activeSessionId!
        await prisma.employee.update({
          where: { id: changing.employee!.id },
          data: { status: "ON_LEAVE" },
        })
        at("2026-11-13T10:00:00+08:00")
        await state(changing, "/me/clock-out", { sessionId })
        assert.equal((await request(changing, "/me/clock-in", {})).status, 403)
        await prisma.user.update({
          where: { id: changing.user.id },
          data: { role: "USER" },
        })
        assert.equal((await request(changing, "/me/current")).status, 403)
        await prisma.user.update({
          where: { id: changing.user.id },
          data: { isActive: false },
        })
        assert.equal((await request(changing, "/me/history")).status, 401)
      },
    )

    await t.test(
      "history is bounded, paginated, and filtered by attendance date",
      async () => {
        const paged = await account("paged")
        for (let index = 1; index <= 12; index++) {
          const date = `2026-10-${String(index).padStart(2, "0")}`
          await prisma.attendanceWorkSession.create({
            data: {
              employeeId: paged.employee!.id,
              startedAt: new Date(`${date}T09:00:00+08:00`),
              endedAt: new Date(`${date}T10:00:00+08:00`),
            },
          })
        }
        const first = (await (
          await request(paged, "/me/history?from=2026-10-01&to=2026-10-31")
        ).json()) as History
        const second = (await (
          await request(
            paged,
            "/me/history?from=2026-10-01&to=2026-10-31&page=2",
          )
        ).json()) as History
        assert.equal(first.total, 12)
        assert.equal(first.workdays.length, 10)
        assert.equal(second.workdays.length, 2)
        assert.equal(
          new Set([...first.workdays, ...second.workdays].map((day) => day.id))
            .size,
          12,
        )
        for (const query of [
          "from=2026-02-30",
          "page=0",
          "page=1&page=2",
          "from=2026-12-01&to=2026-11-01",
          "from=2020-01-01&to=2026-11-13",
          "from[]=2026-11-13",
        ])
          assert.equal(
            (await request(paged, `/me/history?${query}`)).status,
            400,
          )
        assert.equal(
          (await request(admin, "/employees/missing/history")).status,
          404,
        )
      },
    )
  },
)
