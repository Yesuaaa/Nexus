import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveWorkspaceModuleId } from "../src/features/workspaces/model/workspace-selection.ts"
import { Permissions } from "../src/features/auth/model/permissions.ts"

const admin = {
  id: "admin-1",
  role: "ADMIN",
  permissions: [Permissions.EMPLOYEES_READ, Permissions.SERVICES_READ],
}

test("shared utilities retain any authorized internal module without owning it", () => {
  for (const moduleId of ["service-operations", "people-hr"])
    for (const pathname of ["/messages", "/calendar", "/profile", "/settings"])
      assert.equal(
        resolveWorkspaceModuleId(admin, pathname, moduleId),
        moduleId,
      )
})

test("authorized business deep links override remembered shell context", () => {
  assert.equal(
    resolveWorkspaceModuleId(
      admin,
      "/employees/employee-1",
      "service-operations",
    ),
    "people-hr",
  )
  assert.equal(
    resolveWorkspaceModuleId(admin, "/services", "people-hr"),
    "service-operations",
  )
})

test("the selector and legacy landing route clear module context", () => {
  for (const pathname of ["/module", "/dashboard"])
    assert.equal(resolveWorkspaceModuleId(admin, pathname, "people-hr"), null)
})

test("stale, unknown and forbidden module selections cannot grant access", () => {
  for (const remembered of ["administration", "unknown", null])
    assert.equal(resolveWorkspaceModuleId(admin, "/messages", remembered), null)
  const restricted = { ...admin, permissions: [] }
  assert.equal(
    resolveWorkspaceModuleId(restricted, "/profile", "people-hr"),
    null,
  )
  assert.equal(
    resolveWorkspaceModuleId(restricted, "/employees", "people-hr"),
    null,
  )
  const formerHead = {
    id: "staff-1",
    role: "STAFF",
    permissions: [],
    headOf: null,
  }
  assert.equal(
    resolveWorkspaceModuleId(formerHead, "/messages", "service-operations"),
    null,
  )
})

test("clients never receive internal shell context, even with remembered values", () => {
  const client = { ...admin, role: "USER" }
  for (const pathname of ["/module", "/services", "/projects", "/messages"])
    assert.equal(
      resolveWorkspaceModuleId(client, pathname, "service-operations"),
      null,
    )
})
