"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  listProjectConversations,
  type ProjectConversationList,
} from "../api/project-conversations-api"
import type { RequestMessage } from "../api/request-conversations-api"
import { orderConversations } from "../model/conversation-groups"

async function loadPages(
  view: "active" | "archived",
  count: number,
  signal?: AbortSignal,
) {
  const result = await listProjectConversations(view, undefined, signal)
  for (let page = 1; page < count && result.nextCursor; page++) {
    const extra = await listProjectConversations(
      view,
      result.nextCursor,
      signal,
    )
    result.conversations.push(...extra.conversations)
    result.nextCursor = extra.nextCursor
  }
  result.conversations = [
    ...new Map(result.conversations.map((chat) => [chat.id, chat])).values(),
  ]
  return result
}

export function useProjectConversations(
  enabled: boolean,
  view: "active" | "archived",
) {
  const [state, setState] = useState<{
    view: typeof view
    result: ProjectConversationList | null
    error: string
  }>({ view, result: null, error: "" })
  const [loadingMore, setLoadingMore] = useState(false)
  const pages = useRef(1)
  const version = useRef(0)
  const activeSignal = useRef<AbortSignal | null>(null)
  const result = state.view === view ? state.result : null
  const error = state.view === view ? state.error : ""

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    activeSignal.current = controller.signal
    pages.current = 1
    const refresh = () => {
      if (controller.signal.aborted || document.visibilityState !== "visible")
        return
      const currentVersion = ++version.current
      void loadPages(view, pages.current, controller.signal)
        .then((next) => {
          if (controller.signal.aborted || currentVersion !== version.current)
            return
          setState({ view, result: next, error: "" })
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || currentVersion !== version.current)
            return
          setState((previous) => ({
            view,
            result: previous.view === view ? previous.result : null,
            error:
              reason instanceof Error
                ? reason.message
                : "Couldn't load project conversations.",
          }))
        })
    }
    refresh()
    const timer = window.setInterval(refresh, 15_000)
    window.addEventListener("focus", refresh)
    window.addEventListener("online", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("online", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [enabled, view])

  async function loadMore() {
    if (!enabled || !result?.nextCursor || loadingMore) return
    const signal = activeSignal.current
    if (!signal || signal.aborted) return
    const currentVersion = ++version.current
    setLoadingMore(true)
    try {
      const next = await listProjectConversations(
        view,
        result.nextCursor,
        signal,
      )
      if (signal.aborted || currentVersion !== version.current) return
      pages.current++
      setState((previous) =>
        previous.view !== view
          ? previous
          : {
              view,
              error: "",
              result: {
                ...next,
                conversations: orderConversations([
                  ...new Map(
                    [
                      ...(previous.result?.conversations ?? []),
                      ...next.conversations,
                    ].map((chat) => [chat.id, chat]),
                  ).values(),
                ]),
              },
            },
      )
    } catch (reason) {
      if (!signal.aborted && currentVersion === version.current)
        setState((previous) => ({
          ...previous,
          error:
            reason instanceof Error
              ? reason.message
              : "Couldn't load more conversations.",
        }))
    } finally {
      setLoadingMore(false)
    }
  }

  const onRead = useCallback(
    (id: string, unreadCount: number, conversationUnreadCount: number) => {
      setState((previous) =>
        !previous.result
          ? previous
          : {
              ...previous,
              result: {
                ...previous.result,
                unreadCount,
                conversations: previous.result.conversations.map((chat) =>
                  chat.id === id
                    ? { ...chat, unreadCount: conversationUnreadCount }
                    : chat,
                ),
              },
            },
      )
    },
    [],
  )

  const onMessage = useCallback((id: string, message: RequestMessage) => {
    setState((previous) =>
      !previous.result
        ? previous
        : {
            ...previous,
            result: {
              ...previous.result,
              conversations: orderConversations(
                previous.result.conversations.map((chat) =>
                  chat.id === id
                    ? {
                        ...chat,
                        lastMessage: message,
                        updatedAt:
                          message.createdAt > chat.updatedAt
                            ? message.createdAt
                            : chat.updatedAt,
                      }
                    : chat,
                ),
              ),
            },
          },
    )
  }, [])

  return {
    result,
    error,
    loading: enabled && !result && !error,
    loadingMore,
    loadMore,
    onRead,
    onMessage,
  }
}
