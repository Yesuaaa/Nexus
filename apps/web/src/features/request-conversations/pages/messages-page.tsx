"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronLeft,
  LoaderCircle,
  MessageSquare,
} from "lucide-react"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import {
  listConversations,
  type ConversationList,
  type RequestMessage,
} from "../api/request-conversations-api"
import { RequestConversation } from "../components/request-conversation"
import { ConversationAvatar } from "../components/conversation-avatar"

export function MessagesPage({ requestId }: { requestId: string | null }) {
  const account = usePortalAccount()
  const [result, setResult] = useState<ConversationList | null>(null)
  const [error, setError] = useState("")
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [conversationRailCollapsed, setConversationRailCollapsed] =
    useState(false)
  const isClient = account.role === "USER"
  const canCollapseConversations = isClient || account.role === "STAFF"
  const railCollapsed = canCollapseConversations && conversationRailCollapsed

  const updatePreview = useCallback((id: string, message: RequestMessage) => {
    setResult((previous) => {
      const row = previous?.conversations.find((item) => item.id === id)
      if (!previous || !row) return previous
      if (row.lastMessage?.id === message.id)
        return {
          ...previous,
          conversations: previous.conversations.map((item) =>
            item.id === id ? { ...item, lastMessage: message } : item,
          ),
        }
      if (row.lastMessage && message.createdAt < row.lastMessage.createdAt)
        return previous
      return {
        ...previous,
        conversations: [
          { ...row, lastMessage: message, updatedAt: message.createdAt },
          ...previous.conversations.filter((item) => item.id !== id),
        ],
      }
    })
  }, [])

  function messagePreview(message: RequestMessage | null) {
    if (!message) return "Start the conversation"
    if (message.deletedAt) return "This message was deleted"
    return message.body || "Start the conversation"
  }

  const refreshConversations = useCallback(async (signal?: AbortSignal) => {
    try {
      const value = await listConversations(undefined, signal)
      if (signal?.aborted) return
      setResult((previous) => {
        if (!previous) return value
        const refreshedIds = new Set(
          value.conversations.map((conversation) => conversation.id),
        )
        return {
          ...value,
          conversations: [
            ...value.conversations,
            ...previous.conversations.filter(
              (conversation) => !refreshedIds.has(conversation.id),
            ),
          ],
          nextCursor: previous.nextCursor ?? value.nextCursor,
          unreadCount:
            value.unreadCount ??
            (value.conversations.length === 0
              ? 0
              : (previous.unreadCount ?? 0)),
        }
      })
      setError("")
    } catch (reason: unknown) {
      if (signal?.aborted) return
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load conversations.",
      )
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const initialRefresh = window.setTimeout(
      () => void refreshConversations(controller.signal),
      0,
    )
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refreshConversations(controller.signal)
    }, 30_000)
    return () => {
      clearTimeout(initialRefresh)
      controller.abort()
      clearInterval(timer)
    }
  }, [refreshConversations])

  const updateUnreadCounts = useCallback(
    (id: string, unreadCount: number, conversationUnreadCount: number) => {
      setResult((previous) =>
        previous
          ? {
              ...previous,
              unreadCount,
              conversations: previous.conversations.map((conversation) =>
                conversation.id === id
                  ? { ...conversation, unreadCount: conversationUnreadCount }
                  : conversation,
              ),
            }
          : previous,
      )
    },
    [],
  )

  async function loadMore() {
    if (!result?.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await listConversations(result.nextCursor)
      setResult((previous) =>
        previous
          ? {
              conversations: [
                ...previous.conversations,
                ...next.conversations.filter(
                  (row) =>
                    !previous.conversations.some((old) => old.id === row.id),
                ),
              ],
              nextCursor: next.nextCursor,
              unreadCount: next.unreadCount ?? previous.unreadCount ?? 0,
            }
          : previous,
      )
      setError("")
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load more conversations.",
      )
    } finally {
      setLoadingMore(false)
    }
  }

  const selected = result?.conversations.find((row) => row.id === requestId)
  return (
    <main
      aria-label="Messages"
      className={cn(
        contentClass,
        "grid h-[calc(100dvh-116px)] min-h-[480px] overflow-hidden rounded-[20px] transition-[grid-template-columns] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none max-[767px]:h-[calc(100dvh-98px)] max-[767px]:min-h-[420px] max-[767px]:grid-cols-1",
        railCollapsed
          ? "grid-cols-[76px_minmax(0,1fr)]"
          : "grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <nav
        aria-label="Conversations"
        className={cn(
          "flex min-h-0 flex-col border-r border-[#efefee] max-[767px]:border-r-0",
          requestId && "max-[767px]:hidden",
        )}
      >
        <header
          className={cn(
            "flex h-[68px] shrink-0 items-center gap-2 transition-[padding] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            railCollapsed ? "justify-end px-4" : "px-5",
            "max-[767px]:justify-between max-[767px]:px-5",
          )}
        >
          <h1
            className={cn(
              "m-0 mr-auto min-w-0 flex-none overflow-hidden text-sm font-semibold whitespace-nowrap transition-[max-width,opacity,transform] duration-[160ms] ease-out motion-reduce:transition-none",
              railCollapsed
                ? "max-w-0 translate-x-1 opacity-0 max-[767px]:max-w-24 max-[767px]:translate-x-0 max-[767px]:opacity-100"
                : "max-w-24 opacity-100",
            )}
          >
            Messages
          </h1>
          {Boolean(result?.unreadCount) && (
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${result?.unreadCount} unread messages`}
              className={cn(
                "grid max-w-10 min-w-5 place-items-center overflow-hidden rounded-full bg-[#294a9b] px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white transition-[max-width,min-width,opacity,transform,padding] duration-[160ms] ease-out motion-reduce:transition-none",
                railCollapsed &&
                  "max-w-0 min-w-0 scale-95 px-0 py-0 opacity-0 max-[767px]:max-w-10 max-[767px]:min-w-5 max-[767px]:scale-100 max-[767px]:px-1.5 max-[767px]:py-0.5 max-[767px]:opacity-100",
              )}
            >
              {result!.unreadCount! > 99 ? "99+" : result!.unreadCount}
            </span>
          )}
          {canCollapseConversations && (
            <Button
              type="button"
              variant="outline"
              aria-label={
                railCollapsed
                  ? "Expand conversations"
                  : "Collapse conversations"
              }
              aria-expanded={!railCollapsed}
              aria-controls="conversation-list"
              title={
                railCollapsed
                  ? "Expand conversations"
                  : "Collapse conversations"
              }
              className="size-11 shrink-0 p-0 text-[#52627a] max-[767px]:hidden"
              onClick={() =>
                setConversationRailCollapsed((collapsed) => !collapsed)
              }
            >
              <ChevronLeft
                size={17}
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-[180ms] ease-out motion-reduce:transition-none",
                  railCollapsed && "rotate-180",
                )}
              />
            </Button>
          )}
        </header>
        <div
          id="conversation-list"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        >
          {loading && (
            <p
              role="status"
              className={cn(
                "p-5 text-xs text-[#52627a]",
                railCollapsed && "px-0 text-center",
                "max-[767px]:px-5 max-[767px]:text-left",
              )}
            >
              {railCollapsed ? (
                <>
                  <LoaderCircle
                    size={18}
                    aria-hidden="true"
                    className="mx-auto animate-spin motion-reduce:animate-none max-[767px]:hidden"
                  />
                  <span className="sr-only max-[767px]:not-sr-only">
                    Loading conversations…
                  </span>
                </>
              ) : (
                "Loading conversations…"
              )}
            </p>
          )}
          {error && (
            <p
              role="alert"
              title={railCollapsed ? error : undefined}
              className={cn(
                "px-5 text-xs text-red-700",
                railCollapsed && "px-1 text-center",
                "max-[767px]:px-5 max-[767px]:text-left",
              )}
            >
              {railCollapsed ? (
                <>
                  <span aria-hidden="true" className="text-base font-bold">
                    !
                  </span>
                  <span className="sr-only max-[767px]:not-sr-only">
                    {error}
                  </span>
                </>
              ) : (
                error
              )}
            </p>
          )}
          {!loading && !error && !result?.conversations.length && (
            <div
              className={cn(
                "py-10 text-center text-[#52627a]",
                railCollapsed ? "px-1" : "px-5",
                "max-[767px]:px-5",
              )}
            >
              <MessageSquare
                size={railCollapsed ? 22 : 28}
                aria-hidden="true"
                className="mx-auto mb-3"
              />
              <h2
                className={cn(
                  "text-sm font-semibold text-foreground",
                  railCollapsed && "hidden max-[767px]:block",
                )}
              >
                No conversations yet
              </h2>
              <p
                className={cn(
                  "text-xs leading-6",
                  railCollapsed && "hidden max-[767px]:block",
                )}
              >
                Conversations appear here when a department head accepts a
                service request.
              </p>
            </div>
          )}
          {!loading &&
            result?.conversations.map((row) => {
              const name =
                account.role === "USER"
                  ? row.acceptedDepartment?.name || "Department"
                  : row.client.fullName || "Client"
              return (
                <Link
                  key={row.id}
                  href={`/messages?request=${encodeURIComponent(row.id)}`}
                  aria-current={requestId === row.id ? "page" : undefined}
                  aria-label={`${name}: ${row.title}. ${row.unreadCount ? `${row.unreadCount} unread messages. ` : ""}${messagePreview(row.lastMessage)}`}
                  title={railCollapsed ? name : undefined}
                  className={cn(
                    "mb-1 flex items-center rounded-2xl px-3 py-3 no-underline transition-[gap,background-color] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#f7f7f5] motion-reduce:transition-none",
                    focusRing,
                    railCollapsed ? "gap-0 max-[767px]:gap-3" : "gap-3",
                    requestId === row.id && "bg-[#f1f1ee]",
                  )}
                >
                  <span className="relative grid size-9 shrink-0 place-items-center">
                    <ConversationAvatar
                      name={name}
                      className={
                        requestId === row.id
                          ? "ring-1 ring-[#294a9b] ring-offset-2 ring-offset-[#f1f1ee]"
                          : undefined
                      }
                    />
                    {Boolean(row.unreadCount) && railCollapsed && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-[#203f8c] px-1 text-[9px] leading-4 text-white"
                      >
                        {row.unreadCount! > 99 ? "99+" : row.unreadCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-[160ms] ease-out motion-reduce:transition-none",
                      railCollapsed
                        ? "pointer-events-none max-w-0 translate-x-1 opacity-0 max-[767px]:pointer-events-auto max-[767px]:max-w-none max-[767px]:translate-x-0 max-[767px]:opacity-100"
                        : "max-w-[184px] opacity-100",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-[#182235]">
                        {name}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <time
                          dateTime={row.lastMessage?.createdAt || row.updatedAt}
                          className="text-[10px] text-[#8791a2]"
                        >
                          {new Date(
                            row.lastMessage?.createdAt || row.updatedAt,
                          ).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                        {Boolean(row.unreadCount) && !railCollapsed && (
                          <span className="grid min-w-4 place-items-center rounded-full bg-[#203f8c] px-1 text-[9px] leading-4 text-white">
                            {row.unreadCount! > 99 ? "99+" : row.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-[#52627a]">
                      {row.title}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-[#8791a2]">
                      {messagePreview(row.lastMessage)}
                    </span>
                  </span>
                </Link>
              )
            })}
          {!loading && result?.nextCursor && (
            <Button
              variant="outline"
              aria-label={
                railCollapsed
                  ? loadingMore
                    ? "Loading more conversations"
                    : "Load more conversations"
                  : undefined
              }
              className={cn(
                "m-4 text-xs",
                railCollapsed && "mx-auto flex size-11 items-center p-0",
              )}
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {railCollapsed ? (
                loadingMore ? (
                  <LoaderCircle
                    size={16}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <>
                    <ChevronDown size={16} aria-hidden="true" />
                    <span className="sr-only">Load more conversations</span>
                  </>
                )
              ) : loadingMore ? (
                "Loading…"
              ) : (
                "Load more conversations"
              )}
            </Button>
          )}
        </div>
      </nav>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          !requestId && "max-[767px]:hidden",
        )}
      >
        {requestId ? (
          <RequestConversation
            requestId={requestId}
            clientName={selected?.client.fullName || undefined}
            requestTitle={selected?.title}
            onLatestMessage={updatePreview}
            onConversationRead={updateUnreadCounts}
          />
        ) : (
          <div className="grid flex-1 place-content-center px-6 text-center text-[#52627a]">
            <MessageSquare
              size={36}
              aria-hidden="true"
              className="mx-auto mb-3"
            />
            <h2 className="text-base font-semibold text-foreground">
              Select a conversation
            </h2>
            <p className="text-xs leading-6">
              Choose a service request to read and send messages.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
