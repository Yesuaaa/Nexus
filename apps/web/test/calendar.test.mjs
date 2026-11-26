import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarConflicts,
  calendarEventDate,
  calendarEventStatus,
} from "../src/features/calendar/model/calendar.ts"

const deadline = {
  completed: false,
  deadline: true,
  startsAt: "2030-02-02T16:00:00.000Z",
}

test("all-day leave keeps its business date across timezones and DST boundaries", () => {
  for (const date of ["2026-03-08", "2026-11-01"]) {
    assert.equal(
      calendarEventDate({
        allDay: true,
        startDate: date,
        startsAt: `${date}T23:00:00Z`,
      }),
      date,
    )
  }
})

test("calendar deadlines use the Philippine due date and actual completion state", () => {
  assert.equal(calendarEventStatus(deadline, "2030-02-03"), null)
  assert.equal(calendarEventStatus(deadline, "2030-02-04"), "Overdue")
  assert.equal(
    calendarEventStatus({ ...deadline, completed: true }, "2030-02-04"),
    "Completed",
  )
  assert.equal(
    calendarEventStatus({ ...deadline, deadline: false }, "2030-02-04"),
    null,
  )
})

test("calendar conflicts require overlapping times and a shared assignee", () => {
  const appointment = {
    completed: false,
    startsAt: "2030-02-03T01:00:00Z",
    endsAt: "2030-02-03T02:00:00Z",
    staffMembers: [{ id: "staff", name: "Staff" }],
  }
  const events = [
    { ...appointment, id: "first" },
    { ...appointment, id: "overlap", startsAt: "2030-02-03T01:30:00Z" },
    {
      ...appointment,
      id: "other-staff",
      staffMembers: [{ id: "other", name: "Other" }],
    },
    { ...appointment, id: "completed", completed: true },
    {
      ...appointment,
      id: "next",
      startsAt: "2030-02-03T02:00:00Z",
      endsAt: "2030-02-03T03:00:00Z",
    },
    { ...appointment, id: "deadline", endsAt: null },
  ]
  assert.deepEqual(
    [...calendarConflicts(events, Date.parse("2030-02-01"))].sort(),
    ["first", "overlap"],
  )
  assert.equal(calendarConflicts(events, Date.parse("2030-02-04")).size, 0)
})

test("[PG-018-F001-A018-T002] leave conflicts honor business zones, assignees, tasks and half-open midnight", () => {
  const person = [{ id: "staff", name: "Staff" }]
  const leave = {
    id: "leave",
    type: "leave",
    allDay: true,
    startDate: "2032-03-14",
    timeZone: "America/New_York",
    startsAt: "2032-03-14T00:00:00Z",
    endsAt: "2032-03-15T00:00:00Z",
    staffMembers: person,
  }
  const timed = {
    id: "timed",
    type: "meeting",
    startsAt: "2032-03-14T05:00:00Z",
    endsAt: "2032-03-14T06:00:00Z",
    staffMembers: person,
  }
  const task = {
    id: "task",
    type: "task",
    deadline: true,
    startsAt: "2032-03-13T16:00:00Z",
    endsAt: null,
    staffMembers: person,
  }
  const midnight = {
    ...timed,
    id: "midnight",
    startsAt: "2032-03-14T03:00:00Z",
    endsAt: "2032-03-14T04:00:00Z",
  }
  assert.deepEqual(
    [
      ...calendarConflicts([leave, timed, task], Date.parse("2032-03-01")),
    ].sort(),
    ["leave", "task", "timed"],
  )
  for (const control of [
    midnight,
    { ...timed, completed: true },
    { ...task, completed: true },
    { ...timed, staffMembers: [{ id: "other", name: "Other" }] },
  ])
    assert.equal(
      calendarConflicts([leave, control], Date.parse("2032-03-01")).size,
      0,
    )
  assert.equal(
    calendarConflicts(
      [{ ...leave, timeZone: "Asia/Manila" }, midnight],
      Date.parse("2032-03-01"),
    ).size,
    2,
  )
})
