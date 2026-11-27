import assert from "node:assert/strict"
import { test } from "node:test"
import {
  validateDepartmentCreateInput,
  validateDepartmentUpdateInput,
  validateMemberAssignmentInput,
  validateTeamCreateInput,
} from "../../../src/features/departments/departments.schema.js"

test("PG-021-F001-A009-T001 department normalization and field allowlist", () => {
  for (const length of [1, 81]) {
    assert.equal(
      validateDepartmentCreateInput({ name: "x".repeat(length) }).error,
      "Department name must be between 2 and 80 characters",
    )
  }
  for (const length of [2, 80]) {
    const name = "x".repeat(length)
    assert.deepEqual(
      validateDepartmentCreateInput({
        name: ` ${name} `,
        code: " qa ",
        description: " note ",
        departmentId: "ignored",
      }).value,
      { name, code: "QA", description: "note", color: "blue", headId: null },
    )
  }
  assert.equal(
    validateDepartmentCreateInput({ name: "   " }).error,
    "Department name must be between 2 and 80 characters",
  )
  for (const length of [1, 21]) {
    assert.equal(
      validateDepartmentUpdateInput({ code: "a".repeat(length) }).error,
      "Department code must be between 2 and 20 characters",
    )
  }
  for (const length of [2, 20]) {
    assert.equal(
      validateDepartmentCreateInput({ name: "QA", code: "a".repeat(length) })
        .value?.code,
      "A".repeat(length),
    )
  }
  assert.equal(validateDepartmentUpdateInput({}).value?.headId, undefined)
  assert.equal(
    validateDepartmentUpdateInput({ headId: null }).value?.headId,
    null,
  )
  assert.equal(
    validateDepartmentCreateInput({ name: "QA", color: "invalid" }).error,
    "Invalid department color",
  )
})

test("PG-021-F001-A028-T001 team and member identifier limits", () => {
  for (const length of [1, 1000]) {
    const ids = Array.from({ length }, (_, index) => `member-${index}`)
    assert.deepEqual(
      validateTeamCreateInput({ name: "QA", memberIds: ids }).value?.memberIds,
      ids,
    )
    assert.deepEqual(
      validateMemberAssignmentInput({ employeeIds: ids }).value?.employeeIds,
      ids,
    )
  }
  for (const ids of [
    [],
    Array.from({ length: 1001 }, (_, index) => `member-${index}`),
    [123],
    [""],
    ["x".repeat(81)],
    "member",
  ]) {
    assert.equal(
      validateTeamCreateInput({ name: "QA", memberIds: ids }).error,
      "Provide at least one unique team member ID",
    )
    assert.equal(
      validateMemberAssignmentInput({ employeeIds: ids }).error,
      "Provide a list of employee IDs to assign",
    )
  }
  const duplicates = ["member", "member"]
  assert.equal(
    validateTeamCreateInput({ name: "QA", memberIds: duplicates }).error,
    "Provide at least one unique team member ID",
  )
  assert.deepEqual(
    validateMemberAssignmentInput({ employeeIds: duplicates }).value
      ?.employeeIds,
    duplicates,
  )
})
