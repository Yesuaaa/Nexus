"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, Paperclip, Send } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import { WorkflowEventCard } from "@/features/request-workflow/components/workflow-cards"
import { WorkflowContextPanel } from "@/features/request-workflow/components/workflow-context-panel"
import {
  WorkflowBadge,
  WorkflowProgress,
} from "@/features/request-workflow/components/workflow-primitives"
import { ConversationAvatar } from "./conversation-avatar"
import {
  getConversation,
  openConversationEvents,
  sendMessage,
  type ConversationHistory,
  type RequestMessage,
} from "../api/request-conversations-api"
import {
  mergeMessages,
  readConversationEvents,
} from "../model/conversation-events"

type RequestConversationProps = {
  requestId: string
  clientName?: string
  requestTitle?: string
  onLatestMessage?: (requestId: string, message: RequestMessage) => void
}

export function RequestConversation(props: RequestConversationProps) {
  return <ConversationPanel key={props.requestId} {...props} />
}

function ConversationPanel({
  requestId,
  clientName,
  requestTitle,
  onLatestMessage,
}: RequestConversationProps) {
  const account = usePortalAccount()
  const inputId = useId()
  const [history, setHistory] = useState<ConversationHistory | null>(null)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [sendError, setSendError] = useState("")
  const pending = useRef<{ body: string; id: string } | null>(null)
  const sendingRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const controls = useRequestWorkflow(requestId)
  const {
    workflow,
    refresh: refreshWorkflow,
    revoke: revokeWorkflow,
  } = controls
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    let queued = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let wakeRetry: (() => void) | undefined
    function revoke(message: string) {
      setHistory(null)
      setError(message)
      revokeWorkflow(message)
      controller.abort()
    }
    async function refresh() {
      if (controller.signal.aborted) return
      if (loading) {
        queued = true
        return
      }
      loading = true
      try {
        const result = await getConversation(
          requestId,
          undefined,
          controller.signal,
        )
        if (controller.signal.aborted) return
        setHistory((previous) => {
          const overlaps = result.messages.some((row) =>
            previous?.messages.some((old) => old.id === row.id),
          )
          return {
            ...result,
            messages: overlaps
              ? mergeMessages(previous?.messages ?? [], result.messages)
              : result.messages,
            nextCursor: overlaps ? previous!.nextCursor : result.nextCursor,
          }
        })
        setError("")
        const latest = result.messages.at(-1)
        if (latest) onLatestMessage?.(requestId, latest)
      } catch (reason) {
        if (controller.signal.aborted) return
        const message =
          reason instanceof Error ? reason.message : "Couldn't load messages."
        if (
          reason instanceof ApiError &&
          [401, 403, 404].includes(reason.status)
        )
          revoke(message)
        else setError(message)
      } finally {
        loading = false
        if (queued) {
          queued = false
          void refresh()
        }
      }
    }
    async function connect() {
      let attempts = 0
      while (!controller.signal.aborted) {
        try {
          const response = await openConversationEvents(
            requestId,
            controller.signal,
          )
          if (
            !response.body ||
            !response.headers.get("content-type")?.includes("text/event-stream")
          )
            throw new Error("Live messaging could not connect.")
          await readConversationEvents(response.body, (event) => {
            if (controller.signal.aborted) return
            if (event === "connected") {
              attempts = 0
            }
            if (event === "messages-changed") {
              void refresh()
              void refreshWorkflow(controller.signal)
            }
            if (event === "access-revoked")
              revoke("You no longer have access to this conversation.")
          })
        } catch (reason) {
          if (controller.signal.aborted) return
          if (
            reason instanceof ApiError &&
            [401, 403, 404].includes(reason.status)
          ) {
            revoke(reason.message)
            return
          }
        }
        if (controller.signal.aborted) return
        await new Promise<void>((resolve) => {
          wakeRetry = resolve
          retryTimer = setTimeout(
            resolve,
            Math.min(1000 * 2 ** attempts++, 15_000),
          )
        })
      }
    }
    void refresh()
    void connect()
    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 15_000)
    return () => {
      controller.abort()
      clearTimeout(retryTimer)
      wakeRetry?.()
      clearInterval(fallback)
    }
  }, [requestId, revision, onLatestMessage, refreshWorkflow, revokeWorkflow])

  useEffect(() => {
    if (followLatest.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight
  }, [history?.messages, workflow?.events])

  async function loadOlder() {
    if (!history?.nextCursor || olderLoading) return
    setOlderLoading(true)
    try {
      const result = await getConversation(requestId, history.nextCursor)
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
      if (
        reason instanceof ApiError &&
        [401, 403, 404].includes(reason.status)
      ) {
        setHistory(null)
        revokeWorkflow(reason.message)
      }
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
      const message = await sendMessage(requestId, body, pending.current.id)
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
      onLatestMessage?.(requestId, message)
      pending.current = null
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't send your message. Try again."
      setSendError(message)
      sileo.error({ title: "Message not sent", description: message })
      if (
        reason instanceof ApiError &&
        [401, 403, 404].includes(reason.status)
      ) {
        setHistory(null)
        revokeWorkflow(reason.message)
      }
      if (reason instanceof ApiError && reason.status === 409)
        setRevision((value) => value + 1)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const participantName =
    account.role === "USER"
      ? history?.conversation?.head?.fullName ||
        history?.conversation?.department.name ||
        "Department head"
      : clientName || "Client"

  const timeline = [
    ...(history?.messages.map((message) => ({
      kind: "message" as const,
      id: message.id,
      createdAt: message.createdAt,
      message,
    })) || []),
    ...(workflow?.events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      createdAt: event.createdAt,
      event,
    })) || []),
  ].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
  const canAttach = Boolean(
    workflow &&
    !["PENDING_REVIEW", "ON_HOLD", "DECLINED", "CANCELLED"].includes(
      workflow.state,
    ),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {workflow && (
        <div className="shrink-0 border-b border-[#e8ebef] px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="m-0 truncate text-sm font-semibold text-[#182235]">
                {workflow.request.serviceName}
              </h1>
              <p className="mt-1 mb-0 truncate text-[10px] text-[#8791a2]">
                {workflow.request.referenceNumber || workflow.request.id}
              </p>
            </div>
            <WorkflowBadge value={workflow.state} />
          </div>
        </div>
      )}
      {workflow && <WorkflowProgress workflow={workflow} />}
      {controls.error && (
        <p
          role="alert"
          className="m-0 shrink-0 border-b border-red-100 bg-red-50 px-5 py-2 text-[11px] text-red-700"
        >
          Workflow: {controls.error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col-reverse">
        <section
          aria-label="Request conversation"
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
        >
          <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#efefee] px-6 py-3 max-[767px]:gap-2 max-[767px]:px-4">
            <Link
              href="/messages"
              aria-label="All conversations"
              className={cn(
                "hidden size-8 shrink-0 items-center justify-center rounded-full text-[#52627a] hover:bg-[#f1f1ee] max-[767px]:flex",
                focusRing,
              )}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
            <ConversationAvatar name={participantName} className="size-8" />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 truncate text-xs font-semibold text-[#182235]">
                {participantName}
              </h2>
              <p
                className="mt-0.5 mb-0 truncate text-[11px] text-[#8791a2]"
                title={requestTitle}
              >
                {requestTitle ||
                  history?.conversation?.department.name ||
                  "Request conversation"}
              </p>
            </div>
          </header>
          {error && (
            <p role="alert" className="m-3 text-xs text-red-700">
              {error}
            </p>
          )}
          {!history ? (
            <p className="p-4 text-xs text-[#52627a]">
              {error
                ? "Refresh to try loading this conversation again."
                : "Loading messages…"}
            </p>
          ) : !history.conversation ? (
            <p className="p-4 text-xs leading-5 text-[#52627a]">
              Messaging opens when a department head accepts your request. You
              can return to this page to read and send messages.
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
                aria-label="Conversation messages"
                aria-live="polite"
                aria-relevant="additions"
                tabIndex={0}
                onScroll={(event) => {
                  const node = event.currentTarget
                  followLatest.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 70
                }}
                className="min-h-0 flex-1 overflow-y-auto px-7 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[767px]:px-4"
              >
                {!timeline.length && (
                  <p className="my-3 text-center text-xs text-[#52627a]">
                    No messages yet. Start the conversation below.
                  </p>
                )}
                {timeline.map((entry, index) => {
                  if (entry.kind === "event")
                    return workflow ? (
                      <div
                        id={
                          entry.event.entityId &&
                          workflow.events
                            .filter(
                              (item) => item.entityId === entry.event.entityId,
                            )
                            .at(-1)?.id === entry.event.id
                            ? `workflow-${entry.event.entityId}`
                            : undefined
                        }
                        key={`event-${entry.id}`}
                        className="scroll-mt-4"
                      >
                        <WorkflowEventCard
                          event={entry.event}
                          workflow={workflow}
                          controls={controls}
                        />
                      </div>
                    ) : null
                  const message = entry.message
                  const own = message.sender.id === account.id
                  const previousEntry = timeline[index - 1]
                  const previous =
                    previousEntry?.kind === "message"
                      ? previousEntry.message
                      : undefined
                  const date = new Date(message.createdAt)
                  const newDay =
                    !previous ||
                    date.toDateString() !==
                      new Date(previous.createdAt).toDateString()
                  const grouped =
                    !newDay && previous?.sender.id === message.sender.id
                  return (
                    <div key={message.id}>
                      {newDay && (
                        <p className="mt-0 mb-5 text-center text-[10px] text-[#8791a2]">
                          {date.toLocaleDateString("en-PH", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      <article
                        className={cn(
                          "w-fit max-w-[85%] pb-1 max-[767px]:max-w-[92%]",
                          grouped ? "mt-1" : "mt-4",
                          own ? "ml-auto" : "mr-auto",
                        )}
                      >
                        <p className="sr-only">
                          {own
                            ? "You"
                            : message.sender.fullName || "Participant"}
                        </p>
                        <p
                          className={cn(
                            "m-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
                            own
                              ? "rounded-br-md bg-[#203f8c] text-white"
                              : "rounded-bl-md bg-[#f1f1ee] text-[#182235]",
                          )}
                        >
                          {message.body}
                        </p>
                        <time
                          dateTime={message.createdAt}
                          className={cn(
                            "mt-1 block px-1 text-[9px] text-[#8791a2]",
                            own && "text-right",
                          )}
                        >
                          {date.toLocaleTimeString("en-PH", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </article>
                    </div>
                  )
                })}
              </div>
              {!history.canSend && (
                <p className="mx-4 text-xs leading-5 text-[#52627a]">
                  Messaging is paused when this request is closed or has no
                  active department head. Your message history is still
                  available.
                </p>
              )}
              <form
                onSubmit={(event) => void submit(event)}
                className="shrink-0 border-t border-[#efefee] px-5 py-3 max-[767px]:px-3"
              >
                <label htmlFor={inputId} className="sr-only">
                  Message
                </label>
                <div className="flex items-end gap-2 rounded-2xl border border-[#e8e9eb] bg-[#fafaf9] p-2 focus-within:ring-2 focus-within:ring-ring">
                  {workflow && (
                    <>
                      <input
                        ref={fileInput}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.txt"
                        className="sr-only"
                        aria-label="Attach a file"
                        disabled={
                          controls.busy || !history.canSend || !canAttach
                        }
                        onChange={async (event) => {
                          const file = event.currentTarget.files?.[0]
                          if (file && (await controls.attach(file))) {
                            if (fileInput.current) fileInput.current.value = ""
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={
                          controls.busy ? "Uploading attachment" : "Attach file"
                        }
                        className="size-9 shrink-0 p-0 text-[#52627a]"
                        disabled={
                          controls.busy || !history.canSend || !canAttach
                        }
                        onClick={() => fileInput.current?.click()}
                      >
                        <Paperclip size={16} aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  <textarea
                    id={inputId}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={4000}
                    rows={2}
                    disabled={sending || !history.canSend}
                    placeholder="Write a message about this request…"
                    className="block min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1 text-xs leading-5 focus-visible:outline-none disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    aria-label={sending ? "Sending…" : "Send message"}
                    className="size-9 shrink-0 rounded-full bg-[#203f8c] p-0 text-white hover:bg-[#172f70]"
                    disabled={!draft.trim() || !history.canSend || sending}
                  >
                    <Send size={15} aria-hidden="true" />
                  </Button>
                </div>
                {sendError && (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {sendError} Your text is saved here so you can retry.
                  </p>
                )}
                <div className="mt-1.5 px-1 text-[9px] text-[#8791a2]">
                  {draft.length}/4000 · Enter for a new line
                  {workflow ? " · Attachments up to 5 MB" : ""}
                </div>
              </form>
            </>
          )}
        </section>
        {workflow && (
          <WorkflowContextPanel workflow={workflow} controls={controls} />
        )}
      </div>
    </div>
  )
}
