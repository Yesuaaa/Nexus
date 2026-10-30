import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessBookedServices,
  canAccessRequestInbox,
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

test("booked services remain private to client accounts", () => {
  assert.equal(canAccessBookedServices(account("USER")), true)
  for (const role of ["ADMIN", "STAFF", "SUPERADMIN"]) {
    assert.equal(
      canAccessBookedServices(account(role, [Permissions.SERVICES_READ])),
      false,
    )
  }
})

test("request inbox requires a current staff department head assignment", () => {
  const headOf = { id: "department-1", name: "Design" }
  assert.equal(canAccessRequestInbox({ ...account("STAFF"), headOf }), true)
  assert.equal(canAccessRequestInbox(account("STAFF")), false)
  for (const role of ["USER", "ADMIN", "SUPERADMIN"]) {
    assert.equal(canAccessRequestInbox({ ...account(role), headOf }), false)
  }
})
