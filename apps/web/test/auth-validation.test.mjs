import assert from "node:assert/strict"
import { test } from "node:test"
import { getAuthCopy } from "../src/features/auth/content/auth-copy.ts"
import { validateAuth } from "../src/features/auth/model/schema.ts"

const validValues = {
  fullName: "Jane Doe",
  contactNumber: "09123456789",
  email: "jane@example.com",
  password: "Correct horse battery staple1!",
  confirmPassword: "Correct horse battery staple1!",
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

for (const language of ["en", "fil"]) {
  test(`registration matches account creation rules (${language})`, () => {
    const copy = getAuthCopy(language)
    const valid = {
      ...validValues,
      contactNumber: "09123456789",
      password: "StrongPassword1!",
      confirmPassword: "StrongPassword1!",
    }
    assert.deepEqual(validateAuth("register", valid, copy), {})
    for (const [field, value] of [
      ["fullName", "Jane123"],
      ["email", "jane@example.org"],
      ["email", "jane..doe@example.com"],
      ["contactNumber", "+63 912 345 6789"],
      ["contactNumber", "07123456789"],
      ["password", "strongpassword1!"],
      ["password", "StrongPassword!!"],
      ["password", "StrongPassword12"],
    ]) {
      assert.ok(
        validateAuth("register", { ...valid, [field]: value }, copy)[field],
        `${field}: ${value}`,
      )
    }
    assert.equal(
      validateAuth("register", { ...valid, contactNumber: "" }, copy)
        .contactNumber,
      copy.contactRequired,
    )
    assert.deepEqual(
      validateAuth(
        "register",
        {
          ...valid,
          fullName: "María O’Neil-Santos Jr.",
          contactNumber: "08123456789",
          email: "jane.doe@example.com.ph",
        },
        copy,
      ),
      {},
    )
  })
}

test("registration requires a lowercase letter without changing login requirements", () => {
  const password = "STRONGPASSWORD1!"
  for (const language of ["en", "fil"]) {
    const copy = getAuthCopy(language)
    const values = { ...validValues, password, confirmPassword: password }
    assert.ok(validateAuth("register", values, copy).password)
    assert.deepEqual(validateAuth("login", values, copy), {})
    assert.deepEqual(
      validateAuth(
        "register",
        {
          ...values,
          password: `${password}a`,
          confirmPassword: `${password}a`,
        },
        copy,
      ),
      {},
    )
  }
})
