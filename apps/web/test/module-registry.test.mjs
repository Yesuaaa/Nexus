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
  getNavigationLabel,
} from "../src/features/workspaces/model/route-policy.ts"
import { resolveWorkspaceModuleId } from "../src/features/workspaces/model/workspace-selection.ts"
const payrollAccess = await import("../src/features/auth/model/permissions.ts")

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
    [
      "service-operations",
      "project-management",
      "people-hr",
      "attendance-monitoring",
      "administration",
    ],
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
    "/attendance/time-logs/overview",
  )
})

test("registration alone adds a future implemented administrative entry and route", () => {
  const registry = {
    ...moduleRegistry,
    "future-module": {
      ...moduleRegistry["project-management"],
      title: "Future Module",
      administrativePath: null,
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

test("Payroll route and write capability follow the Payroll-specific role split", () => {
  assert.equal(typeof payrollAccess.canAccessPayroll, "function")
  assert.equal(typeof payrollAccess.canManagePayroll, "function")
  if (
    typeof payrollAccess.canAccessPayroll !== "function" ||
    typeof payrollAccess.canManagePayroll !== "function"
  )
    return

  const cases = [
    {
      role: "ADMIN",
      permissions: ["payroll:read", "payroll:manage"],
      canRead: true,
      canManage: true,
    },
    {
      role: "SUPERADMIN",
      permissions: ["payroll:read"],
      canRead: true,
      canManage: false,
    },
    {
      role: "STAFF",
      permissions: ["payroll:read", "payroll:manage"],
      canRead: false,
      canManage: false,
    },
    {
      role: "USER",
      permissions: [],
      canRead: false,
      canManage: false,
    },
  ]

  for (const scenario of cases) {
    const actor = { ...superadmin, ...scenario }
    assert.equal(payrollAccess.canAccessPayroll(actor), scenario.canRead)
    assert.equal(payrollAccess.canManagePayroll(actor), scenario.canManage)
    assert.equal(
      canAccessRoute(actor, "/module/payroll"),
      scenario.canRead,
      scenario.role,
    )
    for (const section of ["compensation", "settings"])
      assert.equal(
        canAccessRoute(actor, `/module/payroll/${section}`),
        scenario.canRead,
        `${scenario.role} ${section}`,
      )
  }
  assert.equal(
    payrollAccess.canAccessPayroll({
      ...superadmin,
      role: "ADMIN",
      permissions: ["payroll:read"],
      isActive: false,
    }),
    false,
  )
  assert.equal(
    payrollAccess.canAccessPayroll({
      ...superadmin,
      role: "ADMIN",
      permissions: ["payroll:read"],
      accountDeletedAt: "2026-11-14T00:00:00.000Z",
    }),
    false,
  )
})

test("Workforce Compliance contains administrative Payroll while Staff has a separate My Payroll workspace", () => {
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN", "USER"]) {
    const actor = {
      ...superadmin,
      role,
      permissions: role === "STAFF" ? [] : superadmin.permissions,
    }
    const staff = role === "STAFF"
    const entries = getWorkspaceModules(actor).filter(
      (module) => module.id === "payroll",
    )
    assert.equal(entries.length, 0)
    assert.equal(
      getWorkspaceModules(actor).some((module) => module.id === "my-payroll"),
      staff,
    )
    if (role === "ADMIN" || role === "SUPERADMIN") {
      for (const path of [
        "/module/payroll",
        "/module/payroll/runs",
        "/module/payroll/disbursements",
      ])
        assert.equal(
          resolveWorkspaceModuleId(actor, path, null),
          "attendance-monitoring",
        )
      assert.equal(
        getNavigationPolicies(actor, "main").find(
          (entry) => entry.id === "module-payroll",
        )?.moduleId,
        "attendance-monitoring",
      )
    }
    if (staff) {
      assert.ok(
        getWorkspaceModules(actor).some(
          (module) =>
            module.id === "attendance-monitoring" &&
            module.title === "Workforce Compliance",
        ),
      )
    }
    for (const path of [
      "/my-payroll",
      "/attendance/my-payroll",
      "/staff/my-payroll",
    ]) {
      assert.equal(canAccessRoute(actor, path), staff)
      assert.equal(
        resolveWorkspaceModuleId(actor, path, "payroll"),
        staff ? "my-payroll" : null,
      )
    }
    if (staff) {
      const policy = getNavigationPolicies(actor, "main").find(
        (entry) => entry.id === "staff-my-payroll",
      )
      assert.ok(policy)
      assert.equal(policy.navigation.href, "/my-payroll")
      assert.equal(getNavigationLabel(policy, actor), "My Payroll")
      assert.equal(canAccessRoute(actor, "/module/payroll"), false)
    }
  }
  for (const state of [
    { isActive: false },
    { accountDeletedAt: "2026-11-17" },
  ]) {
    const actor = { ...superadmin, role: "STAFF", ...state }
    assert.equal(canAccessRoute(actor, "/my-payroll"), false)
    assert.equal(getWorkspaceModules(actor).length, 0)
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
