"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ChevronDown,
  List,
  LoaderCircle,
  MessageSquare,
  UsersRound,
} from "lucide-react"
import { sileo } from "@/lib/toast"
import {
  contentClass,
  focusRing,
  iconButtonClass,
} from "@/components/layout/styles"
import { PanelIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import {
  listConversations,
  type ConversationList,
  type RequestMessage,
} from "../api/request-conversations-api"
import { ConversationAvatar } from "../components/conversation-avatar"
import {
  ConversationListItem,
  ProjectConversationListItem,
} from "../components/conversation-list-item"
import { useProjectConversations } from "../hooks/use-project-conversations"
import { projectConversationTransport } from "../api/project-conversations-api"
import {
  createInternalConversation,
  listInternalContacts,
  listInternalConversations,
  type InternalConversationList,
} from "../api/internal-conversations-api"
import { orderConversations } from "../model/conversation-groups"

const conversationRailStorageKey = "nexus.messages.conversation-rail-collapsed"

const RequestConversation = dynamic(
  () =>
    import("../components/request-conversation").then(
      (module) => module.RequestConversation,
    ),
  {
    loading: () => (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading conversation…
      </p>
    ),
  },
)
const InternalConversation = dynamic(
  () =>
    import("../components/internal-conversation").then(
      (module) => module.InternalConversation,
    ),
  {
    loading: () => (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading conversation…
      </p>
    ),
  },
)

type MessagesPageProps = {
  requestId: string | null
  internalId: string | null
  projectId?: string | null
  view?: "active" | "archived"
  mode: "requests" | "internal"
}
export function MessagesPage(props: MessagesPageProps) {
  const mode = props.mode === "internal" ? "internal" : "requests"
  return <ConversationInbox key={mode} {...props} mode={mode} />
}

function ConversationInbox({
  requestId,
  internalId,
  projectId = null,
  view = "active",
  mode,
}: MessagesPageProps) {
  const router = useRouter()
  const account = usePortalAccount()
  const [result, setResult] = useState<ConversationList | null>(null)
  const [internalResult, setInternalResult] =
    useState<InternalConversationList | null>(null)
  const [internalContacts, setInternalContacts] = useState<
    Awaited<ReturnType<typeof listInternalContacts>>
  >([])
  const [error, setError] = useState("")
  const [internalError, setInternalError] = useState("")
  useEffect(() => {
    if (error)
      sileo.error({ title: "Couldn't load conversations", description: error })
  }, [error])
  useEffect(() => {
    if (internalError)
      sileo.error({
        title: "Couldn't load internal chats",
        description: internalError,
      })
  }, [internalError])
  const [loadingMore, setLoadingMore] = useState(false)
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalLoadingMore, setInternalLoadingMore] = useState(false)
  const [creatingInternal, setCreatingInternal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedPages = useRef(1)
  const listVersion = useRef(0)
  const [conversationRailCollapsed, setConversationRailCollapsed] = useState(
    () => {
      if (typeof window === "undefined") return false
      try {
        return (
          window.sessionStorage.getItem(conversationRailStorageKey) === "true"
        )
      } catch {
        return false
      }
    },
  )
  const isClient = account.role === "USER"
  const canUseInternalChat = !isClient
  const canUseProjectChat = isClient || account.role === "STAFF"
  const projectChats = useProjectConversations(
    mode === "requests" && canUseProjectChat,
    view,
  )
  const canCollapseConversations = isClient || account.role === "STAFF"
  const railCollapsed = canCollapseConversations && conversationRailCollapsed

  function setConversationRail(collapsed: boolean) {
    setConversationRailCollapsed(collapsed)
    try {
      window.sessionStorage.setItem(
        conversationRailStorageKey,
        String(collapsed),
      )
    } catch {
      // Keep the control functional when storage is unavailable.
    }
  }

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
        conversations: orderConversations([
          {
            ...row,
            lastMessage: message,
            updatedAt:
              message.createdAt > row.updatedAt
                ? message.createdAt
                : row.updatedAt,
          },
          ...previous.conversations.filter((item) => item.id !== id),
        ]),
      }
    })
  }, [])

  const updateInternalPreview = useCallback(
    (id: string, message: RequestMessage) => {
      setInternalResult((previous) => {
        if (!previous) return previous
        const row = previous.conversations.find((item) => item.id === id)
        if (!row) return previous
        return {
          ...previous,
          conversations: [...previous.conversations]
            .map((item) =>
              item.id === id
                ? {
                    ...item,
                    updatedAt:
                      message.createdAt > item.updatedAt
                        ? message.createdAt
                        : item.updatedAt,
                    lastMessage: message,
                  }
                : item,
            )
            .sort(
              (left, right) =>
                right.updatedAt.localeCompare(left.updatedAt) ||
                right.id.localeCompare(left.id),
            ),
        }
      })
    },
    [],
  )

  const refreshConversations = useCallback(async (signal?: AbortSignal) => {
    const version = ++listVersion.current
    try {
      const value = await listConversations(undefined, signal)
      let nextCursor = value.nextCursor
      for (let page = 1; page < loadedPages.current && nextCursor; page++) {
        const next = await listConversations(nextCursor, signal)
        value.conversations.push(...next.conversations)
        nextCursor = next.nextCursor
      }
      value.nextCursor = nextCursor
      value.conversations = [
        ...new Map(value.conversations.map((row) => [row.id, row])).values(),
      ]
      if (signal?.aborted || version !== listVersion.current) return
      setResult((previous) => {
        if (!previous) return value
        return {
          ...value,
          conversations: orderConversations([
            ...value.conversations.map((row) => {
              const old = previous.conversations.find(
                (item) => item.id === row.id,
              )
              return old && old.updatedAt > row.updatedAt
                ? {
                    ...row,
                    updatedAt: old.updatedAt,
                    lastMessage: old.lastMessage,
                  }
                : row
            }),
          ]),
          unreadCount:
            value.unreadCount ??
            (value.conversations.length === 0
              ? 0
              : (previous.unreadCount ?? 0)),
        }
      })
      setError("")
    } catch (reason: unknown) {
      if (signal?.aborted || version !== listVersion.current) return
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load conversations.",
      )
    } finally {
      if (!signal?.aborted && version === listVersion.current) setLoading(false)
    }
  }, [])

  const refreshInternalConversations = useCallback(
    async (signal?: AbortSignal) => {
      if (!canUseInternalChat) return
      setInternalLoading(true)
      try {
        const [next, contacts] = await Promise.all([
          listInternalConversations(undefined, signal),
          listInternalContacts(signal),
        ])
        if (signal?.aborted) return
        setInternalResult(next)
        setInternalContacts(contacts)
        setInternalError("")
      } catch (reason: unknown) {
        if (signal?.aborted) return
        setInternalError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load internal conversations.",
        )
      } finally {
        if (!signal?.aborted) setInternalLoading(false)
      }
    },
    [canUseInternalChat],
  )

  useEffect(() => {
    const controller = new AbortController()
    const refreshVisible = () => {
      if (document.visibilityState !== "visible" || controller.signal.aborted)
        return
      if (mode === "internal")
        void refreshInternalConversations(controller.signal)
      else void refreshConversations(controller.signal)
    }
    const initialRefresh = window.setTimeout(refreshVisible, 0)
    const timer = setInterval(refreshVisible, 30_000)
    window.addEventListener("focus", refreshVisible)
    window.addEventListener("online", refreshVisible)
    document.addEventListener("visibilitychange", refreshVisible)
    return () => {
      clearTimeout(initialRefresh)
      controller.abort()
      clearInterval(timer)
      window.removeEventListener("focus", refreshVisible)
      window.removeEventListener("online", refreshVisible)
      document.removeEventListener("visibilitychange", refreshVisible)
    }
  }, [mode, refreshConversations, refreshInternalConversations])

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

  const updateInternalUnreadCounts = useCallback(
    (id: string, unreadCount: number, conversationUnreadCount: number) => {
      setInternalResult((previous) =>
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
    const version = ++listVersion.current
    setLoadingMore(true)
    try {
      const next = await listConversations(result.nextCursor)
      if (version !== listVersion.current) return
      loadedPages.current++
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

  async function loadMoreInternal() {
    if (!internalResult?.nextCursor || internalLoadingMore) return
    setInternalLoadingMore(true)
    try {
      const next = await listInternalConversations(internalResult.nextCursor)
      setInternalResult((previous) =>
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
              unreadCount: next.unreadCount,
            }
          : previous,
      )
      setInternalError("")
    } catch (reason) {
      setInternalError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load more internal conversations.",
      )
    } finally {
      setInternalLoadingMore(false)
    }
  }

  async function openInternalChat(recipientId: string) {
    if (creatingInternal) return
    setCreatingInternal(recipientId)
    setInternalError("")
    try {
      const conversation = await createInternalConversation(recipientId)
      setInternalResult((previous) => {
        if (
          !previous ||
          previous.conversations.some((row) => row.id === conversation.id)
        )
          return previous
        return {
          ...previous,
          conversations: [
            {
              id: conversation.id,
              updatedAt: new Date().toISOString(),
              participant: conversation.conversation,
              lastMessage: null,
              unreadCount: 0,
            },
            ...previous.conversations,
          ],
        }
      })
      router.push(
        `/messages?mode=internal&internal=${encodeURIComponent(conversation.id)}`,
        { scroll: false },
      )
    } catch (reason) {
      setInternalError(
        reason instanceof Error
          ? reason.message
          : "Couldn't open that internal conversation.",
      )
    } finally {
      setCreatingInternal(null)
    }
  }

  const selected = result?.conversations.find(
    (row) =>
      row.id === requestId ||
      row.bookings?.some((booking) => booking.id === requestId),
  )
  const selectedInternal = internalResult?.conversations.find(
    (row) => row.id === internalId,
  )
  const hasSelection =
    mode === "internal" ? Boolean(internalId) : Boolean(requestId || projectId)
  const unreadCount =
    mode === "internal"
      ? (internalResult?.unreadCount ?? 0)
      : (result?.unreadCount ?? 0) + (projectChats.result?.unreadCount ?? 0)
  const sharedConversations = orderConversations([
    ...(result?.conversations ?? [])
      .filter(
        (conversation) =>
          (conversation.status === "ARCHIVED") === (view === "archived"),
      )
      .map((conversation) => ({
        kind: "request" as const,
        id: conversation.id,
        updatedAt: conversation.updatedAt,
        conversation,
      })),
    ...(projectChats.result?.conversations ?? []).map((conversation) => ({
      kind: "project" as const,
      id: conversation.id,
      updatedAt: conversation.updatedAt,
      conversation,
    })),
  ])
  const conversationsLoading = loading || projectChats.loading
  const moreConversationsLoading = loadingMore || projectChats.loadingMore
  const nextView = view === "active" ? "archived" : "active"
  return (
    <main
      aria-label="Messages"
      className={cn(
        contentClass,
        "grid h-[calc(100dvh-116px)] min-h-[480px] overflow-hidden rounded-[20px] transition-[grid-template-columns] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none max-[767px]:h-[calc(100dvh-98px)] max-[767px]:min-h-[420px] max-[767px]:grid-cols-1",
        railCollapsed
          ? "grid-cols-[76px_minmax(0,1fr)]"
          : "grid-cols-[clamp(220px,20vw,360px)_minmax(0,1fr)]",
      )}
    >
      <nav
        aria-label="Conversations"
        className={cn(
          "flex min-h-0 flex-col border-r border-[#efefee] max-[767px]:border-r-0",
          hasSelection && "max-[767px]:hidden",
        )}
      >
        <header
          className={cn(
            "flex h-[68px] shrink-0 items-center gap-2 transition-[padding] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            railCollapsed ? "justify-center px-3" : "px-5",
            "max-[767px]:justify-between max-[767px]:px-5",
          )}
        >
          <div
            className={cn(
              "mr-auto flex min-w-0 items-center gap-2",
              railCollapsed
                ? "hidden max-[767px]:flex max-[767px]:max-w-32"
                : "max-w-full",
            )}
          >
            <h1 className="m-0 min-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap">
              Messages
            </h1>
            <span
              aria-label={
                mode === "internal" ? "Internal chats" : "Client chats"
              }
              className="inline-flex shrink-0 items-center rounded-full border border-[#dbe3ef] bg-[#f3f6fb] px-2 py-1 text-[10px] leading-none font-medium text-[#52627a]"
            >
              {mode === "internal" ? "Internal" : "Client"}
            </span>
          </div>
          {mode === "requests" && Boolean(unreadCount) && (
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${unreadCount} unread messages`}
              className={cn(
                "grid max-w-10 min-w-5 place-items-center overflow-hidden rounded-full bg-[#294a9b] px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white transition-[max-width,min-width,opacity,transform,padding] duration-[160ms] ease-out motion-reduce:transition-none",
                railCollapsed && "hidden max-[767px]:grid",
              )}
            >
              {unreadCount! > 99 ? "99+" : unreadCount}
            </span>
          )}
          {canCollapseConversations && (
            <button
              type="button"
              aria-label={
                railCollapsed
                  ? "Expand conversations"
                  : "Collapse conversations"
              }
              aria-expanded={!railCollapsed}
              aria-controls="conversation-list"
              className={cn(iconButtonClass, "shrink-0 max-[767px]:hidden")}
              onClick={() => setConversationRail(!conversationRailCollapsed)}
            >
              <PanelIcon />
            </button>
          )}
        </header>
        <div
          className={cn(
            "mb-3 flex flex-wrap gap-1 px-3",
            railCollapsed &&
              "flex-col items-center max-[767px]:flex-row max-[767px]:items-start",
          )}
        >
          {mode === "requests" && canUseProjectChat && (
            <Button
              type="button"
              variant="outline"
              aria-label={
                nextView === "archived"
                  ? "Archived conversations"
                  : "Active conversations"
              }
              onClick={() =>
                router.push(`/messages?view=${nextView}`, { scroll: false })
              }
              className="size-11 shrink-0 cursor-pointer border-transparent p-0"
            >
              {nextView === "archived" ? (
                <Archive size={16} aria-hidden="true" />
              ) : (
                <List size={16} aria-hidden="true" />
              )}
            </Button>
          )}
          {canUseInternalChat && mode === "internal" && (
            <Button
              asChild
              variant="outline"
              className="size-11 shrink-0 cursor-pointer border-transparent p-0"
            >
              <Link
                href="/messages"
                scroll={false}
                aria-label="Back to client chats"
              >
                <MessageSquare size={16} aria-hidden="true" />
              </Link>
            </Button>
          )}
          {canUseInternalChat && mode === "requests" && (
            <Button
              variant="outline"
              aria-label="Open internal conversations"
              className="size-11 shrink-0 cursor-pointer border-transparent p-0"
              onClick={() =>
                router.push("/messages?mode=internal", { scroll: false })
              }
            >
              <UsersRound size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
        <div
          id="conversation-list"
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3"
        >
          {mode === "requests" && conversationsLoading && (
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
          {mode === "internal" && internalLoading && (
            <p
              role="status"
              className={cn(
                "p-5 text-xs text-[#52627a]",
                railCollapsed && "px-0 text-center",
                "max-[767px]:px-5 max-[767px]:text-left",
              )}
            >
              Loading internal chats…
            </p>
          )}
          {mode === "requests" &&
            !conversationsLoading &&
            !error &&
            !projectChats.error &&
            !sharedConversations.length && (
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
                  {view === "archived"
                    ? "No archived conversations"
                    : "No conversations yet"}
                </h2>
                <p
                  className={cn(
                    "text-xs leading-6",
                    railCollapsed && "hidden max-[767px]:block",
                  )}
                >
                  {view === "archived"
                    ? "Completed project chats will appear here."
                    : "Conversations appear here when a service request is accepted or an assigned project starts."}
                </p>
              </div>
            )}
          {mode === "requests" &&
            sharedConversations.map((entry) =>
              entry.kind === "request" ? (
                <ConversationListItem
                  key={`request:${entry.id}`}
                  conversation={entry.conversation}
                  isClient={isClient}
                  requestId={projectId ? null : requestId}
                  railCollapsed={railCollapsed}
                />
              ) : (
                <ProjectConversationListItem
                  key={`project:${entry.id}`}
                  conversation={entry.conversation}
                  accountId={account.id}
                  projectId={projectId}
                  view={view}
                  railCollapsed={railCollapsed}
                />
              ),
            )}
          {mode === "requests" && projectChats.error && (
            <p role="alert" className="p-3 text-xs text-rose-700">
              {projectChats.error}
            </p>
          )}
          {mode === "requests" &&
            !conversationsLoading &&
            (result?.nextCursor || projectChats.result?.nextCursor) && (
              <Button
                variant="outline"
                aria-label={
                  railCollapsed
                    ? moreConversationsLoading
                      ? "Loading more conversations"
                      : "Load more conversations"
                    : undefined
                }
                className={cn(
                  "m-4 text-xs",
                  railCollapsed && "mx-auto flex size-11 items-center p-0",
                )}
                disabled={moreConversationsLoading}
                onClick={() => {
                  void loadMore()
                  void projectChats.loadMore()
                }}
              >
                {railCollapsed ? (
                  moreConversationsLoading ? (
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
                ) : moreConversationsLoading ? (
                  "Loading…"
                ) : (
                  "Load more conversations"
                )}
              </Button>
            )}
          {mode === "internal" && !internalLoading && !internalError && (
            <>
              <div
                className={cn(
                  "px-2 pb-2",
                  railCollapsed && "px-0 max-[767px]:px-2",
                )}
              >
                <p
                  className={cn(
                    "px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-[#8791a2] uppercase",
                    railCollapsed && "hidden max-[767px]:block",
                  )}
                >
                  Internal chats
                </p>
                {internalResult?.conversations.map((conversation) => {
                  const selected = internalId === conversation.id
                  const name =
                    conversation.participant.fullName?.trim() ||
                    conversation.participant.email
                  return (
                    <Link
                      key={conversation.id}
                      href={`/messages?mode=internal&internal=${encodeURIComponent(conversation.id)}`}
                      scroll={false}
                      aria-current={selected ? "page" : undefined}
                      aria-label={`${name}${conversation.unreadCount ? `, ${conversation.unreadCount} unread messages` : ""}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 no-underline transition-colors",
                        focusRing,
                        selected
                          ? "bg-[#203f8c] text-white"
                          : "text-[#182235] hover:bg-[#e9eef5] hover:text-[#203a78]",
                        railCollapsed &&
                          "relative mx-auto h-14 w-full max-w-14 justify-center gap-0 px-0 max-[767px]:h-auto max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-3 max-[767px]:px-3",
                      )}
                    >
                      <ConversationAvatar
                        name={name}
                        imageUrl={conversation.participant.imageUrl}
                        className="size-9 shrink-0"
                      />
                      {railCollapsed && Boolean(conversation.unreadCount) && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-[#203f8c] text-[10px] leading-none text-white max-[767px]:hidden"
                        >
                          {conversation.unreadCount > 99
                            ? "99+"
                            : conversation.unreadCount}
                        </span>
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          railCollapsed && "hidden max-[767px]:block",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                            {name}
                          </span>
                          {Boolean(conversation.unreadCount) && (
                            <span
                              className={cn(
                                "grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-[10px] leading-none",
                                selected
                                  ? "bg-white text-[#203f8c]"
                                  : "bg-[#203f8c] text-white",
                              )}
                            >
                              {conversation.unreadCount > 99
                                ? "99+"
                                : conversation.unreadCount}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            selected ? "text-white/70" : "text-[#8791a2]",
                          )}
                        >
                          {conversation.participant.position ||
                            conversation.participant.department?.name ||
                            "Staff and admin chat"}
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div
                className={cn(
                  "border-t border-[#efefee] px-2 pt-2",
                  railCollapsed && "px-0 max-[767px]:px-2",
                )}
              >
                <p
                  className={cn(
                    "px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-[#8791a2] uppercase",
                    railCollapsed && "hidden max-[767px]:block",
                  )}
                >
                  Start a chat
                </p>
                {internalContacts.map((contact) => {
                  const existing = internalResult?.conversations.some(
                    (conversation) =>
                      conversation.participant.id === contact.id,
                  )
                  if (existing) return null
                  const name = contact.fullName?.trim() || contact.email
                  const description =
                    creatingInternal === contact.id
                      ? "Opening chat…"
                      : contact.position ||
                        contact.department?.name ||
                        "Staff and admin"
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      aria-label={`${name} ${description}`}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#e9eef5]",
                        focusRing,
                        railCollapsed &&
                          "mx-auto h-14 w-full max-w-14 justify-center gap-0 px-0 max-[767px]:h-auto max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-3 max-[767px]:px-3",
                      )}
                      disabled={creatingInternal === contact.id}
                      onClick={() => void openInternalChat(contact.id)}
                    >
                      <ConversationAvatar
                        name={name}
                        imageUrl={contact.imageUrl}
                        className="size-9 shrink-0"
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          railCollapsed && "hidden max-[767px]:block",
                        )}
                      >
                        <span className="block truncate text-xs font-semibold text-[#182235]">
                          {name}
                        </span>
                        <span className="block truncate text-[11px] text-[#8791a2]">
                          {description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {internalResult?.nextCursor && (
                <Button
                  variant="outline"
                  aria-label={
                    internalLoadingMore
                      ? "Loading more chats"
                      : "Load more chats"
                  }
                  className={cn(
                    "m-4 text-xs",
                    railCollapsed &&
                      "mx-auto flex size-11 items-center p-0 max-[767px]:m-4 max-[767px]:h-9 max-[767px]:w-auto max-[767px]:px-4",
                  )}
                  disabled={internalLoadingMore}
                  onClick={() => void loadMoreInternal()}
                >
                  {railCollapsed && (
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="max-[767px]:hidden"
                    />
                  )}
                  <span
                    className={cn(
                      railCollapsed && "sr-only max-[767px]:not-sr-only",
                    )}
                  >
                    {internalLoadingMore ? "Loading…" : "Load more chats"}
                  </span>
                </Button>
              )}
            </>
          )}
        </div>
      </nav>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          !hasSelection && "max-[767px]:hidden",
        )}
      >
        {mode === "requests" && projectId ? (
          <InternalConversation
            conversationId={projectId}
            kind="project"
            transport={projectConversationTransport}
            onLatestMessage={projectChats.onMessage}
            onConversationRead={projectChats.onRead}
            listHref={
              view === "archived" ? "/messages?view=archived" : "/messages"
            }
          />
        ) : mode === "requests" && requestId ? (
          <RequestConversation
            requestId={requestId}
            clientName={selected?.client.fullName || undefined}
            requestTitle={selected?.title}
            onLatestMessage={updatePreview}
            onConversationRead={updateUnreadCounts}
            listHref="/messages"
          />
        ) : mode === "internal" && internalId ? (
          <InternalConversation
            conversationId={internalId}
            participantName={
              selectedInternal?.participant.fullName || undefined
            }
            onLatestMessage={updateInternalPreview}
            onConversationRead={updateInternalUnreadCounts}
            listHref="/messages?mode=internal"
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
              {mode === "internal"
                ? "Choose a staff member or administrator to start a private chat."
                : isClient
                  ? "Choose a conversation to discuss your bookings or projects."
                  : "Choose a client or project team conversation."}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
