import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword, validPassword, verifyPassword } from "./password.js"
import { normalizedEmail, validRegistrationProfile } from "./validation.js"

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

test("social-only accounts cannot authenticate with a password", async () => {
  assert.equal(await verifyPassword("anything", null), false)
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
