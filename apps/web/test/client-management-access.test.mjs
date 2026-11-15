import assert from "node:assert/strict"
import { test } from "node:test"
import * as access from "../src/features/auth/model/permissions.ts"

test("client directory requires a management role and clients:read", () => {
  assert.equal(typeof access.canAccessClientManagement, "function")
  for (const role of ["ADMIN", "SUPERADMIN", "STAFF", "USER"]) {
    const actor = { role, permissions: ["clients:read"] }
    assert.equal(
      access.canAccessClientManagement(actor),
      role === "ADMIN" || role === "SUPERADMIN",
    )
    assert.equal(
      access.canAccessClientManagement({ role, permissions: [] }),
      false,
    )
  }
})

test("Client creation requires clients:create independently of directory reads", () => {
  assert.equal(access.Permissions.CLIENTS_CREATE, "clients:create")
  for (const role of ["ADMIN", "SUPERADMIN"]) {
    const reader = { role, permissions: ["clients:read"] }
    assert.equal(access.canAccessClientManagement(reader), true)
    assert.equal(access.hasPermission(reader, "clients:create"), false)
    assert.equal(
      access.hasPermission(
        { ...reader, permissions: ["clients:read", "clients:create"] },
        "clients:create",
      ),
      true,
    )
  }
})
