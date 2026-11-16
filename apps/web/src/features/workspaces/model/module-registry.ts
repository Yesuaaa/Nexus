import registry from "../../../../../api/src/features/modules/module-registry.json" with { type: "json" }
import { hasPermission, Permissions } from "../../auth/model/permissions.ts"
import type { Account } from "../../auth/model/types.ts"

export const moduleRegistry = registry
export type WorkspaceModuleId = keyof typeof registry
export type ModuleRegistration = (typeof registry)[WorkspaceModuleId]

export function canAccessAdministrativeModules(account: Account): boolean {
  return Boolean(
    account.isActive &&
    !account.accountDeletedAt &&
    hasPermission(account, Permissions.MODULES_ACCESS_ALL),
  )
}

export function getAdministrativeModuleEntries<
  T extends Record<string, ModuleRegistration>,
>(account: Account, definitions: T) {
  if (!canAccessAdministrativeModules(account)) return []
  return (Object.keys(definitions) as (keyof T & string)[])
    .filter((id) => definitions[id].implemented)
    .map((id) => ({
      id,
      title: definitions[id].title,
      description: definitions[id].description,
      href: definitions[id].administrativePath ?? `/module/${id}`,
    }))
}
