import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { permissionsFor } from "../../../src/features/auth/auth.permissions.js"

test("employee management belongs to Admin and Superadmin", () => {
  for (const role of Object.values(Role)) {
    const permissions: readonly string[] = permissionsFor(role)
    const manager = role === Role.ADMIN || role === Role.SUPERADMIN
    assert.equal(permissions.includes("employees:read"), manager)
    assert.equal(permissions.includes("employees:manage"), manager)
  }
})
