import assert from "node:assert/strict"
import { test } from "node:test"
import { validateEmployeeInput } from "./employees.schema.js"

test("employee input requires every form field and normalizes submitted values", () => {
  const result = validateEmployeeInput(
    {
      employeeId: " EMP-000042 ",
      fullName: "  Ada Lovelace  ",
      email: " ADA@EXAMPLE.COM ",
      contactNumber: " 09123456789 ",
      position: "  Engineer  ",
      employmentType: "FULL_TIME",
      startDate: "2026-01-15T00:00:00.000Z",
      departmentId: " department-1 ",
      teamId: null,
      status: "ACTIVE",
    },
    false,
  )

  assert.deepEqual(result, {
    value: {
      employeeId: "EMP-000042",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      contactNumber: "09123456789",
      position: "Engineer",
      employmentType: "FULL_TIME",
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      departmentId: "department-1",
      teamId: null,
      status: "ACTIVE",
    },
  })
})

test("employee updates preserve omitted fields and allow an explicit No team choice", () => {
  assert.deepEqual(validateEmployeeInput({ teamId: null }, true), {
    value: { teamId: null },
  })
  assert.deepEqual(validateEmployeeInput({ email: null }, true), {
    error: "Email is required",
  })
})

test("employee input rejects an invalid employment type and malformed email", () => {
  assert.deepEqual(
    validateEmployeeInput(
      { employeeId: "EMP-1", fullName: "A Person", employmentType: "TEMP" },
      false,
    ),
    { error: "Invalid employment type" },
  )
  assert.deepEqual(validateEmployeeInput({ email: "bad-email" }, true), {
    error: "Provide a valid email address",
  })
})

test("employee identity fields match registration and account creation rules", () => {
  const accepted = validateEmployeeInput(
    {
      employeeId: "EMP-1",
      fullName: "María O’Neil-Santos Jr.",
      email: "maria@example.com.ph",
      contactNumber: "08123456789",
      position: "Designer",
      employmentType: "FULL_TIME",
      startDate: "2026-01-15T00:00:00.000Z",
      departmentId: "department-1",
      teamId: null,
    },
    false,
  )
  assert.equal("value" in accepted, true)

  for (const input of [
    { fullName: "Jane123" },
    { email: "jane@example.org" },
    { email: "jane..doe@example.com" },
    { contactNumber: "+63 912 345 6789" },
    { contactNumber: "07123456789" },
  ]) {
    assert.equal(
      "error" in validateEmployeeInput(input, true),
      true,
      `Expected ${JSON.stringify(input)} to be rejected`,
    )
  }
})

test("employee IDs accept the 40-character boundary and only supported characters", () => {
  const accepted = validateEmployeeInput(
    {
      employeeId: `A${"b".repeat(39)}`,
      fullName: "Valid Person",
      email: "valid@example.com",
      contactNumber: "09123456789",
      position: "Designer",
      employmentType: "FULL_TIME",
      startDate: "2026-01-15T00:00:00.000Z",
      departmentId: "department-1",
      teamId: null,
    },
    false,
  )
  assert.equal("value" in accepted, true)

  for (const employeeId of [
    "A",
    "A".repeat(41),
    "bad id",
    "bad.id",
    "bad/id",
  ]) {
    assert.equal(
      "error" in
        validateEmployeeInput({ employeeId, fullName: "Valid Person" }, false),
      true,
      `Expected ${employeeId} to be rejected`,
    )
  }
})
