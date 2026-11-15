import assert from "node:assert/strict"
import { readdir } from "node:fs/promises"
import { test } from "node:test"
import { Permissions } from "../src/features/auth/model/permissions.ts"
import { getWorkspaceModules } from "../src/features/dashboard/model/workspace-modules.ts"
import {
  moduleRegistry,
  getAdministrativeModuleEntries,
} from "../src/features/workspaces/model/module-registry.ts"
import {
  administrativeModulePolicies,
  canAccessRoute,
  findRoutePolicy,
  getActiveWorkspaceModuleId,
  getNavigationPolicies,
} from "../src/features/workspaces/model/route-policy.ts"
import { resolveWorkspaceModuleId } from "../src/features/workspaces/model/workspace-selection.ts"

const superadmin = {
  id: "superadmin",
  role: "SUPERADMIN",
  isActive: true,
  permissions: Object.values(Permissions),
  headOf: null,
  departmentId: null,
}

test("an unassigned Superadmin enters every implemented registered module", () => {
  const modules = getWorkspaceModules(superadmin).filter(
    (module) => !module.placeholder,
  )
  assert.deepEqual(
    modules.map((module) => module.id),
    Object.keys(moduleRegistry).filter((id) => moduleRegistry[id].implemented),
  )
  for (const module of modules) {
    assert.equal(canAccessRoute(superadmin, module.href), true, module.href)
    assert.equal(getActiveWorkspaceModuleId(superadmin, module.href), module.id)
    assert.equal(canAccessRoute(superadmin, `/module/${module.id}`), true)
  }
  assert.equal(
    modules.find((module) => module.id === "project-management").href,
    "/project-management/overview",
  )
  assert.equal(
    modules.find((module) => module.id === "attendance-monitoring").href,
    "/attendance/dashboard",
  )
})

test("registration alone adds a future implemented administrative entry and route", () => {
  const registry = {
    ...moduleRegistry,
    "future-module": {
      ...moduleRegistry["project-management"],
      title: "Future Module",
    },
    unfinished: { ...moduleRegistry["billing-finance"] },
  }
  const entry = getAdministrativeModuleEntries(superadmin, registry).find(
    (module) => module.id === "future-module",
  )
  assert.equal(entry.href, "/module/future-module")
  const policy = administrativeModulePolicies(registry).find(
    (policy) => policy.match.path === entry.href,
  )
  assert.equal(policy.canAccess(superadmin), true)
  for (const role of ["ADMIN", "STAFF", "USER"])
    assert.equal(
      policy.canAccess({ ...superadmin, role, permissions: [] }),
      false,
    )
  assert.equal(
    administrativeModulePolicies(registry).some(
      (policy) => policy.moduleId === "unfinished",
    ),
    false,
  )
})

test("unknown protected routes, prefix lookalikes and unavailable modules fail closed", () => {
  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"])
    for (const path of [
      "/unknown",
      "/module/unknown",
      "/module/billing-finance",
      "/accounts-legacy",
      "/employees/unknown",
      "/attendance/unknown",
      "/projects/id/unknown",
      "/settings/unknown",
    ])
      assert.equal(
        canAccessRoute({ ...superadmin, role }, path),
        false,
        `${role}: ${path}`,
      )
  assert.equal(
    getWorkspaceModules(superadmin).find(
      (module) => module.id === "billing-finance",
    ).href,
    null,
  )
  assert.equal(
    resolveWorkspaceModuleId(superadmin, "/messages", "billing-finance"),
    null,
  )
})

test("module entry never grants Staff participation, Client actions, or personal attendance", () => {
  for (const path of [
    "/project-workspace",
    "/request-inbox",
    "/staff-workload",
    "/projects",
    "/service-requests",
    "/attendance/check-ins",
    "/attendance/overview",
    "/attendance/my",
  ])
    assert.equal(canAccessRoute(superadmin, path), false, path)
  const overview = getNavigationPolicies(superadmin, "main").find(
    (policy) => policy.id === "module-project-management",
  )
  assert.equal(overview, undefined)
  assert.equal(
    resolveWorkspaceModuleId(superadmin, "/calendar", "project-management"),
    "project-management",
  )
})

test("new administrative entries require an active account and the explicit capability", () => {
  for (const actor of [
    { ...superadmin, permissions: [] },
    { ...superadmin, isActive: false },
    { ...superadmin, accountDeletedAt: "2026-11-14" },
  ]) {
    assert.equal(canAccessRoute(actor, "/module/project-management"), false)
    assert.deepEqual(getAdministrativeModuleEntries(actor, moduleRegistry), [])
  }
})

test("all implemented portal pages have explicit authorization policies", async () => {
  const root = new URL("../src/app/(portal)/", import.meta.url)
  for (const file of await readdir(root, { recursive: true })) {
    const normalized = file.replaceAll("\\", "/")
    if (!normalized.endsWith("/page.tsx")) continue
    const path =
      "/" +
      normalized
        .replace(/\/page\.tsx$/, "")
        .replaceAll("[id]", "record-id")
        .replaceAll("[milestoneId]", "milestone-id")
        .replaceAll("[moduleId]", "project-management")
    assert.ok(findRoutePolicy(path), path)
  }
})
