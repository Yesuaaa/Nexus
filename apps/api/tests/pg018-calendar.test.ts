import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"
import {
  seedPg018,
  calendarSnapshot,
} from "./support/pg018-calendar-fixture.js"
import type { CalendarEvent } from "../src/features/projects/calendar.service.js"

type WireEvent = Omit<CalendarEvent, "startsAt" | "endsAt"> & {
  startsAt: string
  endsAt: string | null
}
const options = { timeout: 120000 }
async function read(origin: string, token: string, query = "") {
  return fetch(origin + "/api/projects/calendar" + query, {
    headers: { authorization: "Bearer " + token },
  })
}

test(
  "[PG-018-F001-A001-T002] calendar HTTP denies anonymous and inactive sessions",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg018(prisma)
    assert.equal((await fetch(origin + "/api/projects/calendar")).status, 401)
    assert.equal((await read(origin, f.staff.token)).status, 200)
    await prisma.user.update({
      where: { id: f.staff.user.id },
      data: { isActive: false },
    })
    assert.equal((await read(origin, f.staff.token)).status, 401)
    assert.equal((await read(origin, f.a.token)).status, 200)
  },
)

test(
  "[PG-018-F001-A019-T002] client milestones require ownership, sharing and a project start date without private projections",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg018(prisma)
    const noStart = await prisma.project.create({
      data: {
        clientId: f.a.user.id,
        name: "No start",
        milestones: {
          create: {
            title: "Hidden without start",
            sentToClientAt: new Date("2030-02-03"),
          },
        },
      },
    })
    const before = await calendarSnapshot(prisma)
    for (const [actor, records, excluded] of [
      [f.a, f.own, f.foreign],
      [f.b, f.foreign, f.own],
    ] as const) {
      const response = await read(
        origin,
        actor.token,
        "?clientId=" + excluded.booking.clientId,
      )
      assert.equal(response.status, 200)
      const events = (await response.json()) as WireEvent[]
      assert.deepEqual(
        events.map((e) => e.id).sort(),
        [
          `consultation-${records.consultation.id}`,
          `meeting-${records.meeting.id}`,
          ...records.project.milestones
            .filter((m) => m.sentToClientAt)
            .map((m) => `milestone-${m.id}`),
        ].sort(),
      )
      const milestone = events.find((e) => e.type === "milestone")!
      assert.equal(milestone.href, "/projects/" + records.project.id)
      assert.equal(milestone.completed, false)
      assert.equal(milestone.startsAt, records.project.startDate!.toISOString())
      assert.equal(
        events.some(
          (e) =>
            e.type === "task" ||
            e.type === "leave" ||
            e.context === noStart.name,
        ),
        false,
      )
      for (const event of events)
        for (const key of [
          "notes",
          "workPlan",
          "reason",
          "passwordHash",
          "workflow",
          "payment",
        ])
          assert.equal(key in event, false, key)
    }
    assert.deepEqual(await calendarSnapshot(prisma), before)
  },
)

test(
  "[PG-018-F001-A020-T003] internal aggregation excludes undated, unshared and cancelled project work and projects dates and assignees",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg018(prisma)
    await prisma.project.update({
      where: { id: f.foreign.project.id },
      data: { status: "CANCELLED" },
    })
    const before = await calendarSnapshot(prisma)
    const response = await read(
      origin,
      f.admin.token,
      "?scope=mine&month=2030-02",
    )
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      events: WireEvent[]
      organization: boolean
    }
    assert.equal(body.organization, true)
    const work = body.events.filter(
      (e) => e.type === "task" || e.type === "milestone",
    )
    assert.deepEqual(work.map((e) => e.title).sort(), [
      "Deadline A",
      "Shared milestone A",
    ])
    const task = work.find((e) => e.type === "task")!
    assert.equal(task.startsAt, "2030-02-02T16:00:00.000Z")
    assert.equal(task.completed, true)
    assert.equal(task.deadline, true)
    assert.deepEqual(task.staffMembers, [
      { id: f.staff.user.id, name: f.employee.fullName },
    ])
    assert.deepEqual(task.project, {
      id: f.own.project.id,
      name: f.own.project.name,
    })
    assert.deepEqual(task.department, {
      id: f.department.id,
      name: f.department.name,
    })
    assert.equal(
      work.every((e) => e.href === null && e.location === null),
      true,
    )
    assert.deepEqual(await calendarSnapshot(prisma), before)
  },
)

test(
  "[PG-018-F001-A021-T001] approved positive leave days use the 42-day grid and role privacy boundaries",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg018(prisma)
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Calendar policy",
        timeZone: "America/New_York",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
    for (const employee of [f.employee, f.otherEmployee]) {
      const assignment = await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: employee.id,
          policyId: policy.id,
          effectiveFrom: new Date("2029-01-01"),
        },
      })
      for (const status of [
        "APPROVED",
        "SUBMITTED",
        "VERIFIED",
        "REJECTED",
        "CANCELLED",
        "REVERSED",
      ] as const) {
        await prisma.leaveRequest.create({
          data: {
            requestKey: randomUUID(),
            employeeId: employee.id,
            requestedById: employee.userId!,
            type: "SICK",
            reason: "PRIVATE medical reason",
            status,
            startDate: new Date("2030-01-27"),
            endDate: new Date("2030-03-11"),
            days: {
              create: [
                "2030-01-27",
                "2030-01-28",
                "2030-02-03",
                "2030-02-04",
                "2030-03-10",
                "2030-03-11",
              ].map((date) => ({
                employeeId: employee.id,
                assignmentId: assignment.id,
                workDate: new Date(date),
                timeZone: policy.timeZone,
                policyName: policy.name,
                baseRequiredMinutes: 480,
                leaveMinutes: date === "2030-02-04" ? 0 : 480,
              })),
            },
          },
        })
      }
    }
    const before = await calendarSnapshot(prisma)
    for (const [actor, scope, people] of [
      [f.staff, "mine", [f.staff.user.id]],
      [f.head, "team", [f.staff.user.id]],
      [f.admin, "mine", [f.staff.user.id, f.other.user.id]],
    ] as const) {
      const response = await read(
        origin,
        actor.token,
        `?scope=${scope}&month=2030-02`,
      )
      assert.equal(response.status, 200)
      const { events } = (await response.json()) as { events: WireEvent[] }
      const leaves = events.filter((e) => e.type === "leave")
      assert.equal(leaves.length, people.length * 3)
      for (const person of people)
        assert.deepEqual(
          leaves
            .filter((e) => e.staffMembers.some((p) => p.id === person))
            .map((e) => e.startDate),
          ["2030-01-28", "2030-02-03", "2030-03-10"],
        )
      for (const leave of leaves) {
        assert.equal(leave.allDay, true)
        assert.equal(leave.timeZone, "America/New_York")
        assert.equal(leave.title, "Approved leave")
        assert.equal(leave.href, "/attendance/requests/leave")
        assert.equal(
          Date.parse(leave.endsAt!) - Date.parse(leave.startsAt),
          86400000,
        )
        assert.equal(leave.endDateExclusive, leave.endsAt!.slice(0, 10))
        for (const key of ["reason", "leaveType", "verifiedById", "decisions"])
          assert.equal(key in leave, false)
        assert.equal(JSON.stringify(leave).includes("PRIVATE"), false)
      }
    }
    assert.deepEqual(await calendarSnapshot(prisma), before)
  },
)

test(
  "[PG-018-F001-A022-T001] internal query grammar is strict while USER spoofed scope and month cannot change ownership",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg018(prisma)
    const before = await calendarSnapshot(prisma)
    for (const query of [
      "?scope=other",
      "?scope=",
      "?scope=mine&scope=team",
      "?month=0000-01",
      "?month=2030-00",
      "?month=2030-13",
      "?month=2030-2",
      "?month=2030-02-01",
      "?month=",
      "?month=2030-02&month=2030-03",
    ]) {
      const result = await read(origin, f.admin.token, query)
      assert.equal(result.status, 400, query)
      assert.match(
        ((await result.json()) as { error: string }).error,
        /valid calendar (scope|month)/,
      )
    }
    for (const query of [
      "",
      "?scope=mine&month=2030-02",
      "?scope=team&month=2032-02",
    ])
      assert.equal(
        (await read(origin, f.admin.token, query)).status,
        200,
        query,
      )
    const baseline = await (await read(origin, f.a.token)).json()
    for (const query of [
      "?scope=org&month=0000-00",
      "?scope=team&scope=mine&month=x&month=y&clientId=" + f.b.user.id,
    ]) {
      const response = await read(origin, f.a.token, query)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), baseline)
    }
    assert.deepEqual(await calendarSnapshot(prisma), before)
  },
)
