import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessAccountManagement,
  canChangeAccountPassword,
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

test("account management is limited to the Superadmin role", () => {
  assert.equal(
    canAccessAccountManagement(
      account("SUPERADMIN", [Permissions.ACCOUNTS_READ]),
    ),
    true,
  )

  for (const role of ["USER", "STAFF", "ADMIN"]) {
    assert.equal(
      canAccessAccountManagement(account(role, [Permissions.ACCOUNTS_READ])),
      false,
    )
  }
})

test("a Superadmin still requires the account read permission", () => {
  assert.equal(canAccessAccountManagement(account("SUPERADMIN")), false)
})

test("changing listed account passwords requires Superadmin permission and another non-deleted account", () => {
  const actor = account("SUPERADMIN", [Permissions.ACCOUNTS_RESET_PASSWORD])
  const target = account("USER")
  assert.equal(canChangeAccountPassword(actor, target), true)
  assert.equal(
    canChangeAccountPassword(actor, { ...target, isActive: false }),
    true,
  )
  assert.equal(
    canChangeAccountPassword(actor, { ...target, role: "SUPERADMIN" }),
    true,
  )
  assert.equal(canChangeAccountPassword(actor, actor), false)
  assert.equal(
    canChangeAccountPassword(actor, {
      ...target,
      accountDeletedAt: "2026-10-30T00:00:00.000Z",
    }),
    false,
  )
  assert.equal(canChangeAccountPassword(account("SUPERADMIN"), target), false)
  for (const role of ["ADMIN", "STAFF", "USER"]) {
    assert.equal(
      canChangeAccountPassword(
        account(role, [Permissions.ACCOUNTS_RESET_PASSWORD]),
        target,
      ),
      false,
    )
  }
})
