import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessRoute,
  findRoutePolicy,
} from "../src/features/workspaces/model/route-policy.ts"

test("[PG-016-F001-A001-T001] billing route admits USER independently of account bootstrap", () => {
  assert.equal(findRoutePolicy("/billing-logs").moduleId, null)
  for (const isActive of [true, false])
    for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"]) {
      const account = { id: "synthetic", role, isActive, permissions: [] }
      assert.equal(
        canAccessRoute(account, "/billing-logs"),
        role === "USER",
        role + " active=" + isActive,
      )
    }
})
