import assert from "node:assert/strict"
import test from "node:test"
import { bookingStatuses } from "../src/features/bookings/model/booking-status.ts"
import {
  projectDeliverableStatusValues,
  projectStatusValues,
  projectTaskStatusValues,
} from "../src/features/project-management/model/project-contracts.ts"
import { serviceRequestStatusValues } from "../src/features/service-operations/model/service-request-contracts.ts"
import { serviceRequestStatuses } from "../src/features/services/model/service-request-status.ts"
import { taskStatusLabels } from "../src/features/project-workspace/model/task-status.ts"

test("service-operation status displays cover the shared request contract", () => {
  assert.deepEqual(Object.keys(bookingStatuses), serviceRequestStatusValues)
  assert.deepEqual(
    Object.keys(serviceRequestStatuses),
    serviceRequestStatusValues,
  )
})

test("project-management contracts retain the current API enum values", () => {
  assert.deepEqual(projectStatusValues, [
    "PLANNED",
    "IN_PROGRESS",
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
  ])
  assert.deepEqual(projectTaskStatusValues, [
    "NOT_STARTED",
    "IN_PROGRESS",
    "DONE",
  ])
  assert.deepEqual(Object.keys(taskStatusLabels), projectTaskStatusValues)
  assert.deepEqual(projectDeliverableStatusValues, [
    "NOT_SUBMITTED",
    "IN_REVIEW",
    "REJECTED",
    "APPROVED",
    "SENT_TO_CLIENT",
  ])
})
