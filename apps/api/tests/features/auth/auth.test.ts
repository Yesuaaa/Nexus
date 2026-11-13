import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PASSWORD_POLICY_MESSAGE,
  isStrongPassword,
  passwordIssue,
} from "../../../src/shared/password-policy.js"
import { normalizedEmail } from "../../../src/shared/validation.js"
import {
  authRateLimitLimit,
  clearAuthRateLimitsForTests,
  loginAllowed,
  loginFailureLimit,
  recordFailure,
} from "../../../src/features/auth/auth.limiter.js"
import {
  hashPassword,
  validPassword,
  verifyPassword,
} from "../../../src/features/auth/auth.password.js"
import {
  validRegistrationEmail,
  validRegistrationProfile,
  validSelfRegistrationProfile,
} from "../../../src/features/auth/auth.schema.js"

test("passwords are salted and verified", async () => {
  const first = await hashPassword("a long unique password")
  const second = await hashPassword("a long unique password")
  assert.notEqual(first, second)
  assert.equal(await verifyPassword("a long unique password", first), true)
  assert.equal(await verifyPassword("wrong password", first), false)
  assert.equal(await verifyPassword("anything", "malformed"), false)
  assert.equal(validPassword("too short"), false)
  assert.equal(validPassword("ValidPassword1!"), true)
  assert.equal(validPassword("twelve chars"), true)
})

test("new passwords need length, every character class, and the byte cap", () => {
  assert.equal(passwordIssue("Strong-pass-123"), null)
  assert.equal(isStrongPassword("Strong-pass-123"), true)
  for (const weak of [
    undefined,
    12345678901234,
    "Short-1a",
    "lowercase-only-123",
    "UPPERCASE-ONLY-123",
    "No-Digits-Here!",
    "NoSpecial12345",
    `Valid123!${"界".repeat(342)}`,
  ])
    assert.equal(passwordIssue(weak), PASSWORD_POLICY_MESSAGE, String(weak))
})

test("email normalization accepts the same input for signup and seed", () => {
  assert.equal(normalizedEmail("  User@Example.com  "), "user@example.com")
  assert.equal(normalizedEmail("invalid"), undefined)
  assert.equal(validRegistrationEmail("user@example.com"), true)
  assert.equal(validRegistrationEmail("user@example.net"), false)
})

test("registration requires a valid name and contact number", () => {
  assert.equal(
    validRegistrationProfile("Jane Dela Cruz", "+63 912 345 6789"),
    true,
  )
  assert.equal(
    validSelfRegistrationProfile("Jane Dela Cruz", "09123456789"),
    true,
  )
  assert.equal(
    validSelfRegistrationProfile("Maria Dela Cruz", "08123456789"),
    true,
  )
  assert.equal(validSelfRegistrationProfile(undefined, "09123456789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", undefined), false)
  assert.equal(validSelfRegistrationProfile("J", "09123456789"), false)
  assert.equal(validSelfRegistrationProfile("Jane 123", "09123456789"), false)
  assert.equal(validSelfRegistrationProfile("Jane Doe", "07123456789"), false)
  assert.equal(validSelfRegistrationProfile("Jane Doe", "not a number"), false)
})

test("development authentication limits are higher without changing production", () => {
  const originalEnvironment = process.env.NODE_ENV
  const attemptKey = "auth-limiter-test"
  try {
    process.env.NODE_ENV = "production"
    clearAuthRateLimitsForTests()
    assert.equal(loginFailureLimit(), 10)
    assert.equal(authRateLimitLimit({ production: 10, development: 50 }), 10)
    for (let index = 0; index < 10; index++) recordFailure(attemptKey)
    assert.equal(loginAllowed(attemptKey), false)

    process.env.NODE_ENV = "development"
    clearAuthRateLimitsForTests()
    assert.equal(loginFailureLimit(), 50)
    assert.equal(authRateLimitLimit({ production: 10, development: 50 }), 50)
    for (let index = 0; index < 49; index++) recordFailure(attemptKey)
    assert.equal(loginAllowed(attemptKey), true)
    recordFailure(attemptKey)
    assert.equal(loginAllowed(attemptKey), false)
  } finally {
    clearAuthRateLimitsForTests()
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
  }
})
