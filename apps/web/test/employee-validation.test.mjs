import assert from "node:assert/strict"
import { test } from "node:test"
import {
  validateEmployeeDraft,
  visibleEmployeeError,
} from "../src/features/employees/model/validation.ts"

const validDraft = {
  employeeId: "EXP-1042",
  fullName: "María O’Neil-Santos Jr.",
  email: "maria@example.com.ph",
  contactNumber: "09123456789",
  position: "Product Designer",
  employmentType: "FULL_TIME",
  startDate: "2026-10-26",
  departmentId: "department-1",
  teamId: "team-1",
  password: "ValidPassword1!",
  passwordConfirmation: "ValidPassword1!",
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
    {
      email: "Email is required.",
      contactNumber: "Contact number is required.",
      position: "Position is required.",
      startDate: "Start date is required.",
      departmentId: "Select a department.",
      teamId: "Select a team or No team.",
    },
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

test("employee account passwords follow account creation rules", () => {
  assert.deepEqual(
    validateEmployeeDraft({
      ...validDraft,
      password: "short",
      passwordConfirmation: "different",
    }),
    {
      password: "Use at least 12 characters.",
      passwordConfirmation: "Passwords do not match.",
    },
  )
  assert.deepEqual(
    validateEmployeeDraft(
      { ...validDraft, password: "", passwordConfirmation: "" },
      false,
    ),
    {},
  )
})

test("employee errors become visible after input, blur, or submit", () => {
  const errors = validateEmployeeDraft({
    ...validDraft,
    employeeId: "",
    email: "invalid",
  })
  assert.equal(visibleEmployeeError("employeeId", null, errors), undefined)
  assert.equal(visibleEmployeeError("email", "email", errors), errors.email)
  assert.equal(
    visibleEmployeeError("employeeId", "employeeId", errors),
    errors.employeeId,
  )
  assert.equal(
    visibleEmployeeError("employeeId", "employeeId", errors),
    errors.employeeId,
  )
})
