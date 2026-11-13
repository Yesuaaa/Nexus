import type { Account } from "../../auth/model/types.ts"
import type { WorkspaceModuleId } from "../../workspaces/model/route-policy.ts"

export type MessagesView = "unified" | "service" | "project" | "internal"

export function getMessagesView(
  account: Pick<Account, "role" | "headOf">,
  moduleId: WorkspaceModuleId | null,
  selection: { internal?: boolean; project?: boolean; service?: boolean } = {},
): MessagesView {
  if (account.role === "USER") return "unified"
  if (selection.internal) return "internal"
  if (selection.project) return "project"
  if (selection.service) return "service"
  if (
    moduleId === "service-operations" &&
    account.role === "STAFF" &&
    account.headOf
  )
    return "service"
  if (moduleId === "project-management" && account.role === "STAFF")
    return "project"
  if (moduleId) return "internal"
  if (account.role === "STAFF") return account.headOf ? "service" : "project"
  return "internal"
}

export function messagesViewHref(view: MessagesView): string {
  if (view === "unified") return "/messages"
  return view === "internal"
    ? "/messages?mode=internal"
    : `/messages?scope=${view}`
}
