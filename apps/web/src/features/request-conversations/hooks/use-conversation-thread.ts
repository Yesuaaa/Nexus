"use client"

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type UIEvent,
} from "react"
import { sileo } from "@/lib/toast"
import { ApiError } from "@/features/auth/api/auth-api"
import { errorMessage } from "@/lib/error-message"
import type { RequestMessage } from "../api/request-conversations-api"
import { mergeMessages } from "../model/conversation-events"

/** The fields every conversation history response shares. */
export type ConversationThreadHistory = {
  canSend: boolean
  messages: RequestMessage[]
  nextCursor: string | null
}

type ReadResult = { unreadCount: number; conversationUnreadCount: number }

/** 401/403/404: the account can no longer see this conversation. */
export function isLostConversationAccess(reason: unknown): reason is ApiError {
  return reason instanceof ApiError && [401, 403, 404].includes(reason.status)
}

/**
 * Message thread state shared by request, internal and project chats:
 * history, the composer draft, "load earlier messages" (cursor pagination),
 * sending with a retry-safe idempotency key, and marking the latest message
 * read. The caller owns loading/refreshing the latest page (polling or live
 * events) through `setHistory`, `setError` and `revision`.
 */
export function useConversationThread<H extends ConversationThreadHistory>({
  loadOlderPage,
  send,
  readConversationId,
  markRead,
  onConversationRead,
  onSent,
  onAccessLost,
}: {
  /** Loads the page of messages before `cursor`. */
  loadOlderPage: (cursor: string) => Promise<H>
  /** Sends a message; `idempotencyKey` stays the same while retrying a draft. */
  send: (
    body: string,
    idempotencyKey: string,
    history: H,
  ) => Promise<RequestMessage>
  /**
   * Conversation to mark read when a new latest message arrives, or null to
   * skip (e.g. the viewer isn't a participant). Must be pure.
   */
  readConversationId: (history: H) => string | null
  markRead: (conversationId: string) => Promise<ReadResult>
  onConversationRead?: (
    conversationId: string,
    unreadCount: number,
    conversationUnreadCount: number,
  ) => void
  /** Runs after a message is sent and added to the thread. */
  onSent?: (message: RequestMessage, history: H) => void
  /** Runs after a send or older-page request shows access was lost. */
  onAccessLost?: (message: string) => void
}) {
  const [history, setHistory] = useState<H | null>(null)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [olderLoading, setOlderLoading] = useState(false)
  const pending = useRef<{ body: string; id: string } | null>(null)
  const sendingRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const followLatestRef = useRef(true)
  const lastMarkedReadMessage = useRef<string | null>(null)

  useEffect(() => {
    if (error)
      sileo.error({ title: "Couldn't load messages", description: error })
  }, [error])

  const latestMessageId = history?.messages.at(-1)?.id
  const readId = history ? readConversationId(history) : null
  const requestMarkRead = useEffectEvent((conversationId: string) =>
    markRead(conversationId),
  )
  const reportRead = useEffectEvent(
    (conversationId: string, result: ReadResult) =>
      onConversationRead?.(
        conversationId,
        result.unreadCount,
        result.conversationUnreadCount,
      ),
  )
  useEffect(() => {
    if (
      !readId ||
      !latestMessageId ||
      lastMarkedReadMessage.current === latestMessageId
    )
      return
    lastMarkedReadMessage.current = latestMessageId
    let active = true
    void requestMarkRead(readId)
      .then((result) => {
        if (active) reportRead(readId, result)
      })
      .catch(() => {
        if (active) lastMarkedReadMessage.current = null
      })
    return () => {
      active = false
    }
  }, [readId, latestMessageId])

  const reload = useCallback(() => setRevision((value) => value + 1), [])

  function closeThread(reason: ApiError) {
    setHistory(null)
    onAccessLost?.(reason.message)
  }

  async function loadOlder() {
    if (!history?.nextCursor || olderLoading) return
    setOlderLoading(true)
    try {
      const result = await loadOlderPage(history.nextCursor)
      followLatestRef.current = false
      setHistory((previous) =>
        previous
          ? {
              ...previous,
              nextCursor: result.nextCursor,
              messages: mergeMessages(result.messages, previous.messages),
            }
          : previous,
      )
      setError("")
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't load earlier messages."))
      if (isLostConversationAccess(reason)) closeThread(reason)
    } finally {
      setOlderLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !history?.canSend || sendingRef.current) return
    const thread = history
    if (pending.current?.body !== body)
      pending.current = { body, id: crypto.randomUUID() }
    sendingRef.current = true
    setSending(true)
    setSendError("")
    try {
      const message = await send(body, pending.current.id, thread)
      followLatestRef.current = true
      setHistory((previous) =>
        previous
          ? {
              ...previous,
              messages: mergeMessages(previous.messages, [message]),
            }
          : previous,
      )
      setDraft("")
      onSent?.(message, thread)
      pending.current = null
    } catch (reason) {
      const message = errorMessage(
        reason,
        "Couldn't send your message. Try again.",
      )
      setSendError(message)
      sileo.error({ title: "Message not sent", description: message })
      if (isLostConversationAccess(reason)) closeThread(reason)
      if (reason instanceof ApiError && reason.status === 409) reload()
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  /** Keep following new messages only while the log is scrolled to the end. */
  function onLogScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget
    followLatestRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 70
  }

  return {
    history,
    setHistory,
    error,
    setError,
    /** Increments on `reload`; include it in the history-loading effect. */
    revision,
    reload,
    draft,
    setDraft,
    sending,
    sendError,
    olderLoading,
    loadOlder,
    submit,
    logRef,
    followLatestRef,
    onLogScroll,
  }
}
