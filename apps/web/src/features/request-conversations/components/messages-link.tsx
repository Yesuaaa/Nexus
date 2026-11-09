"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { MessageSquare } from "lucide-react"
import { iconButtonClass } from "@/components/layout/styles"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { listConversations } from "../api/request-conversations-api"
import { listInternalConversations } from "../api/internal-conversations-api"
import {
  unreadMessagesEvent,
  type UnreadMessagesUpdate,
} from "../model/unread-messages"

function AccountMessagesLink({ internal }: { internal: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // The open inbox already refreshes its active list and publishes its count.
  const inboxKind =
    pathname === "/messages"
      ? searchParams.get("mode") === "internal"
        ? "internal"
        : "requests"
      : null
  const [counts, setCounts] = useState({ requests: 0, internal: 0 })

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    function update(event: Event) {
      const { kind, count } = (event as CustomEvent<UnreadMessagesUpdate>)
        .detail
      if (kind === "internal" && !internal) return
      setCounts((previous) => ({ ...previous, [kind]: count }))
    }
    async function refresh() {
      if (loading || controller.signal.aborted) return
      loading = true
      // Keep the last known count when one source is temporarily unavailable.
      await Promise.allSettled([
        ...(inboxKind !== "requests"
          ? [listConversations(undefined, controller.signal)]
          : []),
        ...(internal && inboxKind !== "internal"
          ? [listInternalConversations(undefined, controller.signal)]
          : []),
      ])
      loading = false
    }
    function refreshVisible() {
      if (document.visibilityState === "visible") void refresh()
    }
    window.addEventListener(unreadMessagesEvent, update)
    document.addEventListener("visibilitychange", refreshVisible)
    window.addEventListener("focus", refreshVisible)
    void refresh()
    const timer = window.setInterval(refreshVisible, 30_000)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener(unreadMessagesEvent, update)
      document.removeEventListener("visibilitychange", refreshVisible)
      window.removeEventListener("focus", refreshVisible)
    }
  }, [internal, inboxKind])

  const unreadCount = counts.requests + (internal ? counts.internal : 0)
  return (
    <Link
      href="/messages"
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
  return (
    <AccountMessagesLink key={account.id} internal={account.role !== "USER"} />
  )
}
