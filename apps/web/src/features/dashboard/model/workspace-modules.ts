import type { Account } from "../../auth/model/types.ts"
import { canAccessRoute } from "../../workspaces/model/route-policy.ts"
import {
  canAccessAdministrativeModules,
  getAdministrativeModuleEntries,
  moduleRegistry,
  type WorkspaceModuleId,
} from "../../workspaces/model/module-registry.ts"

export type WorkspaceModule = {
  id: WorkspaceModuleId
  title: string
  description: string
  href: string | null
  placeholder?: boolean
}

export function getWorkspaceModules(account: Account): WorkspaceModule[] {
  if (account.role === "USER" || !account.isActive || account.accountDeletedAt)
    return []

  const modules: WorkspaceModule[] = getAdministrativeModuleEntries(
    account,
    moduleRegistry,
  )
  function add(id: WorkspaceModuleId, href: string) {
    const module = moduleRegistry[id]
    if (module.implemented)
      modules.push({
        id,
        title: module.title,
        description: module.description,
        href,
      })
  }

  // Ordinary-role entry priorities and operational route checks remain unchanged.
  if (!canAccessAdministrativeModules(account)) {
    if (canAccessRoute(account, "/services"))
      add("service-operations", "/services")
    else if (canAccessRoute(account, "/request-inbox"))
      add("service-operations", "/request-inbox")
    else if (canAccessRoute(account, "/clients"))
      add("service-operations", "/clients")

    if (canAccessRoute(account, "/project-workspace"))
      add("project-management", "/project-workspace")
    else if (canAccessRoute(account, "/projects"))
      add("project-management", "/projects")

    if (canAccessRoute(account, "/employees")) add("people-hr", "/employees")
    else if (canAccessRoute(account, "/departments"))
      add("people-hr", "/departments")

    if (canAccessRoute(account, "/attendance/check-ins"))
      add(
        "attendance-monitoring",
        canAccessRoute(account, "/attendance/dashboard")
          ? "/attendance/overview"
          : "/attendance/check-ins",
      )
    if (canAccessRoute(account, "/accounts")) add("administration", "/accounts")
  }

  if (modules.length > 0)
    for (const id of Object.keys(moduleRegistry) as WorkspaceModuleId[]) {
      const module = moduleRegistry[id]
      if (!module.implemented)
        modules.push({
          id,
          title: module.title,
          description: module.description,
          href: null,
          placeholder: true,
        })
    }
  return modules
}
