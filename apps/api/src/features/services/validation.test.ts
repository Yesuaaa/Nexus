import assert from "node:assert/strict"
import { test } from "node:test"
import { validateServiceInput } from "./services.schema.js"

test("service input trims and accepts all required fields", () => {
  assert.deepEqual(
    validateServiceInput({
      name: "  Website Development  ",
      description: "  Custom websites for clients.  ",
      departmentIds: [" dept-1 ", "dept-2", "dept-1"],
      isActive: true,
    }),
    {
      value: {
        name: "Website Development",
        description: "Custom websites for clients.",
        departmentIds: ["dept-1", "dept-2"],
        isActive: true,
      },
    },
  )
})

test("service input rejects missing and invalid required fields", () => {
  assert.equal(
    validateServiceInput(null).error,
    "Service information is required",
  )
  assert.match(
    validateServiceInput({
      name: "",
      description: "Description",
      departmentIds: ["dept-1"],
      isActive: true,
    }).error ?? "",
    /Service name/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "",
      departmentIds: ["dept-1"],
      isActive: true,
    }).error ?? "",
    /Description/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: [],
      isActive: true,
    }).error ?? "",
    /department/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: ["dept-1", 42],
      isActive: true,
    }).error ?? "",
    /department/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: ["dept-1"],
      isActive: "yes",
    }).error ?? "",
    /status/,
  )
})
