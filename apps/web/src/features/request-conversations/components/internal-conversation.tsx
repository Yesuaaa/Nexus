"use client"

import { Form } from "@/components/ui/form"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Info } from "lucide-react"
import { sileo } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { WorkflowContextPanel } from "@/features/request-workflow/components/workflow-context-panel"
import {
  ConversationSurface,
  ConversationHeader,
  ConversationMessage,
  ConversationBubble,
  ConversationComposer,
} from "./conversation-ui"
import { ProjectConversationContext } from "./project-conversation-context"
import { ProjectConversationTools } from "./project-conversation-tools"
import { ProjectDeliverableMessage } from "./project-deliverable-message"
import {
  getInternalConversation,
  markInternalConversationRead,
  sendInternalMessage,
  type InternalConversationHistory,
} from "../api/internal-conversations-api"
import type { RequestMessage } from "../api/request-conversations-api"

type InternalConversationProps = {
  conversationId: string
  listHref?: string
  participantName?: string
  kind?: "internal" | "project"
  transport?: {
    getHistory: typeof getInternalConversation
    markRead: typeof markInternalConversationRead
    sendMessage: typeof sendInternalMessage
  }
  onLatestMessage?: (id: string, message: RequestMessage) => void
  onConversationRead?: (
    id: string,
    unreadCount: number,
    conversationUnreadCount: number,
  ) => void
}

const contextPanelStorageKey = "nexus.messages.context-panel-open"

function mergeMessages(current: RequestMessage[], incoming: RequestMessage[]) {
  return [
    ...new Map(
      [...current, ...incoming].map((message) => [message.id, message]),
    ).values(),
  ].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
}

export function InternalConversation(props: InternalConversationProps) {
  return <InternalConversationPanel key={props.conversationId} {...props} />
}

function InternalConversationPanel({
  conversationId,
  listHref = "/messages?mode=internal",
  participantName,
  onLatestMessage,
  onConversationRead,
  kind = "internal",
  transport,
}: InternalConversationProps) {
  const getHistory = transport?.getHistory ?? getInternalConversation
  const markRead = transport?.markRead ?? markInternalConversationRead
  const sendMessage = transport?.sendMessage ?? sendInternalMessage
  const conversationLabel =
    kind === "project" ? "Project conversation" : "Internal conversation"
  const { formatDate } = useDatePreferences()

  const account = usePortalAccount()
  const [history, setHistory] = useState<InternalConversationHistory | null>(
    null,
  )
  const [error, setError] = useState("")
  useEffect(() => {
    if (error)
      sileo.error({ title: "Couldn't load messages", description: error })
  }, [error])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [sendError, setSendError] = useState("")
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return window.sessionStorage.getItem(contextPanelStorageKey) !== "false"
    } catch {
      return true
    }
  })
  const [revision, setRevision] = useState(0)
  const pending = useRef<{ body: string; id: string } | null>(null)
  const sendingRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const lastMarkedReadMessage = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function refresh() {
      try {
        const result = await getHistory(
          conversationId,
          undefined,
          controller.signal,
        )
        if (active) {
          setHistory((previous) =>
            previous && previous.messages.length > result.messages.length
              ? {
                  ...result,
                  messages: mergeMessages(previous.messages, result.messages),
                  nextCursor: previous.nextCursor,
                }
              : result,
          )
          setError("")
          const latest = result.messages.at(-1)
          if (latest) onLatestMessage?.(conversationId, latest)
        }
      } catch (reason) {
        if (active && !controller.signal.aborted) {
          setHistory(null)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load this internal conversation.",
          )
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 15_000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [conversationId, revision, getHistory, onLatestMessage])

  useEffect(() => {
    if (followLatest.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight
  }, [history?.messages])

  const latestMessageId = history?.messages.at(-1)?.id
  useEffect(() => {
    if (!latestMessageId || lastMarkedReadMessage.current === latestMessageId)
      return
    lastMarkedReadMessage.current = latestMessageId
    let active = true
    void markRead(conversationId)
      .then((result) => {
        if (active)
          onConversationRead?.(
            conversationId,
            result.unreadCount,
            result.conversationUnreadCount,
          )
      })
      .catch(() => {
        if (active) lastMarkedReadMessage.current = null
      })
    return () => {
      active = false
    }
  }, [conversationId, latestMessageId, onConversationRead, markRead])

  async function loadOlder() {
    if (!history?.nextCursor || olderLoading) return
    setOlderLoading(true)
    try {
      const result = await getHistory(conversationId, history.nextCursor)
      followLatest.current = false
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
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load earlier messages.",
      )
    } finally {
      setOlderLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !history?.canSend || sendingRef.current) return
    if (pending.current?.body !== body)
      pending.current = { body, id: crypto.randomUUID() }
    sendingRef.current = true
    setSending(true)
    setSendError("")
    try {
      const message = await sendMessage(
        conversationId,
        body,
        pending.current.id,
      )
      followLatest.current = true
      setHistory((previous) =>
        previous
          ? {
              ...previous,
              messages: mergeMessages(previous.messages, [message]),
            }
          : previous,
      )
      setDraft("")
      onLatestMessage?.(conversationId, message)
      pending.current = null
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't send your message. Try again."
      setSendError(message)
      sileo.error({ title: "Message not sent", description: message })
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status))
        setHistory(null)
      if (reason instanceof ApiError && reason.status === 409)
        setRevision((value) => value + 1)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  function setContextPanel(open: boolean) {
    setContextPanelOpen(open)
    try {
      window.sessionStorage.setItem(contextPanelStorageKey, String(open))
    } catch {
      // Keep the control functional when storage is unavailable.
    }
  }

  const name =
    participantName ||
    history?.conversation.fullName?.trim() ||
    (kind === "project" ? "Project team" : "Internal contact")
  const timeline = history?.messages ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col-reverse">
        <ConversationSurface label={conversationLabel}>
          <ConversationHeader
            listHref={listHref}
            backLabel={
              kind === "project"
                ? "All project conversations"
                : "All internal conversations"
            }
            name={name}
            imageUrl={history?.conversation.imageUrl}
            archived={history?.archived}
            subtitle={
              history?.participants
                ? history.participants
                    .map((person) => person.fullName || "Participant")
                    .join(", ")
                : history?.conversation.position ||
                  history?.conversation.department?.name ||
                  (kind === "project" ? "Project chat" : "Internal chat")
            }
            actions={
              kind === "project" &&
              history?.project &&
              history?.participants && (
                <button
                  type="button"
                  aria-label={
                    contextPanelOpen
                      ? "Hide project details"
                      : "Show project details"
                  }
                  aria-expanded={contextPanelOpen}
                  aria-controls={`project-context-${conversationId}`}
                  className={cn(
                    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 transition-colors duration-150",
                    contextPanelOpen
                      ? "text-[#294a9b] hover:text-[#203f8c]"
                      : "text-[#7c8ba5] hover:text-[#294a9b]",
                    focusRing,
                  )}
                  onClick={() => setContextPanel(!contextPanelOpen)}
                >
                  <Info size={17} aria-hidden="true" />
                </button>
              )
            }
          />
          {!history ? (
            <p className="p-4 text-xs text-[#52627a]">
              {error
                ? "Refresh to try loading this conversation again."
                : "Loading messages…"}
            </p>
          ) : (
            <>
              {history.nextCursor && (
                <Button
                  variant="outline"
                  className="mx-4 mt-3 text-xs"
                  onClick={() => void loadOlder()}
                  disabled={olderLoading}
                >
                  {olderLoading ? "Loading…" : "Load earlier messages"}
                </Button>
              )}
              <div
                ref={logRef}
                role="log"
                aria-label={`${conversationLabel} messages`}
                aria-live="polite"
                aria-relevant="additions"
                tabIndex={0}
                onScroll={(event) => {
                  const node = event.currentTarget
                  followLatest.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 70
                }}
                className="min-h-0 flex-1 overflow-y-auto px-7 py-5 focus-visible:outline-none max-[767px]:px-4"
              >
                {!timeline.length && (
                  <p className="my-3 text-center text-xs text-[#52627a]">
                    No messages yet. Start the conversation below.
                  </p>
                )}
                {timeline.map((message, index) => {
                  const own = message.sender.id === account.id
                  const previous = timeline[index - 1]
                  const next = timeline[index + 1]
                  const date = new Date(message.createdAt)
                  const newDay =
                    !previous ||
                    date.toDateString() !==
                      new Date(previous.createdAt).toDateString()
                  const grouped =
                    !newDay && previous?.sender.id === message.sender.id
                  const groupedWithNext = Boolean(
                    next &&
                    date.toDateString() ===
                      new Date(next.createdAt).toDateString() &&
                    next.sender.id === message.sender.id,
                  )
                  return (
                    <div key={message.id}>
                      {newDay && (
                        <p className="mt-0 mb-5 text-center text-[11px] text-[#8791a2]">
                          {formatDate(date)}
                        </p>
                      )}
                      <ConversationMessage
                        own={own}
                        name={message.sender.fullName || "Participant"}
                        imageUrl={
                          history.participants
                            ? null
                            : history.conversation.imageUrl
                        }
                        grouped={grouped}
                        groupedWithNext={groupedWithNext}
                        showSender={Boolean(history.participants)}
                      >
                        {message.deliverable && history.project ? (
                          <ProjectDeliverableMessage
                            message={message}
                            project={history.project}
                            isClient={account.role === "USER"}
                          />
                        ) : (
                          <ConversationBubble own={own} body={message.body} />
                        )}
                      </ConversationMessage>
                    </div>
                  )
                })}
              </div>
              {history.canSend ? (
                <Form
                  aria-label="Send a message"
                  className="shrink-0 border-t border-[#efefee] px-5 py-3 max-[767px]:px-3"
                  onSubmit={(event) => void submit(event)}
                >
                  <ConversationComposer
                    label={`Message ${name}`}
                    draft={draft}
                    onDraftChange={setDraft}
                    sending={sending}
                    canSend={history.canSend}
                    sendError={sendError}
                    tools={
                      kind === "project" ? (
                        <ProjectConversationTools
                          history={history}
                          isClient={account.role === "USER"}
                          onSubmitted={() => setRevision((value) => value + 1)}
                        />
                      ) : undefined
                    }
                  />
                </Form>
              ) : (
                <p className="m-0 shrink-0 border-t border-[#efefee] px-5 py-4 text-xs text-[#52627a]">
                  {history.archived
                    ? "This project is complete or cancelled. The chat is archived and read-only."
                    : "Messaging is unavailable for this account."}
                </p>
              )}
            </>
          )}
        </ConversationSurface>
        {kind === "project" && history?.project && history.participants && (
          <WorkflowContextPanel
            id={`project-context-${conversationId}`}
            hidden={!contextPanelOpen}
            workflow={null}
            hasSelectedBooking={false}
            contextLabel="Project context"
            summaryLabel="Project details"
            className="ml-0 max-[1023px]:mt-0"
            conversationOverview={
              <ProjectConversationContext
                project={history.project}
                participants={history.participants}
                accountId={account.id}
                isClient={account.role === "USER"}
              />
            }
          />
        )}
      </div>
    </div>
  )
}
