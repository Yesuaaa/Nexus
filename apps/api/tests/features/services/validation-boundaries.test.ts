import assert from "node:assert/strict"
import { test } from "node:test"
import { validateServiceInput } from "../../../src/features/services/services.schema.js"

test("service client requirements accept 200 characters and reject 201", () => {
  const base = {
    name: "Boundary Service",
    description: "A valid service description",
    departmentIds: ["department-1"],
    isActive: true,
  }
  assert.equal(
    validateServiceInput({
      ...base,
      clientRequirements: ["R".repeat(200)],
    }).error,
    undefined,
  )
  assert.equal(
    validateServiceInput({
      ...base,
      clientRequirements: ["R".repeat(201)],
    }).error,
    "Client requirements must contain up to 20 items of 200 characters each",
  )
})
