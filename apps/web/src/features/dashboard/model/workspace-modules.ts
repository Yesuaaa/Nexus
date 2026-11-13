import type { Account } from "../../auth/model/types.ts"
import {
  canAccessRoute,
  type WorkspaceModuleId,
} from "../../workspaces/model/route-policy.ts"

export type WorkspaceModule = {
  id: WorkspaceModuleId
  title: string
  description: string
  href: string
}

export function getWorkspaceModules(account: Account): WorkspaceModule[] {
  if (account.role === "USER") return []

  const modules: WorkspaceModule[] = []

  if (canAccessRoute(account, "/services")) {
    modules.push({
      id: "service-operations",
      title: "Service Operations",
      description: "Browse services and manage your service requests.",
      href: "/services",
    })
  } else if (canAccessRoute(account, "/request-inbox")) {
    modules.push({
      id: "service-operations",
      title: "Service Operations",
      description: "Review incoming service requests for your department.",
      href: "/request-inbox",
    })
  } else if (canAccessRoute(account, "/clients")) {
    modules.push({
      id: "service-operations",
      title: "Service Operations",
      description: "Manage services and client delivery operations.",
      href: "/clients",
    })
  }

  if (canAccessRoute(account, "/project-workspace")) {
    modules.push({
      id: "project-management",
      title: "Project Management",
      description:
        "Coordinate assigned projects, milestones, and deliverables.",
      href: "/project-workspace",
    })
  } else if (canAccessRoute(account, "/projects")) {
    modules.push({
      id: "project-management",
      title: "Project Management",
      description: "Track your active projects and deliverables.",
      href: "/projects",
    })
  }

  if (
    canAccessRoute(account, "/employees") ||
    canAccessRoute(account, "/departments")
  ) {
    modules.push({
      id: "people-hr",
      title: "People & HR",
      description: "Manage employee records and department structure.",
      href: canAccessRoute(account, "/employees")
        ? "/employees"
        : "/departments",
    })
  }

  if (canAccessRoute(account, "/accounts")) {
    modules.push({
      id: "administration",
      title: "Administration",
      description: "Manage user accounts, roles, and access controls.",
      href: "/accounts",
    })
  }

  return modules
}
