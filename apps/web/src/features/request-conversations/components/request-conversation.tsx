"use client"

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  CircleHelp,
  FileText,
  Info,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  StickyNote,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import { WorkflowEventCard } from "@/features/request-workflow/components/workflow-cards"
import { WorkflowContextPanel } from "@/features/request-workflow/components/workflow-context-panel"
import {
  WorkflowActionDraft,
  type WorkflowDraftAction,
} from "@/features/request-workflow/components/workflow-action-draft"
import { getBooking } from "@/features/bookings/api/bookings-api"
import {
  listServiceSpecialists,
  type ServiceSpecialist,
} from "@/features/services/api/services-api"
import { SpecialistProfileDialog } from "@/features/services/components/specialist-profile-dialog"
import { ClientProfileDialog } from "./client-profile-dialog"
import { WorkflowProgress } from "@/features/request-workflow/components/workflow-primitives"
import { ConversationAvatar } from "./conversation-avatar"
import {
  getConversation,
  markConversationRead,
  openConversationEvents,
  editMessage,
  deleteMessage,
  sendMessage,
  type ConversationHistory,
  type RequestMessage,
} from "../api/request-conversations-api"
import {
  mergeMessages,
  readConversationEvents,
} from "../model/conversation-events"

function normalizeSpecialistName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

function MessageDeletionCountdown({ purgeAt }: { purgeAt: string | null }) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!purgeAt) return
    const update = () =>
      setDaysRemaining(
        Math.max(
          0,
          Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86_400_000),
        ),
      )
    update()
    const timer = window.setInterval(update, 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [purgeAt])

  const label =
    daysRemaining === null
      ? "Permanent deletion scheduled"
      : daysRemaining === 0
        ? "Permanent deletion is due"
        : `Permanently deleted in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`

  return <span className="text-[11px] text-[#8791a2]">{label}</span>
}

type RequestConversationProps = {
  requestId: string
  clientName?: string
  requestTitle?: string
  onLatestMessage?: (requestId: string, message: RequestMessage) => void
  onConversationRead?: (
    requestId: string,
    unreadCount: number,
    conversationUnreadCount: number,
  ) => void
}

type SpecialistProfileTarget = {
  serviceId: string
  specialist: ServiceSpecialist
}

type SpecialistProfileResolution = {
  key: string
  target: SpecialistProfileTarget | null
}

export function RequestConversation(props: RequestConversationProps) {
  return <ConversationPanel key={props.requestId} {...props} />
}

function ConversationPanel({
  requestId,
  clientName,
  requestTitle,
  onLatestMessage,
  onConversationRead,
}: RequestConversationProps) {
  const account = usePortalAccount()
  const inputId = useId()
  const [history, setHistory] = useState<ConversationHistory | null>(null)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageBody, setEditingMessageBody] = useState("")
  const [messageActionError, setMessageActionError] = useState("")
  const [messageActionBusy, setMessageActionBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RequestMessage | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [olderLoading, setOlderLoading] = useState(false)
  const [sendError, setSendError] = useState("")
  const [contextPanelOpen, setContextPanelOpen] = useState(true)
  const [activeWorkflowDraft, setActiveWorkflowDraft] =
    useState<WorkflowDraftAction | null>(null)
  const sectionNavigationTimer = useRef<number | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const [specialistProfileOpenFor, setSpecialistProfileOpenFor] = useState<
    string | null
  >(null)
  const [clientProfileOpenFor, setClientProfileOpenFor] = useState<
    string | null
  >(null)
  const [specialistProfileResolution, setSpecialistProfileResolution] =
    useState<SpecialistProfileResolution | null>(null)
  const pending = useRef<{ body: string; id: string } | null>(null)
  const sendingRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const lastMarkedReadMessage = useRef<string | null>(null)
  const followLatest = useRef(true)
  const controls = useRequestWorkflow(requestId)
  const {
    workflow,
    refresh: refreshWorkflow,
    revoke: revokeWorkflow,
  } = controls
  const fileInput = useRef<HTMLInputElement>(null)
  const isClient = account.role === "USER"
  const isStaff = account.role === "STAFF"
  const isParticipant = isClient || isStaff
  const clientProfile = history?.conversation?.client
  const clientProfileKey = clientProfile
    ? `${requestId}:${clientProfile.id}`
    : null
  const conversationDepartmentId = history?.conversation?.department.id
  const conversationHeadId = history?.conversation?.head?.id
  const conversationHeadName = history?.conversation?.head?.fullName?.trim()
  const specialistProfileKey =
    isClient &&
    conversationDepartmentId &&
    conversationHeadId &&
    conversationHeadName
      ? JSON.stringify([
          requestId,
          conversationDepartmentId,
          conversationHeadId,
          normalizeSpecialistName(conversationHeadName),
        ])
      : null
  const specialistProfileTarget =
    specialistProfileResolution?.key === specialistProfileKey
      ? specialistProfileResolution.target
      : null
  const specialistProfileLoading = Boolean(
    specialistProfileKey &&
    specialistProfileResolution?.key !== specialistProfileKey,
  )

  useLayoutEffect(() => {
    const input = messageInputRef.current
    if (!input) return
    input.style.height = "auto"
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`
  }, [draft])

  useEffect(() => {
    if (
      !isClient ||
      !conversationDepartmentId ||
      !conversationHeadId ||
      !conversationHeadName ||
      !specialistProfileKey
    )
      return

    const departmentId = conversationDepartmentId
    const headName = conversationHeadName
    const profileKey = specialistProfileKey
    let active = true
    async function resolveSpecialistProfile() {
      try {
        const booking = await getBooking(requestId)
        const specialists = await listServiceSpecialists(booking.service.id)
        const matches = specialists.filter(
          (specialist) =>
            specialist.department?.id === departmentId &&
            normalizeSpecialistName(specialist.fullName) ===
              normalizeSpecialistName(headName),
        )
        if (active) {
          setSpecialistProfileOpenFor(null)
          setSpecialistProfileResolution({
            key: profileKey,
            target:
              matches.length === 1
                ? { serviceId: booking.service.id, specialist: matches[0] }
                : null,
          })
        }
      } catch {
        if (active) {
          setSpecialistProfileOpenFor(null)
          setSpecialistProfileResolution({
            key: profileKey,
            target: null,
          })
        }
      }
    }
    void resolveSpecialistProfile()
    return () => {
      active = false
    }
  }, [
    conversationDepartmentId,
    conversationHeadId,
    conversationHeadName,
    isClient,
    requestId,
    specialistProfileKey,
  ])

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

  const latestMessageId = history?.messages.at(-1)?.id
  const conversationReady = Boolean(history?.conversation)
  useEffect(() => {
    if (
      !isParticipant ||
      !conversationReady ||
      !latestMessageId ||
      lastMarkedReadMessage.current === latestMessageId
    )
      return

    lastMarkedReadMessage.current = latestMessageId
    let active = true
    void markConversationRead(requestId)
      .then((result) => {
        if (active)
          onConversationRead?.(
            requestId,
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
  }, [
    conversationReady,
    isParticipant,
    latestMessageId,
    onConversationRead,
    requestId,
  ])

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
  const canManageWorkflow = Boolean(!isClient && workflow?.permissions.manage)
  const terminal = Boolean(
    workflow &&
    ["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(workflow.state),
  )
  const canRequestInformation = Boolean(
    canManageWorkflow &&
    workflow &&
    [
      "CONSULTATION",
      "QUOTATION_PENDING",
      "CLIENT_APPROVAL",
      "REVISION_REQUESTED",
      "AGREEMENT_PAYMENT_PENDING",
      "READY_FOR_ACTIVATION",
    ].includes(workflow.state),
  )
  const canScheduleConsultation = Boolean(
    canManageWorkflow && workflow?.state === "CONSULTATION",
  )
  const canContinueToQuotation = canScheduleConsultation
  const canCreateQuotation = Boolean(
    canManageWorkflow &&
    workflow &&
    ["QUOTATION_PENDING", "REVISION_REQUESTED", "CLIENT_APPROVAL"].includes(
      workflow.state,
    ),
  )
  const canAssignApprovers = Boolean(
    canManageWorkflow && workflow?.internal && !terminal,
  )
  const canOpenInternalNotes = Boolean(canManageWorkflow && workflow?.internal)
  const canOpenWorkflowControls = Boolean(
    canManageWorkflow &&
    workflow &&
    !terminal &&
    workflow.state !== "PENDING_REVIEW",
  )

  useEffect(
    () => () => {
      if (sectionNavigationTimer.current !== null)
        window.clearTimeout(sectionNavigationTimer.current)
    },
    [],
  )

  function focusWorkflowSection(section: string) {
    if (sectionNavigationTimer.current !== null)
      window.clearTimeout(sectionNavigationTimer.current)
    setContextPanelOpen(true)
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    sectionNavigationTimer.current = window.setTimeout(
      () => {
        const panelId = `request-context-${requestId}`
        const panel = document.getElementById(panelId)
        const target = document.getElementById(`${panelId}-${section}`)
        if (!panel || !target) return
        let parent: HTMLElement | null = target
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true
          if (parent === panel) break
          parent = parent.parentElement
        }
        target.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
        })
        sectionNavigationTimer.current = null
      },
      contextPanelOpen || reducedMotion ? 0 : 260,
    )
  }

  function applyMessageUpdate(message: RequestMessage) {
    setHistory((previous) =>
      previous
        ? {
            ...previous,
            messages: previous.messages.map((item) =>
              item.id === message.id ? message : item,
            ),
          }
        : previous,
    )
    onLatestMessage?.(requestId, message)
  }

  async function saveEditedMessage(messageId: string) {
    const body = editingMessageBody.trim()
    if (!body) {
      setMessageActionError("A message cannot be empty.")
      return
    }
    setMessageActionBusy(true)
    setMessageActionError("")
    try {
      const message = await editMessage(requestId, messageId, body)
      applyMessageUpdate(message)
      setEditingMessageId(null)
      setEditingMessageBody("")
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Couldn't edit this message."
      setMessageActionError(message)
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
      setMessageActionBusy(false)
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return
    setMessageActionBusy(true)
    setDeleteError("")
    try {
      const message = await deleteMessage(requestId, deleteTarget.id)
      applyMessageUpdate(message)
      setDeleteTarget(null)
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't delete this message."
      setDeleteError(message)
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
      setMessageActionBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col-reverse">
        <div className="m-3 flex min-h-0 flex-1 overflow-hidden rounded-[13px] border border-[#dedede] bg-background shadow-[0_2px_8px_rgb(20_30_50_/_11%)] max-[767px]:m-2">
          <section
            aria-label="Request conversation"
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
          >
            <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#efefee] bg-background px-6 py-3 max-[767px]:gap-2 max-[767px]:px-4">
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
                <h2 className="m-0 truncate text-sm font-semibold text-[#182235]">
                  {participantName}
                </h2>
                <p
                  className="mt-0.5 mb-0 truncate text-xs text-[#8791a2]"
                  title={requestTitle}
                >
                  {requestTitle ||
                    history?.conversation?.department.name ||
                    "Request conversation"}
                </p>
              </div>
              {isParticipant && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {isClient && (
                    <button
                      type="button"
                      aria-label={
                        specialistProfileLoading
                          ? "Loading specialist profile"
                          : specialistProfileTarget
                            ? `View ${specialistProfileTarget.specialist.fullName}'s profile`
                            : "Specialist profile unavailable"
                      }
                      title={
                        specialistProfileLoading
                          ? "Loading specialist profile"
                          : specialistProfileTarget
                            ? "View specialist profile"
                            : "Specialist profile unavailable"
                      }
                      className={cn(
                        "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-[#294a9b] transition-colors duration-150 hover:bg-[#f1f1ee] disabled:cursor-not-allowed disabled:opacity-40",
                        focusRing,
                      )}
                      disabled={
                        !specialistProfileTarget || specialistProfileLoading
                      }
                      onClick={() =>
                        specialistProfileKey &&
                        setSpecialistProfileOpenFor(specialistProfileKey)
                      }
                    >
                      <UserRound size={16} aria-hidden="true" />
                    </button>
                  )}
                  {isStaff && clientProfile && clientProfileKey && (
                    <button
                      type="button"
                      aria-label={`View ${clientProfile.fullName || "client"}'s profile`}
                      title="View client profile"
                      className={cn(
                        "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-[#294a9b] transition-colors duration-150 hover:bg-[#f1f1ee]",
                        focusRing,
                      )}
                      onClick={() => setClientProfileOpenFor(clientProfileKey)}
                    >
                      <UserRound size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={
                      contextPanelOpen
                        ? "Hide service details"
                        : "Show service details"
                    }
                    aria-expanded={contextPanelOpen}
                    aria-controls={`request-context-${requestId}`}
                    title={
                      contextPanelOpen
                        ? "Hide service details"
                        : "Show service details"
                    }
                    className={cn(
                      "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 transition-colors duration-150",
                      contextPanelOpen
                        ? "text-[#294a9b] hover:text-[#203f8c]"
                        : "text-[#7c8ba5] hover:text-[#294a9b]",
                      "focus-visible:outline-none focus-visible:drop-shadow-[0_0_2px_currentColor] focus-visible:[&>svg]:scale-110",
                    )}
                    onClick={() => setContextPanelOpen((open) => !open)}
                  >
                    <Info size={17} aria-hidden="true" />
                  </button>
                </div>
              )}
            </header>
            {workflow && <WorkflowProgress workflow={workflow} />}
            {controls.error && (
              <p
                role="alert"
                className="m-0 shrink-0 border-b border-red-100 bg-red-50 px-5 py-2 text-[11px] text-red-700"
              >
                Workflow: {controls.error}
              </p>
            )}
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
                      node.scrollHeight - node.scrollTop - node.clientHeight <
                      70
                  }}
                  className="min-h-0 flex-1 overflow-y-auto px-7 py-5 focus-visible:outline-none max-[767px]:px-4"
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
                                (item) =>
                                  item.entityId === entry.event.entityId,
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
                            fileClassName={
                              workflow.files.find(
                                (file) => file.id === entry.event.entityId,
                              )?.uploaderId === account.id
                                ? "ml-auto"
                                : undefined
                            }
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
                    const deletedAt = message.deletedAt
                      ? new Date(message.deletedAt)
                      : null
                    const newDay =
                      !previous ||
                      date.toDateString() !==
                        new Date(previous.createdAt).toDateString()
                    const grouped =
                      !newDay && previous?.sender.id === message.sender.id
                    const deleted = Boolean(message.deletedAt)
                    const canManageMessage = Boolean(
                      isStaff && history?.canSend && own && !deleted,
                    )
                    const editing = editingMessageId === message.id
                    return (
                      <div key={message.id}>
                        {newDay && (
                          <p className="mt-0 mb-5 text-center text-[11px] text-[#8791a2]">
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
                          {editing ? (
                            <form
                              className="w-[min(70vw,420px)] max-w-full space-y-2 rounded-xl border border-[#d8e1ef] bg-white p-3 shadow-sm"
                              onSubmit={(event) => {
                                event.preventDefault()
                                void saveEditedMessage(message.id)
                              }}
                            >
                              <label
                                htmlFor={`edit-message-${message.id}`}
                                className="sr-only"
                              >
                                Edit message
                              </label>
                              <textarea
                                id={`edit-message-${message.id}`}
                                autoFocus
                                rows={3}
                                maxLength={4000}
                                value={editingMessageBody}
                                onChange={(event) =>
                                  setEditingMessageBody(event.target.value)
                                }
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
                                className="block min-h-20 w-full resize-y rounded-lg border border-[#d8e1ef] bg-white px-3 py-2 text-xs leading-5 text-[#182235] outline-none focus-visible:ring-2 focus-visible:ring-[#294a9b]"
                              />
                              {messageActionError && (
                                <p
                                  role="alert"
                                  className="m-0 text-xs text-red-700"
                                >
                                  {messageActionError}
                                </p>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 min-w-16 text-xs"
                                  disabled={messageActionBusy}
                                  onClick={() => {
                                    setEditingMessageId(null)
                                    setEditingMessageBody("")
                                    setMessageActionError("")
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  className="h-9 min-w-20 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
                                  disabled={
                                    messageActionBusy ||
                                    !editingMessageBody.trim()
                                  }
                                >
                                  {messageActionBusy ? "Saving…" : "Save"}
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <p
                              className={cn(
                                "m-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
                                deleted
                                  ? "border border-dashed border-[#d8e1ef] bg-[#f6f8fc] text-[#52627a]"
                                  : own
                                    ? "rounded-br-md bg-[#203f8c] text-white"
                                    : "rounded-bl-md bg-[#f1f1ee] text-[#182235]",
                                deleted && "w-fit max-w-full py-1.5 italic",
                                deleted && own && "ml-auto",
                              )}
                            >
                              {deleted
                                ? "This message was deleted"
                                : message.body}
                            </p>
                          )}
                          {deleted ? (
                            <div
                              className={cn(
                                "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] text-[#8791a2]",
                                own && "justify-end",
                              )}
                            >
                              <time dateTime={deletedAt!.toISOString()}>
                                Deleted{" "}
                                {deletedAt!.toLocaleDateString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                })}
                                {", "}
                                {deletedAt!.toLocaleTimeString("en-PH", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </time>
                              <MessageDeletionCountdown
                                purgeAt={message.purgeAt}
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1 px-1 text-[11px] text-[#8791a2]",
                                own && "justify-end",
                              )}
                            >
                              {message.editedAt && (
                                <span className="mr-1">Edited</span>
                              )}
                              <time dateTime={message.createdAt}>
                                {date.toLocaleTimeString("en-PH", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </time>
                              {canManageMessage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      aria-label={`Actions for your message at ${date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`}
                                      className="size-11 shrink-0 border-0 bg-transparent p-0 text-[#52627a] hover:bg-[#f1f4fa]"
                                    >
                                      <MoreHorizontal
                                        size={16}
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    side="top"
                                    align="end"
                                    className="min-w-36 rounded-xl border-[#dce3ee] bg-white p-1.5 text-[#203047] shadow-[0_12px_30px_rgb(18_36_73_/_16%)]"
                                  >
                                    <DropdownMenuItem
                                      className="min-h-10 cursor-pointer gap-2 rounded-md px-2.5 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                      onSelect={() => {
                                        setEditingMessageId(message.id)
                                        setEditingMessageBody(
                                          message.body || "",
                                        )
                                        setMessageActionError("")
                                      }}
                                    >
                                      <Pencil aria-hidden="true" />
                                      Edit message
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="min-h-10 cursor-pointer gap-2 rounded-md px-2.5 text-xs font-medium text-red-700 focus:bg-red-50 focus:text-red-700"
                                      onSelect={() => {
                                        setDeleteTarget(message)
                                        setDeleteError("")
                                      }}
                                    >
                                      <Trash2 aria-hidden="true" />
                                      Delete message
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                        </article>
                      </div>
                    )
                  })}
                </div>
                <div className="relative shrink-0">
                  {workflow && activeWorkflowDraft && (
                    <div className="absolute right-0 bottom-full left-0 z-10">
                      <WorkflowActionDraft
                        key={activeWorkflowDraft}
                        action={activeWorkflowDraft}
                        workflow={workflow}
                        controls={controls}
                        onClose={() => setActiveWorkflowDraft(null)}
                      />
                    </div>
                  )}
                  {!history.canSend && (
                    <p className="mx-4 text-xs leading-5 text-[#52627a]">
                      Messaging is paused when this request is closed or has no
                      active department head. Your message history is still
                      available.
                    </p>
                  )}
                  <form
                    onSubmit={(event) => void submit(event)}
                    className="border-t border-[#efefee] px-5 py-3 max-[767px]:px-3"
                  >
                    <label htmlFor={inputId} className="sr-only">
                      Message
                    </label>
                    <div className="flex items-center gap-2">
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
                                if (fileInput.current)
                                  fileInput.current.value = ""
                              }
                            }}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                aria-label={
                                  isClient
                                    ? "Open attachment options"
                                    : "Open request actions"
                                }
                                className="size-10 shrink-0 rounded-full bg-[#203f8c] p-0 text-white hover:bg-[#172f70]"
                              >
                                <Plus size={16} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              side="top"
                              align="start"
                              sideOffset={8}
                              className="w-[320px] rounded-xl border-[#dce3ee] bg-white p-2 text-[#203047] shadow-[0_12px_30px_rgb(18_36_73_/_16%)]"
                            >
                              {canAttach && history.canSend && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  disabled={controls.busy}
                                  onSelect={() => fileInput.current?.click()}
                                >
                                  <Paperclip aria-hidden="true" />
                                  Attach file
                                </DropdownMenuItem>
                              )}
                              {canRequestInformation && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft(
                                      "request-information",
                                    )
                                  }
                                >
                                  <CircleHelp aria-hidden="true" />
                                  Request information
                                </DropdownMenuItem>
                              )}
                              {canScheduleConsultation && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft(
                                      "schedule-consultation",
                                    )
                                  }
                                >
                                  <CalendarDays aria-hidden="true" />
                                  Schedule consultation
                                </DropdownMenuItem>
                              )}
                              {canContinueToQuotation && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft("quotation")
                                  }
                                >
                                  <FileText aria-hidden="true" />
                                  Continue to quotation
                                </DropdownMenuItem>
                              )}
                              {canCreateQuotation && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft("quotation")
                                  }
                                >
                                  <FileText aria-hidden="true" />
                                  Create quotation
                                </DropdownMenuItem>
                              )}
                              {(canAssignApprovers || canOpenInternalNotes) && (
                                <>
                                  {((canAttach && history.canSend) ||
                                    canRequestInformation ||
                                    canScheduleConsultation ||
                                    canContinueToQuotation ||
                                    canCreateQuotation) && (
                                    <DropdownMenuSeparator className="my-1.5 bg-[#e8ebef]" />
                                  )}
                                  <DropdownMenuLabel className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.08em] text-[#6b7a90] uppercase">
                                    <span>Internal · Department head only</span>
                                    <span className="rounded-full bg-[#edf2fb] px-2 py-0.5 text-[9px] font-medium tracking-normal text-[#294a9b] normal-case">
                                      Staff only
                                    </span>
                                  </DropdownMenuLabel>
                                </>
                              )}
                              {canAssignApprovers && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft(
                                      "approver-assignments",
                                    )
                                  }
                                >
                                  <Users aria-hidden="true" />
                                  Approver assignments
                                </DropdownMenuItem>
                              )}
                              {canOpenInternalNotes && (
                                <DropdownMenuItem
                                  className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                  onSelect={() =>
                                    setActiveWorkflowDraft("internal-note")
                                  }
                                >
                                  <StickyNote aria-hidden="true" />
                                  Internal notes
                                </DropdownMenuItem>
                              )}
                              {canOpenWorkflowControls && (
                                <>
                                  {((canAttach && history.canSend) ||
                                    canRequestInformation ||
                                    canScheduleConsultation ||
                                    canContinueToQuotation ||
                                    canCreateQuotation ||
                                    canAssignApprovers ||
                                    canOpenInternalNotes) && (
                                    <DropdownMenuSeparator className="my-1.5 bg-[#e8ebef]" />
                                  )}
                                  <DropdownMenuItem
                                    className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
                                    onSelect={() =>
                                      focusWorkflowSection("workflow-controls")
                                    }
                                  >
                                    <Settings2 aria-hidden="true" />
                                    Workflow controls
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!(canAttach && history.canSend) &&
                                !canRequestInformation &&
                                !canScheduleConsultation &&
                                !canContinueToQuotation &&
                                !canCreateQuotation &&
                                !canAssignApprovers &&
                                !canOpenInternalNotes &&
                                !canOpenWorkflowControls && (
                                  <DropdownMenuItem
                                    disabled
                                    className="min-h-9 px-2.5 py-2 text-xs text-[#8791a2]"
                                  >
                                    No actions available
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                      <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-[#e8e9eb] bg-[#fafaf9] p-2">
                        <textarea
                          ref={messageInputRef}
                          id={inputId}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          maxLength={4000}
                          rows={1}
                          disabled={sending || !history.canSend}
                          placeholder="Write a message about this request…"
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
                          className="block min-h-9 max-h-32 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-xs leading-5 focus-visible:outline-none disabled:opacity-50"
                        />
                        <Button
                          type="submit"
                          aria-label={sending ? "Sending…" : "Send message"}
                          className="size-9 shrink-0 rounded-full bg-[#203f8c] p-0 text-white hover:bg-[#172f70]"
                          disabled={
                            !draft.trim() || !history.canSend || sending
                          }
                        >
                          <Send
                            size={15}
                            aria-hidden="true"
                            className="translate-x-[-1px] translate-y-[1px]"
                          />
                        </Button>
                      </div>
                    </div>
                    {sendError && (
                      <p role="alert" className="mt-2 text-xs text-red-700">
                        {sendError} Your text is saved here so you can retry.
                      </p>
                    )}
                    <div className="mt-1.5 px-1 text-[9px] text-[#8791a2]">
                      {draft.length}/4000
                      {workflow ? " · Attachments up to 5 MB" : ""}
                    </div>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
        {workflow && (
          <WorkflowContextPanel
            id={`request-context-${requestId}`}
            hidden={isParticipant && !contextPanelOpen}
            workflow={workflow}
            controls={controls}
          />
        )}
      </div>
      {deleteTarget && (
        <ConfirmationDialog
          title="Delete this message?"
          subject="Your message"
          description="Its text will be removed from the conversation immediately. A deletion notice will remain for 30 days before it is permanently removed."
          confirmLabel="Delete message"
          pendingLabel="Deleting…"
          pending={messageActionBusy}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteMessage()}
        />
      )}
      {isClient &&
        specialistProfileOpenFor === specialistProfileKey &&
        specialistProfileTarget && (
          <SpecialistProfileDialog
            key={specialistProfileTarget.specialist.id}
            serviceId={specialistProfileTarget.serviceId}
            specialist={specialistProfileTarget.specialist}
            selected={false}
            allowSelection={false}
            onChoose={() => undefined}
            onClose={() => setSpecialistProfileOpenFor(null)}
          />
        )}
      {isStaff &&
        clientProfileOpenFor === clientProfileKey &&
        clientProfile && (
          <ClientProfileDialog
            key={clientProfile.id}
            client={clientProfile}
            onClose={() => setClientProfileOpenFor(null)}
          />
        )}
    </div>
  )
}
