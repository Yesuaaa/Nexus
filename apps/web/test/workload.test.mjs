import assert from "node:assert/strict"
import { test } from "node:test"
import { getWorkloadMetrics } from "../src/features/workload/model/workload.ts"

const staff = {
  id: "employee",
  fullName: "Employee",
  position: null,
  status: "ACTIVE",
  profileSpecialties: [],
  team: null,
  capacity: { scheduledHours: 40, timeOffHours: 8 },
  assignments: [{ weeklyHours: 10 }],
}

test("policy duration targets and known meetings do not change manual weekly capacity", () => {
  const baseline = getWorkloadMetrics(staff)
  const planning = {
    requirement: { totalHours: 56 },
    confirmedAvailableSlots: null,
    commitments: [
      { startsAt: "2026-11-13T20:00:00Z", endsAt: "2026-11-14T04:00:00Z" },
    ],
    overlaps: [],
  }
  assert.equal(baseline.capacity, 32)
  assert.equal(baseline.assigned, 10)
  assert.deepEqual(getWorkloadMetrics({ ...staff, planning }), baseline)
  const missing = getWorkloadMetrics({ ...staff, capacity: null, planning })
  assert.equal(missing.capacity, null)
  assert.equal(missing.availability, "Needs setup")
})

test("unknown allocation hours and current HR status are not free capacity", () => {
  const unknown = getWorkloadMetrics({
    ...staff,
    assignments: [{ weeklyHours: null }],
  })
  assert.equal(unknown.unknown, true)
  assert.equal(unknown.availability, "Needs setup")
  assert.equal(
    getWorkloadMetrics({ ...staff, status: "ON_LEAVE" }).availability,
    "On leave",
  )
  assert.equal(
    getWorkloadMetrics({ ...staff, status: "INACTIVE" }).availability,
    "Inactive",
  )
  assert.equal(
    getWorkloadMetrics({ ...staff, assignments: [{ weeklyHours: 36 }] })
      .availability,
    "Overloaded",
  )
})
