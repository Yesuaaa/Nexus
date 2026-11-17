import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canSignInToPortal,
  loginPathForRole,
} from "../src/features/auth/model/auth-portal.ts"

test("client and workforce portals admit only their intended roles", () => {
  assert.equal(canSignInToPortal("USER", "client"), true)
  assert.equal(canSignInToPortal("USER", "workforce"), false)

  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"]) {
    assert.equal(canSignInToPortal(role, "workforce"), true)
    assert.equal(canSignInToPortal(role, "client"), false)
  }
})

test("each role returns to its own login portal", () => {
  assert.equal(loginPathForRole("USER"), "/login")
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"])
    assert.equal(loginPathForRole(role), "/internal/login")
})
