import assert from "node:assert/strict"
import { test } from "node:test"
import * as access from "../src/features/auth/model/permissions.ts"

test("client directory requires both a privileged role and clients:read", () => {
  assert.equal(typeof access.canAccessClientManagement, "function")
  for (const role of ["ADMIN", "SUPERADMIN", "STAFF", "USER"]) {
    const actor = { role, permissions: ["clients:read"] }
    assert.equal(
      access.canAccessClientManagement(actor),
      ["ADMIN", "SUPERADMIN"].includes(role),
    )
    assert.equal(
      access.canAccessClientManagement({ role, permissions: [] }),
      false,
    )
  }
})
