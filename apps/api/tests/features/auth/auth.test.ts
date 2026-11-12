import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PASSWORD_POLICY_MESSAGE,
  isStrongPassword,
  passwordIssue,
} from "../../shared/password-policy.js"
import { normalizedEmail } from "../../shared/validation.js"
import { hashPassword, validPassword, verifyPassword } from "./auth.password.js"
import { validRegistrationProfile } from "./auth.schema.js"

test("passwords are salted and verified", async () => {
  const first = await hashPassword("a long unique password")
  const second = await hashPassword("a long unique password")
  assert.notEqual(first, second)
  assert.equal(await verifyPassword("a long unique password", first), true)
  assert.equal(await verifyPassword("wrong password", first), false)
  assert.equal(await verifyPassword("anything", "malformed"), false)
  assert.equal(validPassword("too short"), false)
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
})

test("registration requires a valid name and contact number", () => {
  assert.equal(validRegistrationProfile("Jane Doe", "+63 912 345 6789"), true)
  assert.equal(validRegistrationProfile(undefined, "+63 912 345 6789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", undefined), false)
  assert.equal(validRegistrationProfile("J", "+63 912 345 6789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", "not a number"), false)
})
