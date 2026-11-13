import assert from "node:assert/strict"
import { test } from "node:test"
import { Permissions } from "../src/features/auth/model/permissions.ts"
import {
  canAccessRoute,
  findRoutePolicy,
  getActiveWorkspaceModuleId,
  getNavigationLabel,
  getNavigationPolicies,
  isNavigationActive,
} from "../src/features/workspaces/model/route-policy.ts"

const permissionsByRole = {
  USER: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
  ],
  STAFF: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
  ],
  ADMIN: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
    Permissions.DEPARTMENTS_MANAGE,
    Permissions.DEPARTMENTS_DELETE,
    Permissions.EMPLOYEES_READ,
    Permissions.EMPLOYEES_MANAGE,
    Permissions.SERVICES_READ,
    Permissions.SERVICES_MANAGE,
    Permissions.CLIENTS_READ,
  ],
  SUPERADMIN: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
    Permissions.DEPARTMENTS_MANAGE,
    Permissions.DEPARTMENTS_DELETE,
    Permissions.ACCOUNTS_READ,
    Permissions.ACCOUNTS_RESET_PASSWORD,
    Permissions.ACCOUNTS_CREATE_BASIC,
    Permissions.ACCOUNTS_CREATE_PRIVILEGED,
    Permissions.ACCOUNTS_ASSIGN_BASIC,
    Permissions.ACCOUNTS_ASSIGN_PRIVILEGED,
    Permissions.ACCOUNTS_STATUS_BASIC,
    Permissions.ACCOUNTS_STATUS_PRIVILEGED,
  ],
}

function account(
  role,
  { headOf = null, permissions = permissionsByRole[role] } = {},
) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: role,
    contactNumber: null,
    role,
    isActive: true,
    permissions,
    headOf,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

const routeMatrix = {
  USER: [
    "/dashboard",
    "/messages?request=request-1",
    "/projects",
    "/projects/project-1",
    "/projects/project-1/deliverables/deliverable-1",
    "/services",
    "/service-requests",
    "/help",
    "/billing-logs",
    "/booked-services",
    "/booked-services/legacy-1",
    "/calendar",
    "/profile",
    "/settings",
  ],
  STAFF: [
    "/dashboard",
    "/messages?project=project-1",
    "/projects",
    "/projects/project-1",
    "/project-workspace",
    "/project-workspace/new",
    "/project-workspace/project-1",
    "/calendar",
    "/profile",
    "/settings",
  ],
  STAFF_HEAD: [
    "/dashboard",
    "/messages",
    "/projects",
    "/project-workspace",
    "/request-inbox",
    "/request-inbox/request-1",
    "/staff-workload",
    "/calendar",
    "/profile",
    "/settings",
  ],
  ADMIN: [
    "/dashboard",
    "/messages",
    "/services",
    "/clients",
    "/clients/client-1",
    "/departments",
    "/employees",
    "/employees/employee-1",
    "/calendar",
    "/profile",
    "/settings",
  ],
  SUPERADMIN: [
    "/dashboard",
    "/messages",
    "/accounts",
    "/accounts/account-1",
    "/calendar",
    "/profile",
    "/settings",
  ],
}

const protectedRoutes = [
  "/accounts",
  "/projects",
  "/project-workspace",
  "/departments",
  "/employees",
  "/services",
  "/service-requests",
  "/help",
  "/billing-logs",
  "/clients",
  "/booked-services",
  "/staff-workload",
  "/request-inbox",
]

for (const [actor, allowedRoutes] of Object.entries(routeMatrix)) {
  test(`${actor} keeps the characterized route-policy access matrix`, () => {
    const role = actor === "STAFF_HEAD" ? "STAFF" : actor
    const currentAccount = account(role, {
      headOf:
        actor === "STAFF_HEAD" ? { id: "department-1", name: "Design" } : null,
    })

    for (const pathname of allowedRoutes)
      assert.equal(canAccessRoute(currentAccount, pathname.split("?")[0]), true)

    for (const pathname of protectedRoutes) {
      const shouldAllow = allowedRoutes.some(
        (allowed) => allowed.split("?")[0] === pathname,
      )
      if (!shouldAllow)
        assert.equal(
          canAccessRoute(currentAccount, pathname),
          false,
          `${actor} unexpectedly accessed ${pathname}`,
        )
    }
  })
}

test("dynamic project routes select explicit policies before compatibility fallbacks", () => {
  assert.equal(findRoutePolicy("/projects/project-1")?.id, "projects-detail")
  assert.equal(
    findRoutePolicy("/projects/project-1/deliverables/deliverable-1")?.id,
    "projects-deliverable",
  )
  assert.equal(
    findRoutePolicy("/projects/project-1/unknown")?.id,
    "projects-fallback",
  )
  assert.equal(
    findRoutePolicy("/project-workspace/new")?.id,
    "project-workspace-new",
  )
  assert.equal(
    findRoutePolicy("/project-workspace/project-1")?.id,
    "project-workspace-detail",
  )
})

test("route policies protect management subroutes and retain legacy prefix matching", () => {
  assert.equal(
    findRoutePolicy("/departments/team-1")?.id,
    "departments-overview",
  )
  assert.equal(findRoutePolicy("/services/custom")?.id, "services-overview")
  assert.equal(findRoutePolicy("/accounts-legacy")?.id, "accounts")
  assert.equal(
    findRoutePolicy("/booked-services/legacy-1")?.id,
    "booked-services",
  )
})

test("route policies record the approved module ownership without claiming shared pages", () => {
  const expectedOwnership = {
    "/services": "service-operations",
    "/request-inbox": "service-operations",
    "/clients": "service-operations",
    "/projects/project-1": "project-management",
    "/project-workspace/project-1": "project-management",
    "/staff-workload": "project-management",
    "/employees": "people-hr",
    "/departments": "people-hr",
    "/accounts": "administration",
    "/messages": null,
    "/calendar": null,
    "/billing-logs": null,
    "/profile": null,
    "/settings": null,
  }

  for (const [pathname, moduleId] of Object.entries(expectedOwnership))
    assert.equal(findRoutePolicy(pathname)?.moduleId, moduleId)
})

test("the active workspace is derived from the current authorized pathname", () => {
  const client = account("USER")
  const staff = account("STAFF")
  const head = account("STAFF", {
    headOf: { id: "department-1", name: "Design" },
  })
  const admin = account("ADMIN")
  const superadmin = account("SUPERADMIN")

  assert.equal(
    getActiveWorkspaceModuleId(client, "/booked-services/legacy-1"),
    "service-operations",
  )
  assert.equal(
    getActiveWorkspaceModuleId(client, "/projects/project-1"),
    "project-management",
  )
  assert.equal(
    getActiveWorkspaceModuleId(staff, "/project-workspace/project-1"),
    "project-management",
  )
  assert.equal(
    getActiveWorkspaceModuleId(head, "/request-inbox/request-1"),
    "service-operations",
  )
  assert.equal(
    getActiveWorkspaceModuleId(head, "/staff-workload"),
    "project-management",
  )
  assert.equal(getActiveWorkspaceModuleId(admin, "/employees"), "people-hr")
  assert.equal(
    getActiveWorkspaceModuleId(admin, "/clients"),
    "service-operations",
  )
  assert.equal(
    getActiveWorkspaceModuleId(superadmin, "/accounts"),
    "administration",
  )

  for (const pathname of [
    "/dashboard",
    "/messages",
    "/calendar",
    "/profile",
    "/settings",
    "/billing-logs",
  ])
    assert.equal(getActiveWorkspaceModuleId(client, pathname), null)

  assert.equal(getActiveWorkspaceModuleId(staff, "/request-inbox"), null)
})

test("navigation is generated from the same policies without changing role visibility", () => {
  const expectedLabels = {
    USER: [
      "Dashboard",
      "Services",
      "Booked Requests",
      "Calendar",
      "My Projects",
    ],
    STAFF: ["Module", "Attendance", "Calendar", "Project Workspace"],
    STAFF_HEAD: [
      "Module",
      "Attendance",
      "Calendar",
      "Staff Workload",
      "Request Inbox",
      "Project Workspace",
    ],
    ADMIN: [
      "Module",
      "Department Management",
      "Employee Management",
      "Attendance",
      "Service Management",
      "Calendar",
      "Client Management",
    ],
    SUPERADMIN: ["Module", "Account Management", "Calendar"],
  }

  for (const [actor, labels] of Object.entries(expectedLabels)) {
    const role = actor === "STAFF_HEAD" ? "STAFF" : actor
    const currentAccount = account(role, {
      headOf:
        actor === "STAFF_HEAD" ? { id: "department-1", name: "Design" } : null,
    })
    assert.deepEqual(
      getNavigationPolicies(currentAccount, "main").map((policy) =>
        getNavigationLabel(policy, currentAccount),
      ),
      labels,
    )
    assert.deepEqual(
      getNavigationPolicies(currentAccount, "footer").map((policy) =>
        getNavigationLabel(policy, currentAccount),
      ),
      actor === "USER" ? ["Help & Support"] : [],
    )
  }
})

test("project navigation remains active on current dynamic project routes", () => {
  const client = account("USER")
  const projectsPolicy = getNavigationPolicies(client, "main").find(
    (policy) => policy.id === "projects",
  )
  assert.ok(projectsPolicy)
  assert.equal(isNavigationActive(projectsPolicy, "/projects/project-1"), true)

  const staff = account("STAFF")
  const workspacePolicy = getNavigationPolicies(staff, "main").find(
    (policy) => policy.id === "project-workspace",
  )
  assert.ok(workspacePolicy)
  assert.equal(
    isNavigationActive(workspacePolicy, "/project-workspace/project-1"),
    true,
  )
})

test("department-head handoff immediately removes head-only routes and navigation", () => {
  const currentHead = account("STAFF", {
    headOf: { id: "department-1", name: "Design" },
  })
  const ordinaryStaff = { ...currentHead, headOf: null }

  assert.equal(canAccessRoute(currentHead, "/request-inbox"), true)
  assert.equal(canAccessRoute(ordinaryStaff, "/request-inbox"), false)
  assert.deepEqual(
    getNavigationPolicies(ordinaryStaff, "main").map((policy) => policy.id),
    ["dashboard", "attendance", "calendar", "project-workspace"],
  )
})

test("Module route and launcher links remain internal-only", () => {
  const client = account("USER")
  assert.equal(canAccessRoute(client, "/module"), false)
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"]) {
    const actor = account(role)
    assert.equal(canAccessRoute(actor, "/module"), true)
    const navigation = getNavigationPolicies(actor, "main").find(
      (policy) => policy.id === "dashboard",
    ).navigation
    assert.equal(navigation.href(actor), "/module")
  }
})

test("management overviews retain authorization and module context", () => {
  for (const [path, moduleId] of [
    ["/departments/overview", "people-hr"],
    ["/employees/overview", "people-hr"],
    ["/services/overview", "service-operations"],
  ]) {
    assert.equal(canAccessRoute(account("ADMIN"), path), true)
    assert.equal(getActiveWorkspaceModuleId(account("ADMIN"), path), moduleId)
    for (const role of ["USER", "STAFF", "SUPERADMIN"])
      assert.equal(canAccessRoute(account(role), path), false)
  }
  assert.equal(canAccessRoute(account("USER"), "/services"), true)
})
