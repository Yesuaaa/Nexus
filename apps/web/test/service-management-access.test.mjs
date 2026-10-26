import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessServiceManagement,
  Permissions,
} from "../src/features/auth/model/permissions.ts"

function account(role, permissions = []) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: role,
    contactNumber: null,
    role,
    isActive: true,
    permissions,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

test("service management is limited to the admin role", () => {
  assert.equal(
    canAccessServiceManagement(account("ADMIN", [Permissions.SERVICES_READ])),
    true,
  )

  for (const role of ["USER", "STAFF", "SUPERADMIN"]) {
    assert.equal(
      canAccessServiceManagement(account(role, [Permissions.SERVICES_READ])),
      false,
    )
  }
})

test("an admin role still requires the service read permission", () => {
  assert.equal(canAccessServiceManagement(account("ADMIN")), false)
})
