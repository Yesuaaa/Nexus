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

test("registration validates each field boundary and keeps Unicode names valid", () => {
  const copy = getAuthCopy("en")
  const name = "Jose\u0301 O'Neil-Santos"
  const values = {
    ...validValues,
    fullName: name,
    email: "o'hara+tag@example.com.ph",
    contactNumber: "08123456789",
  }
  assert.deepEqual(validateAuth("register", values, copy), {})
  assert.equal(
    validateAuth("register", { ...values, email: "José@例え.example.ph" }, copy)
      .email,
    undefined,
  )
  const maxEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`
  assert.equal(maxEmail.length, 254)
  const minPassword = "Aa1!bcdefghi"
  assert.equal(minPassword.length, 12)
  const internationalPassword = "Éléphant١٢٣!"
  assert.equal(internationalPassword.length, 12)
  assert.deepEqual(
    validateAuth(
      "register",
      {
        ...values,
        fullName: "J".repeat(100),
        email: maxEmail,
        password: minPassword,
        confirmPassword: minPassword,
      },
      copy,
    ),
    {},
  )
  assert.deepEqual(
    validateAuth(
      "register",
      {
        ...values,
        password: internationalPassword,
        confirmPassword: internationalPassword,
      },
      copy,
    ),
    {},
  )

  for (const fullName of [" ", "J", "J".repeat(101), "Jane123", "<script>"]) {
    assert.ok(
      validateAuth("register", { ...values, fullName }, copy).fullName,
      `full name: ${fullName}`,
    )
  }
  for (const contactNumber of [
    " ",
    "07123456789",
    "0912345678",
    "091234567890",
    "09 123 456 789",
    "09abc3456789",
    "+639123456789",
  ]) {
    assert.ok(
      validateAuth("register", { ...values, contactNumber }, copy)
        .contactNumber,
      `contact number: ${contactNumber}`,
    )
  }
  for (const email of [
    " ",
    "not-an-email",
    "name@example.org",
    "jane..doe@example.com",
    "name@-example.com",
    "name@example..com",
    "---@email.com",
    `${"a".repeat(65)}@example.com`,
    `${"a".repeat(243)}@example.com`,
  ]) {
    assert.ok(validateAuth("register", { ...values, email }, copy).email, email)
  }
  for (const password of [
    " ",
    "short",
    "strongpassword12!",
    "STRONGPASSWORD12!",
    "StrongPassword!!",
    "StrongPassword12",
    "StrongPassword1\u0301",
    "A".repeat(1022) + "a1!",
  ]) {
    assert.ok(
      validateAuth("register", { ...values, password }, copy).password,
      `password length ${password.length}`,
    )
  }
  assert.equal(
    validateAuth("register", { ...values, confirmPassword: " " }, copy)
      .confirmPassword,
    copy.passwordMismatch,
  )
  assert.equal(
    validateAuth("register", { ...values, confirmPassword: "" }, copy)
      .confirmPassword,
    copy.confirmRequired,
  )
  const maxPassword = "A".repeat(1021) + "a1!"
  assert.deepEqual(
    validateAuth(
      "register",
      { ...values, password: maxPassword, confirmPassword: maxPassword },
      copy,
    ),
    {},
  )
  const maxUtf8Password = `Aa1!${"é".repeat(510)}`
  assert.deepEqual(
    validateAuth(
      "register",
      {
        ...values,
        password: maxUtf8Password,
        confirmPassword: maxUtf8Password,
      },
      copy,
    ),
    {},
  )
  const oversizedUtf8Password = `Aa1!${"é".repeat(511)}`
  assert.equal(
    validateAuth(
      "register",
      {
        ...values,
        password: oversizedUtf8Password,
        confirmPassword: oversizedUtf8Password,
      },
      copy,
    ).password,
    copy.passwordLong,
  )
})

test("registration validation safely handles missing and non-string payload values", () => {
  const copy = getAuthCopy("en")
  for (const values of [
    null,
    undefined,
    [],
    {},
    { ...validValues, fullName: null },
    { ...validValues, contactNumber: {} },
    { ...validValues, email: [] },
    { ...validValues, password: 123 },
    { ...validValues, confirmPassword: null },
  ]) {
    assert.doesNotThrow(() => validateAuth("register", values, copy))
    assert.ok(Object.keys(validateAuth("register", values, copy)).length > 0)
  }
})
