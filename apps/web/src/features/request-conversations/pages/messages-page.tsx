"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { MessageSquare } from "lucide-react"
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

  const updatePreview = useCallback((id: string, message: RequestMessage) => {
    setResult((previous) => {
      const row = previous?.conversations.find((item) => item.id === id)
      if (!previous || !row || row.lastMessage?.id === message.id)
        return previous
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

  useEffect(() => {
    const controller = new AbortController()
    listConversations(undefined, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return
        setResult(value)
        setError("")
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load conversations.",
        )
        setResult(null)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

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
        "grid h-[calc(100dvh-116px)] min-h-[480px] grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-[20px] max-[767px]:h-[calc(100dvh-98px)] max-[767px]:min-h-[420px] max-[767px]:grid-cols-1",
      )}
    >
      <nav
        aria-label="Conversations"
        className={cn(
          "flex min-h-0 flex-col border-r border-[#efefee] max-[767px]:border-r-0",
          requestId && "max-[767px]:hidden",
        )}
      >
        <header className="flex h-[68px] shrink-0 items-center gap-2 px-5">
          <h1 className="m-0 flex-1 text-sm font-semibold">Messages</h1>
          {result && (
            <span
              aria-label={`${result.conversations.length}${result.nextCursor ? "+" : ""} conversations`}
              className="grid min-w-5 place-items-center rounded-full bg-[#294a9b] px-1.5 py-0.5 text-[10px] font-semibold text-white"
            >
              {result.conversations.length}
              {result.nextCursor ? "+" : ""}
            </span>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading && (
            <p role="status" className="p-5 text-xs text-[#52627a]">
              Loading conversations…
            </p>
          )}
          {error && (
            <p role="alert" className="px-5 text-xs text-red-700">
              {error}
            </p>
          )}
          {!loading && !error && !result?.conversations.length && (
            <div className="px-5 py-10 text-center text-[#52627a]">
              <MessageSquare
                size={28}
                aria-hidden="true"
                className="mx-auto mb-3"
              />
              <h2 className="text-sm font-semibold text-foreground">
                No conversations yet
              </h2>
              <p className="text-xs leading-6">
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
                  className={cn(
                    "mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 no-underline transition-colors hover:bg-[#f7f7f5]",
                    focusRing,
                    requestId === row.id && "bg-[#f1f1ee]",
                  )}
                >
                  <ConversationAvatar
                    name={name}
                    className={
                      requestId === row.id
                        ? "ring-1 ring-[#294a9b] ring-offset-2 ring-offset-[#f1f1ee]"
                        : undefined
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-[#182235]">
                        {name}
                      </span>
                      <time
                        dateTime={row.lastMessage?.createdAt || row.updatedAt}
                        className="shrink-0 text-[10px] text-[#8791a2]"
                      >
                        {new Date(
                          row.lastMessage?.createdAt || row.updatedAt,
                        ).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-[#52627a]">
                      {row.title}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-[#8791a2]">
                      {row.lastMessage?.body || "Start the conversation"}
                    </span>
                  </span>
                </Link>
              )
            })}
          {!loading && result?.nextCursor && (
            <Button
              variant="outline"
              className="m-4 text-xs"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more conversations"}
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
