import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "./generated/prisma/client.js"
import { hashPassword, validPassword, verifyPassword } from "./password.js"
import { canAssignRole } from "./role-policy.js"

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

test("role changes follow the account hierarchy", () => {
  for (const target of Object.values(Role)) {
    for (const next of Object.values(Role)) {
      assert.equal(canAssignRole(Role.SUPERADMIN, target, next), true)
      assert.equal(
        canAssignRole(Role.ADMIN, target, next),
        (target === Role.STAFF || target === Role.USER) &&
          (next === Role.STAFF || next === Role.USER),
      )
      assert.equal(canAssignRole(Role.STAFF, target, next), false)
      assert.equal(canAssignRole(Role.USER, target, next), false)
    }
  }
})
