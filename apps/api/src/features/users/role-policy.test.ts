import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../generated/prisma/client.js"
import { canAssignRole } from "./role-policy.js"

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
