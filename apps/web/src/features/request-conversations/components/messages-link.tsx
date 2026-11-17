"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { MessageSquare } from "lucide-react"
import { iconButtonClass } from "@/components/layout/styles"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import { useWorkspaceModuleId } from "@/features/workspaces/providers/workspace-provider"
import {
  getMessagesView,
  messagesViewHref,
  type MessagesView,
} from "../model/messages-view"
import { listConversations } from "../api/request-conversations-api"
import { listInternalConversations } from "../api/internal-conversations-api"
import { listProjectConversations } from "../api/project-conversations-api"
import {
  unreadMessagesEvent,
  type UnreadMessagesUpdate,
} from "../model/unread-messages"

function AccountMessagesLink({
  internal,
  projects,
  view,
}: {
  internal: boolean
  projects: boolean
  view: MessagesView
}) {
  const pathname = usePathname()
  // The open inbox already refreshes its active list and publishes its count.
  const inboxKind = pathname === "/messages" ? view : null
  const [counts, setCounts] = useState({
    requests: 0,
    internal: 0,
    projects: 0,
  })

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    function update(event: Event) {
      const { kind, count } = (event as CustomEvent<UnreadMessagesUpdate>)
        .detail
      if (kind === "internal" && !internal) return
      if (kind === "projects" && !projects) return
      setCounts((previous) => ({ ...previous, [kind]: count }))
    }
    async function refresh() {
      if (loading || controller.signal.aborted) return
      loading = true
      // Keep the last known count when one source is temporarily unavailable.
      await Promise.allSettled([
        ...(inboxKind !== "service" && inboxKind !== "unified"
          ? [listConversations(undefined, controller.signal)]
          : []),
        ...(internal && inboxKind !== "internal"
          ? [listInternalConversations(undefined, controller.signal)]
          : []),
        ...(projects && inboxKind !== "project" && inboxKind !== "unified"
          ? [listProjectConversations("active", undefined, controller.signal)]
          : []),
      ])
      loading = false
    }
    window.addEventListener(unreadMessagesEvent, update)
    void refresh()
    const stopRefresh = watchVisibleRefresh(() => void refresh(), {
      intervalMs: 30_000,
    })
    return () => {
      controller.abort()
      stopRefresh()
      window.removeEventListener(unreadMessagesEvent, update)
    }
  }, [internal, projects, inboxKind])

  const unreadCount =
    counts.requests +
    (internal ? counts.internal : 0) +
    (projects ? counts.projects : 0)
  return (
    <Link
      href={messagesViewHref(view)}
      aria-label={`Messages${unreadCount ? `, ${unreadCount} unread` : ""}`}
      aria-current={pathname === "/messages" ? "page" : undefined}
      className={`${iconButtonClass} relative ${pathname === "/messages" ? "bg-[#e9eef5] text-[#203a78]" : ""}`}
    >
      <MessageSquare size={21} strokeWidth={1.7} aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-[#203f8c] px-1 text-[9px] text-white"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  )
}

export function MessagesLink() {
  const account = usePortalAccount()
  const moduleId = useWorkspaceModuleId()
  const pathname = usePathname()
  const params = useSearchParams()
  const view = getMessagesView(
    account,
    moduleId,
    pathname === "/messages"
      ? {
          internal: params.get("mode") === "internal" || params.has("internal"),
          project:
            params.get("mode") === "projects" ||
            params.has("project") ||
            (params.get("scope") === "project" && !params.has("request")),
          service: params.has("request") || params.get("scope") === "service",
        }
      : {},
  )
  return (
    <AccountMessagesLink
      key={account.id}
      internal={account.role !== "USER"}
      projects={account.role === "USER" || account.role === "STAFF"}
      view={view}
    />
  )
}
