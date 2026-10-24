import assert from "node:assert/strict"
import { test } from "node:test"
import { getAuthCopy } from "../src/features/auth/copy.ts"
import { validateAuth } from "../src/features/auth/schema.ts"

const validValues = {
  fullName: "Jane Doe",
  contactNumber: "+63 912 345 6789",
  email: "jane@example.com",
  password: "correct horse battery staple",
  confirmPassword: "correct horse battery staple",
}

test("login validates credentials without requiring registration fields", () => {
  const copy = getAuthCopy("en")

  assert.deepEqual(
    validateAuth(
      "login",
      { ...validValues, fullName: "", contactNumber: "" },
      copy,
    ),
    {},
  )
  assert.deepEqual(
    validateAuth("login", { ...validValues, email: " ", password: "" }, copy),
    { email: copy.emailRequired, password: copy.passwordRequired },
  )
})

test("registration reports field-specific errors and accepts valid input", () => {
  const copy = getAuthCopy("en")

  assert.deepEqual(validateAuth("register", validValues, copy), {})
  assert.deepEqual(
    validateAuth(
      "register",
      {
        ...validValues,
        fullName: "J",
        contactNumber: "not a number",
        email: "invalid",
        password: "too short",
        confirmPassword: "different",
      },
      copy,
    ),
    {
      fullName: copy.nameLength,
      contactNumber: copy.contactInvalid,
      email: copy.emailInvalid,
      password: copy.passwordShort,
      confirmPassword: copy.passwordMismatch,
    },
  )
})

test("validation uses the selected language and enforces the byte limit", () => {
  const copy = getAuthCopy("fil")
  const errors = validateAuth(
    "register",
    { ...validValues, email: "", password: "🔒".repeat(257) },
    copy,
  )

  assert.equal(errors.email, copy.emailRequired)
  assert.equal(errors.password, copy.passwordLong)
})
