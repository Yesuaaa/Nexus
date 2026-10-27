import assert from "node:assert/strict"
import { test } from "node:test"
import { validateStrongPassword } from "../src/features/accounts/model/password-validation.ts"

test("account password validation requires the strong password policy and confirmation", () => {
  assert.deepEqual(validateStrongPassword({ password: "", confirmation: "" }), {
    password: "Password is required.",
    confirmation: "Please confirm your password.",
  })
  assert.deepEqual(
    validateStrongPassword({
      password: "alllowercase123!",
      confirmation: "alllowercase123!",
    }),
    { password: "Include at least one capital letter." },
  )
  assert.deepEqual(
    validateStrongPassword({
      password: "StrongPassword123!",
      confirmation: "different",
    }),
    { confirmation: "Passwords do not match." },
  )
  assert.deepEqual(
    validateStrongPassword({
      password: "StrongPassword123!",
      confirmation: "StrongPassword123!",
    }),
    {},
  )
})
