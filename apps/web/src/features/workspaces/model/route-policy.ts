import { attendanceNavigation } from "../../attendance/model/navigation.ts"
import {
  hasPermission,
  Permissions,
  canAccessAccountManagement,
  canAccessAttendance,
  canAccessPersonalAttendance,
  canManageAttendance,
  canConfigureAttendance,
  canAccessBookedServices,
  canAccessCalendar,
  canAccessClientManagement,
  canAccessDepartmentManagement,
  canAccessEmployeeManagement,
  canAccessMessages,
  canInspectBusinessConversations,
  canAccessProjects,
  canAccessProjectWorkspace,
  canCreateProjectWorkspace,
  canAccessRequestInbox,
  canAccessServiceCatalog,
  canAccessServiceManagement,
} from "../../auth/model/permissions.ts"
import type { Account } from "../../auth/model/types.ts"
import {
  canAccessAdministrativeModules,
  getModuleLogsLabel,
  moduleRegistry,
  type ModuleRegistration,
  type WorkspaceModuleId,
} from "./module-registry.ts"

export type { WorkspaceModuleId } from "./module-registry.ts"

export const workspaceModuleLabels = Object.fromEntries(
  Object.entries(moduleRegistry).map(([id, module]) => [id, module.title]),
) as Record<WorkspaceModuleId, string>

export type RoutePolicyId =
  | `module-${string}`
  | "employees-overview"
  | "attendance-time-logs"
  | "attendance-audit"
  | "attendance-audit-legacy"
  | "attendance-policy-assignments-legacy"
  | "attendance-requests"
  | "attendance-policies"
  | (typeof attendanceNavigation)[number]["links"][number]["id"]
  | "attendance"
  | "attendance-overview"
  | "attendance-my"
  | "attendance-records"
  | "attendance-adjustments"
  | "attendance-settings"
  | "attendance-my-legacy"
  | "attendance-records-legacy"
  | "attendance-settings-legacy"
  | "dashboard"
  | "module"
  | "accounts"
  | "messages"
  | "messages-oversight"
  | "projects-deliverable"
  | "projects-detail"
  | "projects"
  | "project-workspace-overview"
  | "project-workspace-new"
  | "project-workspace-detail"
  | "project-workspace"
  | "admin-project-management"
  | "admin-project-management-overview"
  | "admin-project-management-department"
  | "departments"
  | "departments-overview"
  | "employees"
  | "services"
  | "services-overview"
  | "calendar"
  | "service-requests"
  | "help"
  | "billing-logs"
  | "clients"
  | "booked-services"
  | "staff-workload"
  | "administrative-workload"
  | "service-operation-logs"
  | "project-management-logs"
  | "people-hr-logs"
  | "workforce-compliance-logs"
  | "request-inbox-overview"
  | "request-inbox"
  | "profile"
  | "settings"

export type RouteMatch =
  { kind: "exact" | "prefix"; path: string } | { kind: "pattern"; path: string }

type NavigationLocation = "main" | "system-tool" | "footer"

type RouteNavigation = {
  href: string | ((account: Account) => string)
  label: string | ((account: Account) => string)
  location: NavigationLocation
  order: number
  activeMatch?: RouteMatch
  visible?: (account: Account) => boolean
}

export type RoutePolicy = {
  id: RoutePolicyId
  match: RouteMatch
  moduleId: WorkspaceModuleId | null
  canAccess: (account: Account) => boolean
  navigation?: RouteNavigation
}

const alwaysAccessible = () => true

export function administrativeModulePolicies(
  registry: Readonly<Record<string, ModuleRegistration>> = moduleRegistry,
): RoutePolicy[] {
  return Object.entries(registry)
    .filter(([, module]) => module.implemented)
    .map(([id, module]) => ({
      id: `module-${id}`,
      match: { kind: "exact", path: `/module/${id}` },
      moduleId: id as WorkspaceModuleId,
      canAccess: canAccessAdministrativeModules,
      ...(module.administrativePath === null || id === "service-operations"
        ? {
            navigation: {
              href: `/module/${id}`,
              label:
                id === "service-operations" ? "Request Overview" : "Overview",
              location: "main" as const,
              order: 1,
            },
          }
        : {}),
    }))
}

export const routePolicies: readonly RoutePolicy[] = [
  {
    id: "project-management-logs",
    match: { kind: "exact", path: "/module/project-management/logs" },
    moduleId: "project-management",
    canAccess: (account) =>
      account.role === "SUPERADMIN" &&
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
    navigation: {
      href: "/module/project-management/logs",
      label: getModuleLogsLabel("project-management"),
      location: "system-tool",
      order: 0,
    },
  },
  {
    id: "service-operation-logs",
    match: { kind: "exact", path: "/module/service-operations/logs" },
    moduleId: "service-operations",
    canAccess: (account) =>
      account.role === "SUPERADMIN" &&
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
    navigation: {
      href: "/module/service-operations/logs",
      label: getModuleLogsLabel("service-operations"),
      location: "system-tool",
      order: 0,
    },
  },
  {
    id: "people-hr-logs",
    match: { kind: "exact", path: "/module/people-hr/logs" },
    moduleId: "people-hr",
    canAccess: (account) =>
      account.role === "SUPERADMIN" &&
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
    navigation: {
      href: "/module/people-hr/logs",
      label: getModuleLogsLabel("people-hr"),
      location: "system-tool",
      order: 0,
    },
  },
  {
    id: "workforce-compliance-logs",
    match: { kind: "exact", path: "/module/attendance-monitoring/logs" },
    moduleId: "attendance-monitoring",
    canAccess: (account) =>
      account.role === "SUPERADMIN" &&
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
    navigation: {
      href: "/module/attendance-monitoring/logs",
      label: getModuleLogsLabel("attendance-monitoring"),
      location: "system-tool",
      order: 0,
    },
  },
  ...administrativeModulePolicies(),
  {
    id: "administrative-workload",
    match: { kind: "exact", path: "/module/service-operations/workload" },
    moduleId: "service-operations",
    canAccess: (account) =>
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
    navigation: {
      href: "/module/service-operations/workload",
      label: "Staff Workload",
      location: "main",
      order: 80,
    },
  },
  {
    id: "admin-project-management-overview",
    match: { kind: "exact", path: "/project-management/overview" },
    moduleId: "project-management",
    canAccess: (account) =>
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL),
  },
  {
    id: "admin-project-management",
    match: { kind: "exact", path: "/project-management" },
    moduleId: "project-management",
    canAccess: (account) =>
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL) &&
      hasPermission(account, Permissions.DEPARTMENTS_READ),
    navigation: {
      href: "/project-management",
      label: "Project Workspace Management",
      location: "main",
      order: 120,
      activeMatch: { kind: "prefix", path: "/project-management" },
    },
  },
  {
    id: "admin-project-management-department",
    match: {
      kind: "pattern",
      path: "/project-management/departments/[departmentId]/projects",
    },
    moduleId: "project-management",
    canAccess: (account) =>
      canAccessAdministrativeModules(account) &&
      hasPermission(account, Permissions.ORGANIZATION_READ_ALL) &&
      hasPermission(account, Permissions.DEPARTMENTS_READ),
  },
  ...attendanceNavigation.flatMap((group, index): RoutePolicy[] => [
    ...group.links.map((link): RoutePolicy => ({
      id: link.id,
      match: { kind: "exact", path: link.href },
      moduleId: "attendance-monitoring",
      canAccess:
        group.id === "attendance"
          ? canAccessPersonalAttendance
          : link.access === "configure"
            ? canConfigureAttendance
            : link.access === "manage"
              ? canManageAttendance
              : canAccessAttendance,
    })),
    {
      id: group.id,
      match: {
        kind: "exact",
        path:
          index === 0
            ? "/attendance"
            : group.links[0].href.replace(/\/overview$/, ""),
      },
      moduleId: "attendance-monitoring",
      canAccess:
        group.access === "configure"
          ? canConfigureAttendance
          : group.access === "manage"
            ? canManageAttendance
            : canAccessAttendance,
      navigation: {
        visible: (account) =>
          group.id !== "attendance" || canAccessPersonalAttendance(account),
        href: (account) =>
          group.id === "attendance" && !canManageAttendance(account)
            ? "/attendance/check-ins"
            : group.links[0].href,
        label: group.label,
        location: "main",
        order: 35 + index,
      },
    },
  ]),
  {
    id: "attendance-audit",
    match: { kind: "exact", path: "/attendance/audit" },
    moduleId: "attendance-monitoring",
    canAccess: canManageAttendance,
    navigation: {
      href: "/attendance/audit",
      label: "Audit Trail",
      location: "main",
      order: 39,
    },
  },
  {
    id: "attendance-audit-legacy",
    match: { kind: "exact", path: "/attendance/time-logs/audit" },
    moduleId: "attendance-monitoring",
    canAccess: canManageAttendance,
  },
  {
    id: "attendance-policy-assignments-legacy",
    match: { kind: "exact", path: "/attendance/policies/assignments" },
    moduleId: "attendance-monitoring",
    canAccess: canConfigureAttendance,
  },
  {
    id: "attendance-adjustments",
    match: { kind: "exact", path: "/attendance/adjustments" },
    moduleId: "attendance-monitoring",
    canAccess: canAccessAttendance,
  },
  {
    id: "attendance-my-legacy",
    match: { kind: "exact", path: "/attendance/my" },
    moduleId: "attendance-monitoring",
    canAccess: canAccessPersonalAttendance,
  },
  {
    id: "attendance-records-legacy",
    match: { kind: "exact", path: "/attendance/records" },
    moduleId: "attendance-monitoring",
    canAccess: canManageAttendance,
  },
  {
    id: "attendance-settings-legacy",
    match: { kind: "exact", path: "/attendance/settings" },
    moduleId: "attendance-monitoring",
    canAccess: canConfigureAttendance,
  },
  {
    id: "attendance",
    match: { kind: "exact", path: "/attendance" },
    moduleId: "attendance-monitoring",
    canAccess: canAccessAttendance,
  },
  {
    id: "dashboard",
    match: { kind: "exact", path: "/dashboard" },
    moduleId: null,
    canAccess: alwaysAccessible,
    navigation: {
      href: (account) => (account.role === "USER" ? "/dashboard" : "/module"),
      label: (account) => (account.role === "USER" ? "Dashboard" : "Module"),
      location: "main",
      order: 0,
    },
  },
  {
    id: "module",
    match: { kind: "exact", path: "/module" },
    moduleId: null,
    canAccess: (account) => account.role !== "USER",
  },
  {
    id: "accounts",
    match: { kind: "exact", path: "/accounts" },
    moduleId: "administration",
    canAccess: canAccessAccountManagement,
    navigation: {
      href: "/accounts",
      label: "Account Management",
      location: "main",
      order: 10,
    },
  },
  {
    id: "messages",
    match: { kind: "exact", path: "/messages" },
    moduleId: null,
    canAccess: canAccessMessages,
  },
  {
    id: "messages-oversight",
    match: { kind: "exact", path: "/messages/oversight" },
    moduleId: null,
    canAccess: canInspectBusinessConversations,
  },
  {
    id: "projects-deliverable",
    match: {
      kind: "pattern",
      path: "/projects/[id]/deliverables/[milestoneId]",
    },
    moduleId: "project-management",
    canAccess: canAccessProjects,
  },
  {
    id: "projects-detail",
    match: { kind: "pattern", path: "/projects/[id]" },
    moduleId: "project-management",
    canAccess: canAccessProjects,
  },
  {
    id: "projects",
    match: { kind: "exact", path: "/projects" },
    moduleId: "project-management",
    canAccess: canAccessProjects,
    navigation: {
      href: "/projects",
      label: "My Projects",
      location: "main",
      order: 70,
      activeMatch: { kind: "prefix", path: "/projects" },
      visible: (account) => account.role === "USER",
    },
  },
  {
    id: "project-workspace-overview",
    match: { kind: "exact", path: "/project-workspace/overview" },
    moduleId: "project-management",
    canAccess: canCreateProjectWorkspace,
  },
  {
    id: "project-workspace-new",
    match: { kind: "exact", path: "/project-workspace/new" },
    moduleId: "project-management",
    canAccess: canAccessProjectWorkspace,
  },
  {
    id: "project-workspace-detail",
    match: { kind: "pattern", path: "/project-workspace/[id]" },
    moduleId: "project-management",
    canAccess: canAccessProjectWorkspace,
  },
  {
    id: "project-workspace",
    match: { kind: "exact", path: "/project-workspace" },
    moduleId: "project-management",
    canAccess: canAccessProjectWorkspace,
    navigation: {
      href: "/project-workspace",
      label: "Project Workspace",
      location: "main",
      order: 100,
      activeMatch: { kind: "prefix", path: "/project-workspace" },
    },
  },
  {
    id: "departments-overview",
    match: { kind: "exact", path: "/departments/overview" },
    moduleId: "people-hr",
    canAccess: canAccessDepartmentManagement,
  },
  {
    id: "departments",
    match: { kind: "exact", path: "/departments" },
    moduleId: "people-hr",
    canAccess: canAccessDepartmentManagement,
    navigation: {
      href: "/departments",
      label: "Department Management",
      location: "main",
      order: 20,
    },
  },
  {
    id: "employees-overview",
    match: { kind: "exact", path: "/employees/overview" },
    moduleId: "people-hr",
    canAccess: canAccessEmployeeManagement,
  },
  {
    id: "employees",
    match: { kind: "exact", path: "/employees" },
    moduleId: "people-hr",
    canAccess: canAccessEmployeeManagement,
    navigation: {
      href: "/employees",
      label: "Employee Management",
      location: "main",
      order: 30,
    },
  },
  {
    id: "services-overview",
    match: { kind: "exact", path: "/services/overview" },
    moduleId: "service-operations",
    canAccess: canAccessServiceManagement,
  },
  {
    id: "services",
    match: { kind: "exact", path: "/services" },
    moduleId: "service-operations",
    canAccess: (account) =>
      canAccessServiceCatalog(account) || canAccessServiceManagement(account),
    navigation: {
      href: "/services",
      label: (account) =>
        account.role === "USER" ? "Services" : "Service Management",
      location: "main",
      order: 40,
    },
  },
  {
    id: "service-requests",
    match: { kind: "exact", path: "/service-requests" },
    moduleId: "service-operations",
    canAccess: canAccessServiceCatalog,
    navigation: {
      href: "/service-requests",
      label: "Booked Requests",
      location: "main",
      order: 50,
    },
  },
  {
    id: "calendar",
    match: { kind: "exact", path: "/calendar" },
    moduleId: null,
    canAccess: canAccessCalendar,
    navigation: {
      href: "/calendar",
      label: "Calendar",
      location: "main",
      order: 60,
    },
  },
  {
    id: "staff-workload",
    match: { kind: "exact", path: "/staff-workload" },
    moduleId: "project-management",
    canAccess: canAccessRequestInbox,
    navigation: {
      href: "/staff-workload",
      label: "Staff Workload",
      location: "main",
      order: 80,
    },
  },
  {
    id: "request-inbox-overview",
    match: { kind: "exact", path: "/request-inbox/overview" },
    moduleId: "service-operations",
    canAccess: canAccessRequestInbox,
  },
  {
    id: "request-inbox",
    match: { kind: "exact", path: "/request-inbox" },
    moduleId: "service-operations",
    canAccess: canAccessRequestInbox,
    navigation: {
      href: "/request-inbox",
      label: "Request Inbox",
      location: "main",
      order: 90,
    },
  },
  {
    id: "clients",
    match: { kind: "exact", path: "/clients" },
    moduleId: "service-operations",
    canAccess: canAccessClientManagement,
    navigation: {
      href: "/clients",
      label: "Client Management",
      location: "main",
      order: 110,
    },
  },
  {
    id: "booked-services",
    match: { kind: "exact", path: "/booked-services" },
    moduleId: "service-operations",
    canAccess: canAccessBookedServices,
  },
  {
    id: "help",
    match: { kind: "exact", path: "/help" },
    moduleId: "service-operations",
    canAccess: canAccessServiceCatalog,
    navigation: {
      href: "/help",
      label: "Help & Support",
      location: "footer",
      order: 0,
    },
  },
  {
    id: "billing-logs",
    match: { kind: "exact", path: "/billing-logs" },
    moduleId: null,
    canAccess: (account) => account.role === "USER",
  },
  {
    id: "profile",
    match: { kind: "exact", path: "/profile" },
    moduleId: null,
    canAccess: alwaysAccessible,
  },
  {
    id: "settings",
    match: { kind: "exact", path: "/settings" },
    moduleId: null,
    canAccess: alwaysAccessible,
  },
]

function normalizedSegments(path: string): string[] {
  return path.split("/").filter(Boolean)
}

export function routeMatches(pathname: string, match: RouteMatch): boolean {
  if (match.kind === "exact") return pathname === match.path
  if (match.kind === "prefix")
    return (
      pathname === match.path ||
      pathname.startsWith(`${match.path.replace(/\/$/, "")}/`)
    )

  const actual = normalizedSegments(pathname)
  const expected = normalizedSegments(match.path)
  return (
    actual.length === expected.length &&
    expected.every(
      (segment, index) =>
        (segment.startsWith("[") && segment.endsWith("]")) ||
        segment === actual[index],
    )
  )
}

export function findRoutePolicy(pathname: string): RoutePolicy | undefined {
  return routePolicies.find((policy) => routeMatches(pathname, policy.match))
}

export function canAccessRoute(account: Account, pathname: string): boolean {
  return findRoutePolicy(pathname)?.canAccess(account) ?? false
}

export function isRouteDenied(account: Account, pathname: string): boolean {
  return !canAccessRoute(account, pathname)
}

export function getActiveWorkspaceModuleId(
  account: Account,
  pathname: string,
): WorkspaceModuleId | null {
  const policy = findRoutePolicy(pathname)
  if (!policy?.moduleId || !policy.canAccess(account)) return null
  return policy.moduleId
}

export function getNavigationPolicies(
  account: Account,
  location: NavigationLocation,
): RoutePolicy[] {
  return routePolicies
    .filter(
      (policy) =>
        policy.navigation?.location === location &&
        policy.canAccess(account) &&
        (policy.navigation.visible?.(account) ?? true),
    )
    .sort(
      (left, right) =>
        (left.navigation?.order ?? 0) - (right.navigation?.order ?? 0),
    )
}

export function getNavigationLabel(
  policy: RoutePolicy,
  account: Account,
): string {
  const label = policy.navigation?.label
  if (!label) return ""
  return typeof label === "function" ? label(account) : label
}

export function isNavigationActive(
  policy: RoutePolicy,
  pathname: string,
): boolean {
  return routeMatches(pathname, policy.navigation?.activeMatch ?? policy.match)
}
