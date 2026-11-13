"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  canAccessRequestInbox,
  canAccessProjectWorkspace,
} from "@/features/auth/model/permissions"
import type { Account } from "@/features/auth/model/types"
import type { WorkspaceModuleId } from "../model/route-policy"
import { resolveWorkspaceModuleId } from "../model/workspace-selection"

const WorkspaceContext = createContext<WorkspaceModuleId | null>(null)

export function WorkspaceProvider({
  account,
  children,
}: {
  account: Account
  children: ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const storageKey = `nexus.workspace.${account.id}`
  const [rememberedModuleId, setRememberedModuleId] = useState<string | null>(
    () => {
      try {
        return window.sessionStorage.getItem(storageKey)
      } catch {
        return null
      }
    },
  )
  const moduleId = resolveWorkspaceModuleId(
    account,
    pathname,
    pathname === "/messages" &&
      (searchParams.get("scope") === "service" ||
        searchParams.has("request")) &&
      searchParams.get("mode") !== "internal" &&
      !searchParams.has("project") &&
      canAccessRequestInbox(account)
      ? "service-operations"
      : pathname === "/messages" &&
          (searchParams.get("mode") === "projects" ||
            searchParams.get("scope") === "project" ||
            searchParams.has("project")) &&
          searchParams.get("mode") !== "internal" &&
          !searchParams.has("request") &&
          canAccessProjectWorkspace(account)
        ? "project-management"
        : rememberedModuleId,
  )

  // Retain the resolved route for the next shared page, including selector resets.
  if (rememberedModuleId !== moduleId) setRememberedModuleId(moduleId)

  useEffect(() => {
    try {
      if (moduleId) window.sessionStorage.setItem(storageKey, moduleId)
      else window.sessionStorage.removeItem(storageKey)
    } catch {
      // Navigation still works in memory when browser storage is unavailable.
    }
  }, [moduleId, storageKey])

  return <WorkspaceContext value={moduleId}>{children}</WorkspaceContext>
}

export function useWorkspaceModuleId() {
  return useContext(WorkspaceContext)
}
