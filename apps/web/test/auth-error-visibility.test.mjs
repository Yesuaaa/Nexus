import assert from "node:assert/strict"
import { test } from "node:test"
import * as authSchema from "../src/features/auth/schema.ts"

test("only the most recently blurred invalid field keeps an inline error", () => {
  assert.equal(typeof authSchema.visibleFieldAfterInteraction, "function")

  assert.equal(
    authSchema.visibleFieldAfterInteraction("password", {
      type: "focus",
      field: "confirmPassword",
    }),
    null,
  )
  assert.equal(
    authSchema.visibleFieldAfterInteraction(null, {
      type: "blur",
      field: "confirmPassword",
      invalid: true,
    }),
    "confirmPassword",
  )
  assert.equal(
    authSchema.visibleFieldAfterInteraction("confirmPassword", {
      type: "blur",
      field: "confirmPassword",
      invalid: false,
    }),
    null,
  )
})
