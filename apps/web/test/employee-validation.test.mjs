import assert from "node:assert/strict"
import { test } from "node:test"
import {
  validateEmployeeDraft,
  visibleEmployeeError,
} from "../src/features/employees/model/validation.ts"

const validDraft = {
  employeeId: "EMP-1042",
  fullName: "María O’Neil-Santos Jr.",
  email: "maria@example.com.ph",
  contactNumber: "09123456789",
  position: "Product Designer",
  employmentType: "FULL_TIME",
  startDate: "2026-10-26",
  departmentId: "department-1",
  teamId: "team-1",
}

test("employee validation accepts the same identity fields as account creation", () => {
  assert.deepEqual(validateEmployeeDraft(validDraft), {})
  assert.deepEqual(
    validateEmployeeDraft({
      ...validDraft,
      email: "",
      contactNumber: "",
      position: "",
      startDate: "",
      departmentId: "",
      teamId: "",
    }),
    {},
  )
})

test("employee validation returns field-specific identity and employment errors", () => {
  const errors = validateEmployeeDraft({
    ...validDraft,
    employeeId: "bad id",
    fullName: "Jane123",
    email: "jane@example.org",
    contactNumber: "07123456789",
    position: "x".repeat(101),
    startDate: "2026-02-30",
  })

  assert.deepEqual(Object.keys(errors).sort(), [
    "contactNumber",
    "email",
    "employeeId",
    "fullName",
    "position",
    "startDate",
  ])
})

test("employee errors become visible after input, blur, or submit", () => {
  const errors = validateEmployeeDraft({
    ...validDraft,
    employeeId: "",
    email: "invalid",
  })
  assert.equal(
    visibleEmployeeError("employeeId", "", errors, {}, false),
    undefined,
  )
  assert.equal(
    visibleEmployeeError("email", "invalid", errors, {}, false),
    errors.email,
  )
  assert.equal(
    visibleEmployeeError("employeeId", "", errors, { employeeId: true }, false),
    errors.employeeId,
  )
  assert.equal(
    visibleEmployeeError("employeeId", "", errors, {}, true),
    errors.employeeId,
  )
})
