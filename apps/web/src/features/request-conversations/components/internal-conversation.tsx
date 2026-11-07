"use client"

import { Form } from "@/components/ui/form"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, LoaderCircle, Send } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"
import { ConversationAvatar } from "./conversation-avatar"
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
  onLatestMessage?: (id: string, message: RequestMessage) => void
  onConversationRead?: (
    id: string,
    unreadCount: number,
    conversationUnreadCount: number,
  ) => void
}

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
}: InternalConversationProps) {
  const { formatDate, formatTime } = useDatePreferences()

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
        const result = await getInternalConversation(
          conversationId,
          undefined,
          controller.signal,
        )
        if (active) {
          setHistory(result)
          setError("")
        }
      } catch (reason) {
        if (active && !controller.signal.aborted) {
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
  }, [conversationId, revision])

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
    void markInternalConversationRead(conversationId)
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
  }, [conversationId, latestMessageId, onConversationRead])

  async function loadOlder() {
    if (!history?.nextCursor || olderLoading) return
    setOlderLoading(true)
    try {
      const result = await getInternalConversation(
        conversationId,
        history.nextCursor,
      )
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
      const message = await sendInternalMessage(
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

  const name =
    participantName ||
    history?.conversation.fullName?.trim() ||
    "Internal contact"
  const timeline = history?.messages ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="m-3 flex min-h-0 flex-1 overflow-hidden rounded-[13px] border border-[#dedede] bg-background shadow-[0_2px_8px_rgb(20_30_50_/_11%)] max-[767px]:m-2">
        <section
          aria-label="Internal conversation"
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
        >
          <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#efefee] bg-background px-6 py-3 max-[767px]:gap-2 max-[767px]:px-4">
            <Link
              href={listHref}
              aria-label="All internal conversations"
              className={cn(
                "hidden size-8 shrink-0 items-center justify-center rounded-full text-[#52627a] hover:bg-[#f1f1ee] max-[767px]:flex",
                focusRing,
              )}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
            <ConversationAvatar
              name={name}
              imageUrl={history?.conversation.imageUrl}
              className="size-8"
            />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 truncate text-sm font-semibold text-[#182235]">
                {name}
              </h2>
              <p className="mt-0.5 mb-0 truncate text-xs text-[#8791a2]">
                {history?.conversation.position ||
                  history?.conversation.department?.name ||
                  "Internal chat"}
              </p>
            </div>
          </header>
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
                aria-label="Internal conversation messages"
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
                      <article
                        className={cn(
                          "flex w-fit max-w-[85%] items-end gap-2 pb-1 max-[767px]:max-w-[92%]",
                          grouped ? "mt-1" : "mt-4",
                          own ? "ml-auto flex-row-reverse" : "mr-auto",
                        )}
                      >
                        {!own && (
                          <ConversationAvatar
                            name={message.sender.fullName || "Participant"}
                            imageUrl={history.conversation.imageUrl}
                            className={cn(
                              "size-7",
                              groupedWithNext && "invisible",
                            )}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="sr-only">
                            {own
                              ? "You"
                              : message.sender.fullName || "Participant"}
                          </p>
                          <div className="relative w-fit max-w-full">
                            <p
                              className={cn(
                                "m-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
                                own
                                  ? "rounded-br-md bg-[#203f8c] text-white"
                                  : "rounded-bl-md bg-[#dfe4eb] text-[#182235]",
                              )}
                            >
                              {message.body}
                            </p>
                            <HoverTooltip>{formatTime(date)}</HoverTooltip>
                          </div>
                        </div>
                      </article>
                    </div>
                  )
                })}
              </div>
              {history.canSend ? (
                <Form
                  className="flex shrink-0 items-end gap-2 border-t border-[#efefee] bg-white px-5 py-4 max-[767px]:px-3"
                  onSubmit={(event) => void submit(event)}
                >
                  <label htmlFor="internal-message-input" className="sr-only">
                    Message {name}
                  </label>
                  <textarea
                    id="internal-message-input"
                    rows={1}
                    maxLength={4000}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" ||
                        event.shiftKey ||
                        event.nativeEvent.isComposing
                      )
                        return
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }}
                    placeholder={`Message ${name}`}
                    className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-[#d8e1ef] bg-white px-3.5 py-3 text-xs leading-5 text-[#182235] outline-none focus-visible:ring-2 focus-visible:ring-[#294a9b]"
                  />
                  <Button
                    type="submit"
                    aria-label="Send message"
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#203f8c] p-0 text-white hover:bg-[#172f70]"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? (
                      <LoaderCircle
                        size={16}
                        aria-hidden="true"
                        className="animate-spin motion-reduce:animate-none"
                      />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                  </Button>
                </Form>
              ) : (
                <p className="m-0 shrink-0 border-t border-[#efefee] px-5 py-4 text-xs text-[#52627a]">
                  Messaging is unavailable for this account.
                </p>
              )}
              {sendError && (
                <p
                  role="status"
                  className="m-0 px-5 pb-3 text-xs text-[#52627a]"
                >
                  Your text is saved here so you can retry.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
