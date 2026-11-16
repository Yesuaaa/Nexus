import assert from "node:assert/strict"
import { test } from "node:test"
import { calendarEventStatus } from "../src/features/calendar/model/calendar.ts"

test("calendar deadline status follows exact Philippine leap-day boundaries", () => {
  const leapDayLate = {
    completed: false,
    deadline: true,
    startsAt: "2032-02-29T15:59:59.999Z",
  }
  const marchFirst = {
    ...leapDayLate,
    startsAt: "2032-02-29T16:00:00.000Z",
  }

  assert.equal(calendarEventStatus(leapDayLate, "2032-02-29"), null)
  assert.equal(calendarEventStatus(leapDayLate, "2032-03-01"), "Overdue")
  assert.equal(calendarEventStatus(marchFirst, "2032-03-01"), null)
  assert.equal(calendarEventStatus(marchFirst, "2032-03-02"), "Overdue")
})
