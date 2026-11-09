import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarConflicts,
  calendarEventStatus,
} from "../src/features/calendar/model/calendar.ts"

const deadline = {
  completed: false,
  deadline: true,
  startsAt: "2030-02-02T16:00:00.000Z",
}

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
