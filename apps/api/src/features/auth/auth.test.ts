import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword, validPassword, verifyPassword } from "./password.js"
import { normalizedEmail } from "./validation.js"

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

test("email normalization accepts the same input for signup and seed", () => {
  assert.equal(normalizedEmail("  User@Example.com  "), "user@example.com")
  assert.equal(normalizedEmail("invalid"), undefined)
})
