import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../generated/prisma/client.js"
import { permissionsFor } from "./permissions.js"

test("employee management belongs only to the Admin role", () => {
  for (const role of Object.values(Role)) {
    const permissions: readonly string[] = permissionsFor(role)
    assert.equal(permissions.includes("employees:read"), role === Role.ADMIN)
    assert.equal(permissions.includes("employees:manage"), role === Role.ADMIN)
  }
})
