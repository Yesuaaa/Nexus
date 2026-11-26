"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useAsyncResource } from "@/lib/use-async-resource"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import { listConversations } from "../api/request-conversations-api"
import { listProjectConversations } from "../api/project-conversations-api"

function useConversationLists(accountId: string, enabled: boolean) {
  return useAsyncResource(
    async (signal) => {
      // A discarded effect should not start either list request.
      await Promise.resolve()
      signal.throwIfAborted()
      const [requests, projects] = await Promise.all([
        listConversations(undefined, signal),
        listProjectConversations("active", undefined, signal),
      ])
      if (
        !Array.isArray(requests?.conversations) ||
        !Array.isArray(projects?.conversations)
      )
        throw new Error("Unexpected conversation data")
      return {
        requests: requests.conversations,
        projects: projects.conversations,
      }
    },
    [accountId],
    { enabled },
  )
}

const DashboardConversations = createContext<ReturnType<
  typeof useConversationLists
> | null>(null)

export function DashboardConversationsProvider({
  accountId,
  canUseClientChat,
  children,
}: {
  accountId: string
  canUseClientChat: boolean
  children: ReactNode
}) {
  const enabled = usePathname() === "/dashboard" && canUseClientChat
  const resource = useConversationLists(accountId, enabled)
  const { retry, loading } = resource
  useEffect(() => {
    if (!enabled) return
    return watchVisibleRefresh(
      () => {
        if (!loading) retry()
      },
      { intervalMs: 30_000 },
    )
  }, [enabled, loading, retry])
  return (
    <DashboardConversations.Provider value={enabled ? resource : null}>
      {children}
    </DashboardConversations.Provider>
  )
}

export function useDashboardConversations() {
  return useContext(DashboardConversations)
}
