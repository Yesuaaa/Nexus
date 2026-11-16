import assert from "node:assert/strict"
import test from "node:test"
import { serviceRequestStatusValues } from "../src/features/service-operations/model/service-request-contracts.ts"
import { serviceRequestStatuses } from "../src/features/services/model/service-request-status.ts"
import { bookingStatuses } from "../src/features/bookings/model/booking-status.ts"

test("request and booking views share the five lifecycle labels and meanings", () => {
  const expected = [
    ["Pending", "Waiting for Department Head to Accept Request"],
    ["Under Review", "Department Head has accepted request"],
    [
      "Activated",
      "Service Request has been assigned to a staff/team and has a workspace",
    ],
    ["Cancelled", "Service Request has been cancelled"],
    ["Concluded", "Service Request has been accomplished"],
  ]
  assert.deepEqual(
    serviceRequestStatusValues.map((value) => [
      serviceRequestStatuses[value].label,
      serviceRequestStatuses[value].description,
    ]),
    expected,
  )
  for (const value of serviceRequestStatusValues)
    assert.equal(
      bookingStatuses[value].label,
      serviceRequestStatuses[value].label,
    )
})
