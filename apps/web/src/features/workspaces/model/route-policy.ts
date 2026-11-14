import { attendanceNavigation } from "../../attendance/model/navigation.ts"
import {
  canAccessAccountManagement,
  canAccessAttendance,
  canManageAttendance,
  canConfigureAttendance,
  canAccessBookedServices,
  canAccessCalendar,
  canAccessClientManagement,
  canAccessDepartmentManagement,
  canAccessEmployeeManagement,
  canAccessMessages,
  canAccessProjects,
  canAccessProjectWorkspace,
  canAccessRequestInbox,
  canAccessServiceCatalog,
  canAccessServiceManagement,
} from "../../auth/model/permissions.ts"
import type { Account } from "../../auth/model/types.ts"

export type WorkspaceModuleId =
  | "service-operations"
  | "project-management"
  | "people-hr"
  | "attendance-monitoring"
  | "administration"

export const workspaceModuleLabels: Record<WorkspaceModuleId, string> = {
  "service-operations": "Service Operations",
  "project-management": "Project Management",
  "people-hr": "People & HR",
  "attendance-monitoring": "Attendance & Monitoring",
  administration: "Administration",
}

export type RoutePolicyId =
  | "attendance-dashboard"
  | "attendance-time-logs"
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
  | "projects-deliverable"
  | "projects-detail"
  | "projects"
  | "projects-fallback"
  | "project-workspace-new"
  | "project-workspace-detail"
  | "project-workspace"
  | "project-workspace-fallback"
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
  | "request-inbox"
  | "profile"
  | "settings"

export type RouteMatch =
  { kind: "exact" | "prefix"; path: string } | { kind: "pattern"; path: string }

type NavigationLocation = "main" | "footer"

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

export const routePolicies: readonly RoutePolicy[] = [
  ...attendanceNavigation.flatMap((group, index): RoutePolicy[] => [
    ...group.links.map((link): RoutePolicy => ({
      id: link.id,
      match: { kind: "exact", path: link.href },
      moduleId: "attendance-monitoring",
      canAccess:
        link.access === "configure"
          ? canConfigureAttendance
          : link.access === "manage"
            ? canManageAttendance
            : canAccessAttendance,
    })),
    {
      id: group.id,
      match: {
        kind: index === 0 ? "exact" : "prefix",
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
        href: (account) =>
          group.id === "attendance" && !canManageAttendance(account)
            ? "/attendance/check-ins"
            : group.links[0].href,
        label: group.label,
        location: "main",
        order: group.id === "attendance-dashboard" ? 34 : 35 + index,
      },
    },
  ]),
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
    canAccess: canAccessAttendance,
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
    match: { kind: "prefix", path: "/attendance" },
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
    match: { kind: "prefix", path: "/accounts" },
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
    match: { kind: "prefix", path: "/messages" },
    moduleId: null,
    canAccess: canAccessMessages,
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
    id: "projects-fallback",
    match: { kind: "prefix", path: "/projects" },
    moduleId: "project-management",
    canAccess: canAccessProjects,
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
    id: "project-workspace-fallback",
    match: { kind: "prefix", path: "/project-workspace" },
    moduleId: "project-management",
    canAccess: canAccessProjectWorkspace,
  },
  {
    id: "departments-overview",
    match: { kind: "prefix", path: "/departments/" },
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
    id: "employees",
    match: { kind: "prefix", path: "/employees" },
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
    match: { kind: "prefix", path: "/services/" },
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
    match: { kind: "prefix", path: "/service-requests" },
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
    match: { kind: "prefix", path: "/staff-workload" },
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
    id: "request-inbox",
    match: { kind: "prefix", path: "/request-inbox" },
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
    match: { kind: "prefix", path: "/clients" },
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
    match: { kind: "prefix", path: "/booked-services" },
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
    match: { kind: "prefix", path: "/profile" },
    moduleId: null,
    canAccess: alwaysAccessible,
  },
  {
    id: "settings",
    match: { kind: "prefix", path: "/settings" },
    moduleId: null,
    canAccess: alwaysAccessible,
  },
]

function normalizedSegments(path: string): string[] {
  return path.split("/").filter(Boolean)
}

export function routeMatches(pathname: string, match: RouteMatch): boolean {
  if (match.kind === "exact") return pathname === match.path
  if (match.kind === "prefix") return pathname.startsWith(match.path)

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
  return findRoutePolicy(pathname)?.canAccess(account) ?? true
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
