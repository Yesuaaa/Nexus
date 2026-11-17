import type { Account } from "../../auth/model/types.ts"
import { getWorkspaceModules } from "../../dashboard/model/workspace-modules.ts"
import {
  canAccessRoute,
  getActiveWorkspaceModuleId,
  type WorkspaceModuleId,
} from "./route-policy.ts"

// This is shell context only. Route policies remain the access-control source.
export function resolveWorkspaceModuleId(
  account: Account,
  pathname: string,
  rememberedModuleId: string | null,
): WorkspaceModuleId | null {
  if (
    account.role === "USER" ||
    pathname === "/module" ||
    pathname === "/dashboard" ||
    !canAccessRoute(account, pathname)
  )
    return null

  const routeModuleId = getActiveWorkspaceModuleId(account, pathname)
  return (
    getWorkspaceModules(account).find(
      (module) => module.id === (routeModuleId ?? rememberedModuleId),
    )?.id ?? null
  )
}
