"use client"

import {
  useCallback,
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
  Info,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  UserRound,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"
import {
  useRequestWorkflow,
  type WorkflowControls,
} from "@/features/request-workflow/hooks/use-request-workflow"
import { WorkflowEventCard } from "@/features/request-workflow/components/workflow-cards"
import { WorkflowContextPanel } from "@/features/request-workflow/components/workflow-context-panel"
import {
  AttachmentPreview,
  attachmentAccept,
} from "@/features/request-workflow/components/attachment-preview"
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
import { statusText } from "@/features/request-workflow/components/workflow-primitives"
import type { Workflow } from "@/features/request-workflow/model/workflow"
import { ConversationAvatar } from "./conversation-avatar"
import { ConversationTools } from "./conversation-tools"
import { ConversationBookingWorkflow } from "./conversation-booking-workflow"
import {
  ConversationMeetingCard,
  ScheduleConversationMeeting,
} from "./conversation-meetings"
import {
  getConversation,
  markConversationRead,
  openConversationEvents,
  editMessage,
  deleteMessage,
  sendMessage,
  visibleConversationBookings,
  type ConversationHistory,
  type RequestMessage,
  type ConversationMeeting,
} from "../api/request-conversations-api"
import {
  mergeMessages,
  readConversationEvents,
} from "../model/conversation-events"

const contextPanelStorageKey = "nexus.messages.context-panel-open"

function normalizeSpecialistName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

const workflowPositions: Record<Workflow["state"], number> = {
  PENDING_REVIEW: 0,
  CONSULTATION: 0,
  QUOTATION_PENDING: 1,
  REVISION_REQUESTED: 1,
  CLIENT_APPROVAL: 2,
  DECLINED: 2,
  AGREEMENT_PAYMENT_PENDING: 3,
  READY_FOR_ACTIVATION: 4,
  ACTIVE_PROJECT: 5,
  CANCELLED: 0,
  ON_HOLD: 0,
}

function bookingProgress(
  state: Workflow["state"],
  previous: Workflow["state"] | null,
) {
  const effective = state === "ON_HOLD" && previous ? previous : state
  return Math.min(100, Math.max(8, workflowPositions[effective] * 20))
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
  listHref?: string
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
  listHref = "/messages",
}: RequestConversationProps) {
  const account = usePortalAccount()
  const inputId = useId()
  const [history, setHistory] = useState<ConversationHistory | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (error)
      sileo.error({ title: "Couldn't load messages", description: error })
  }, [error])
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
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return window.sessionStorage.getItem(contextPanelStorageKey) !== "false"
    } catch {
      return true
    }
  })
  const [activeWorkflowDraft, setActiveWorkflowDraft] =
    useState<WorkflowDraftAction | null>(null)
  const [schedulingMeeting, setSchedulingMeeting] = useState(false)
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
  const pending = useRef<{
    body: string
    id: string
  } | null>(null)
  const sendingRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const lastMarkedReadMessage = useRef<string | null>(null)
  const followLatest = useRef(true)
  const accessRevoked = useRef(false)
  const [selectedBookingOverride, setSelectedBookingId] = useState<
    string | null
  >(null)
  const [bookingControls, setBookingControls] = useState<
    Record<string, WorkflowControls>
  >({})
  const [workflowRevision, setWorkflowRevision] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const [attachmentDraft, setAttachmentDraft] = useState<File | null>(null)
  const isClient = account.role === "USER"
  const isStaff = account.role === "STAFF"
  const isParticipant = isClient || isStaff
  const conversationBookings = visibleConversationBookings(
    history?.conversation?.bookings,
  )
  const bookingIds = conversationBookings.map((booking) => booking.id)
  const selectedBookingId =
    (selectedBookingOverride && bookingIds.includes(selectedBookingOverride)
      ? selectedBookingOverride
      : null) ??
    (history?.selectedBookingId &&
    bookingIds.includes(history.selectedBookingId)
      ? history.selectedBookingId
      : null) ??
    bookingIds[0] ??
    null
  const controls = useRequestWorkflow(selectedBookingId)
  const { refresh: refreshWorkflow, revoke: revokeWorkflow } = controls
  const workflow =
    controls.workflow?.request.id === selectedBookingId
      ? controls.workflow
      : null
  const refreshWorkflowRef = useRef(refreshWorkflow)
  useEffect(() => {
    refreshWorkflowRef.current = refreshWorkflow
  }, [refreshWorkflow])

  const updateBookingControls = useCallback(
    (id: string, next: WorkflowControls) => {
      setBookingControls((previous) =>
        previous[id] === next ? previous : { ...previous, [id]: next },
      )
    },
    [],
  )
  const currentBookingControls = Object.fromEntries(
    Object.entries(bookingControls).filter(([id]) => bookingIds.includes(id)),
  )
  if (workflow) {
    const cached = currentBookingControls[workflow.request.id]?.workflow
    if (!cached || workflow.version >= cached.version)
      currentBookingControls[workflow.request.id] = controls
  }
  const clientProfile = history?.conversation?.client
  const clientProfileKey = clientProfile
    ? `${requestId}:${clientProfile.id}`
    : null
  const conversationDepartmentId = history?.conversation?.department.id
  const conversationHeadId = history?.conversation?.head?.id
  const conversationHeadName = history?.conversation?.head?.fullName?.trim()
  const conversationSpecialistId = history?.conversation?.head?.specialistId
  const specialistProfileKey =
    isClient &&
    conversationDepartmentId &&
    conversationHeadId &&
    (conversationSpecialistId || conversationHeadName)
      ? JSON.stringify([
          requestId,
          conversationDepartmentId,
          conversationHeadId,
          conversationSpecialistId,
          normalizeSpecialistName(conversationHeadName || ""),
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
      (!conversationSpecialistId && !conversationHeadName) ||
      !specialistProfileKey
    )
      return

    const departmentId = conversationDepartmentId
    const headName = conversationHeadName || ""
    const profileKey = specialistProfileKey
    let active = true
    async function resolveSpecialistProfile() {
      try {
        if (!selectedBookingId) return
        const booking = await getBooking(selectedBookingId)
        const specialists = await listServiceSpecialists(booking.service.id)
        const matches = specialists.filter(
          (specialist) =>
            specialist.department?.id === departmentId &&
            (conversationSpecialistId !== undefined
              ? specialist.id === conversationSpecialistId
              : normalizeSpecialistName(specialist.fullName) ===
                normalizeSpecialistName(headName)),
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
    conversationSpecialistId,
    isClient,
    selectedBookingId,
    specialistProfileKey,
  ])

  useEffect(() => {
    if (accessRevoked.current) return
    const controller = new AbortController()
    let loading = false
    let queued = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let wakeRetry: (() => void) | undefined
    function revoke(message: string) {
      accessRevoked.current = true
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
        if (latest)
          onLatestMessage?.(result.conversation?.id ?? requestId, latest)
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
              void refreshWorkflowRef.current(controller.signal)
              setWorkflowRevision((value) => value + 1)
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
  }, [requestId, revision, onLatestMessage, revokeWorkflow])

  useEffect(() => {
    if (followLatest.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight
  }, [history?.messages, history?.meetings, bookingControls])

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
    const conversationId = history?.conversation?.id ?? requestId
    void markConversationRead(conversationId)
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
  }, [
    conversationReady,
    isParticipant,
    latestMessageId,
    onConversationRead,
    requestId,
    history?.conversation?.id,
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
      pending.current = {
        body,
        id: crypto.randomUUID(),
      }
    sendingRef.current = true
    setSending(true)
    setSendError("")
    try {
      const message = await sendMessage(
        history?.conversation?.id ?? requestId,
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
      onLatestMessage?.(history?.conversation?.id ?? requestId, message)
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
      : history?.conversation?.client?.fullName || clientName || "Client"
  const conversationParticipantImageUrl = isClient
    ? history?.conversation?.head?.imageUrl
    : history?.conversation?.client?.imageUrl

  const timeline = [
    ...(history?.meetings ?? []).map((meeting) => ({
      kind: "meeting" as const,
      id: meeting.id,
      createdAt: meeting.createdAt,
      meeting,
    })),
    ...(history?.messages.map((message) => ({
      kind: "message" as const,
      id: message.id,
      createdAt: message.createdAt,
      message,
    })) || []),
    ...Object.values(currentBookingControls).flatMap((bookingControl) => {
      const bookingWorkflow = bookingControl.workflow
      return bookingWorkflow
        ? bookingWorkflow.events.map((event) => ({
            kind: "event" as const,
            id: event.id,
            createdAt: event.createdAt,
            event,
            workflow: bookingWorkflow,
            controls: bookingControl,
          }))
        : []
    }),
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

  useEffect(
    () => () => {
      if (sectionNavigationTimer.current !== null)
        window.clearTimeout(sectionNavigationTimer.current)
    },
    [],
  )

  function setContextPanel(open: boolean) {
    setContextPanelOpen(open)
    try {
      window.sessionStorage.setItem(contextPanelStorageKey, String(open))
    } catch {
      // Keep the control functional when storage is unavailable.
    }
  }

  function focusWorkflowSection(section: string) {
    if (sectionNavigationTimer.current !== null)
      window.clearTimeout(sectionNavigationTimer.current)
    setContextPanel(true)
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

  function applyMeetingUpdate(meeting: ConversationMeeting) {
    followLatest.current = true
    setHistory((previous) =>
      previous
        ? {
            ...previous,
            meetings: [
              ...(previous.meetings ?? []).filter(
                (item) => item.id !== meeting.id,
              ),
              meeting,
            ],
          }
        : previous,
    )
    setWorkflowRevision((value) => value + 1)
    void refreshWorkflow()
  }

  async function saveEditedMessage(messageId: string) {
    const body = editingMessageBody.trim()
    if (!body) {
      sileo.error({
        title: "Message not saved",
        description: "A message cannot be empty.",
      })
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
      sileo.error({ title: "Message not saved", description: message })
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
      sileo.error({ title: "Message not deleted", description: message })
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
      {bookingIds.map((id) => (
        <ConversationBookingWorkflow
          key={id}
          bookingId={id}
          revision={workflowRevision}
          onChange={updateBookingControls}
        />
      ))}
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col-reverse">
        <div className="m-3 flex min-h-0 flex-1 overflow-hidden rounded-[13px] border border-[#dedede] bg-background shadow-[0_2px_8px_rgb(20_30_50_/_11%)] max-[767px]:m-2">
          <section
            aria-label="Request conversation"
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
          >
            <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#efefee] bg-background px-6 py-3 max-[767px]:gap-2 max-[767px]:px-4">
              <Link
                href={listHref}
                aria-label="All conversations"
                className={cn(
                  "hidden size-8 shrink-0 items-center justify-center rounded-full text-[#52627a] hover:bg-[#f1f1ee] max-[767px]:flex",
                  focusRing,
                )}
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </Link>
              <ConversationAvatar
                name={participantName}
                imageUrl={
                  isClient
                    ? history?.conversation?.head?.imageUrl
                    : history?.conversation?.client?.imageUrl
                }
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <h2 className="m-0 truncate text-sm font-semibold text-[#182235]">
                  {participantName}
                </h2>
                <p className="mt-0.5 mb-0 truncate text-xs text-[#8791a2]">
                  {history?.conversation
                    ? `${history.conversation.department.name} · ${conversationBookings.length} ${conversationBookings.length === 1 ? "booking" : "bookings"}`
                    : requestTitle || "Service conversation"}
                  {requestTitle && <HoverTooltip>{requestTitle}</HoverTooltip>}
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
                      <HoverTooltip>
                        {specialistProfileLoading
                          ? "Loading specialist profile"
                          : specialistProfileTarget
                            ? "View specialist profile"
                            : "Specialist profile unavailable"}
                      </HoverTooltip>
                    </button>
                  )}
                  {isStaff && clientProfile && clientProfileKey && (
                    <button
                      type="button"
                      aria-label={`View ${clientProfile.fullName || "client"}'s profile`}
                      className={cn(
                        "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-[#294a9b] transition-colors duration-150 hover:bg-[#f1f1ee]",
                        focusRing,
                      )}
                      onClick={() => setClientProfileOpenFor(clientProfileKey)}
                    >
                      <UserRound size={16} aria-hidden="true" />
                      <HoverTooltip>View client profile</HoverTooltip>
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
                    className={cn(
                      "grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 transition-colors duration-150",
                      contextPanelOpen
                        ? "text-[#294a9b] hover:text-[#203f8c]"
                        : "text-[#7c8ba5] hover:text-[#294a9b]",
                      "focus-visible:outline-none focus-visible:drop-shadow-[0_0_2px_currentColor] focus-visible:[&>svg]:scale-110",
                    )}
                    onClick={() => setContextPanel(!contextPanelOpen)}
                  >
                    <Info size={17} aria-hidden="true" />
                    <HoverTooltip>
                      {contextPanelOpen
                        ? "Hide service details"
                        : "Show service details"}
                    </HoverTooltip>
                  </button>
                </div>
              )}
            </header>
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
                    const date = new Date(entry.createdAt)
                    const previousEntry = timeline[index - 1]
                    const newDay =
                      !previousEntry ||
                      date.toDateString() !==
                        new Date(previousEntry.createdAt).toDateString()
                    const daySeparator = newDay ? (
                      <p className="mt-3 mb-5 text-center text-[11px] text-[#8791a2]">
                        {date.toLocaleDateString("en-PH", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    ) : null
                    if (entry.kind === "meeting")
                      return (
                        <div
                          key={`meeting-${entry.id}`}
                          id={`meeting-${entry.id}`}
                        >
                          {daySeparator}
                          <ConversationMeetingCard
                            meeting={entry.meeting}
                            conversationId={
                              history.conversation?.id ?? requestId
                            }
                            isManager={
                              isStaff &&
                              history.conversation?.head?.id === account.id
                            }
                            canAct={history.canSend}
                            onSaved={applyMeetingUpdate}
                            onRefresh={() => setRevision((value) => value + 1)}
                          />
                        </div>
                      )
                    if (entry.kind === "event") {
                      const eventWorkflow = entry.workflow
                      const sameBooking =
                        previousEntry?.kind === "event" &&
                        previousEntry.workflow.request.id ===
                          eventWorkflow.request.id
                      return (
                        <div
                          id={
                            entry.event.entityId &&
                            eventWorkflow.events
                              .filter(
                                (item) =>
                                  item.entityId === entry.event.entityId,
                              )
                              .at(-1)?.id === entry.event.id
                              ? `workflow-${entry.event.entityId}`
                              : undefined
                          }
                          key={`event-${entry.id}`}
                          data-booking-event={eventWorkflow.request.id}
                          className="scroll-mt-4"
                        >
                          {daySeparator}
                          {(!sameBooking || newDay) && (
                            <p
                              title={`${eventWorkflow.request.serviceName} · ${eventWorkflow.request.referenceNumber || eventWorkflow.request.id}`}
                              className="mx-1 mt-4 mb-1 max-w-full truncate text-[10px] font-medium text-[#52627a]"
                            >
                              {eventWorkflow.request.serviceName} ·{" "}
                              {eventWorkflow.request.referenceNumber ||
                                eventWorkflow.request.id}
                            </p>
                          )}
                          <WorkflowEventCard
                            onPrepareQuotation={() => {
                              setSelectedBookingId(eventWorkflow.request.id)
                              setActiveWorkflowDraft("quotation")
                            }}
                            event={entry.event}
                            workflow={eventWorkflow}
                            controls={entry.controls}
                            fileClassName={
                              eventWorkflow.files.find(
                                (file) => file.id === entry.event.entityId,
                              )?.uploaderId === account.id
                                ? "ml-auto"
                                : undefined
                            }
                          />
                        </div>
                      )
                    }
                    const message = entry.message
                    const own = message.sender.id === account.id
                    const previous =
                      previousEntry?.kind === "message"
                        ? previousEntry.message
                        : undefined
                    const nextEntry = timeline[index + 1]
                    const deletedAt = message.deletedAt
                      ? new Date(message.deletedAt)
                      : null
                    const grouped =
                      !newDay && previous?.sender.id === message.sender.id
                    const groupedWithNext = Boolean(
                      nextEntry?.kind === "message" &&
                      date.toDateString() ===
                        new Date(nextEntry.createdAt).toDateString() &&
                      nextEntry.message.sender.id === message.sender.id,
                    )
                    const deleted = Boolean(message.deletedAt)
                    const canManageMessage = Boolean(
                      isStaff && history?.canSend && own && !deleted,
                    )
                    const editing = editingMessageId === message.id
                    return (
                      <div key={message.id}>
                        {daySeparator}
                        <article
                          className={cn(
                            "relative flex w-fit max-w-[85%] items-end gap-2 pb-1 max-[767px]:max-w-[92%]",
                            canManageMessage && "pl-11",
                            grouped ? "mt-1" : "mt-4",
                            own ? "ml-auto flex-row-reverse" : "mr-auto",
                          )}
                        >
                          {!own && (
                            <ConversationAvatar
                              name={message.sender.fullName || participantName}
                              imageUrl={conversationParticipantImageUrl}
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
                              <div className="relative w-fit max-w-full">
                                <p
                                  className={cn(
                                    "m-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
                                    deleted
                                      ? "border border-dashed border-[#d8e1ef] bg-[#f6f8fc] text-[#52627a]"
                                      : own
                                        ? "rounded-br-md bg-[#203f8c] text-white"
                                        : "rounded-bl-md bg-[#dfe4eb] text-[#182235]",
                                    deleted && "w-fit max-w-full py-1.5 italic",
                                    deleted && own && "ml-auto",
                                  )}
                                >
                                  {deleted
                                    ? "This message was deleted"
                                    : message.body}
                                </p>
                                <HoverTooltip>
                                  {deleted
                                    ? `Deleted ${deletedAt!.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${deletedAt!.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`
                                    : `${message.editedAt ? "Edited · " : ""}${date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`}
                                </HoverTooltip>
                              </div>
                            )}
                            {deleted ? (
                              <div
                                className={cn(
                                  "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] text-[#8791a2]",
                                  own && "justify-end",
                                )}
                              >
                                <MessageDeletionCountdown
                                  purgeAt={message.purgeAt}
                                />
                              </div>
                            ) : canManageMessage ? (
                              <div className="mt-1 flex items-center gap-1 px-1 text-[11px] text-[#8791a2]">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      aria-label={`Actions for your message at ${date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`}
                                      className="absolute top-0 left-0 size-11 shrink-0 border-0 bg-transparent p-0 text-[#52627a] hover:bg-[#f1f4fa]"
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
                              </div>
                            ) : null}
                          </div>
                        </article>
                      </div>
                    )
                  })}
                </div>
                <div className="relative shrink-0">
                  {workflow && activeWorkflowDraft && (
                    <div className="absolute right-0 bottom-full left-0 z-10">
                      <WorkflowActionDraft
                        key={`${workflow.request.id}:${activeWorkflowDraft}`}
                        action={activeWorkflowDraft}
                        workflow={workflow}
                        controls={controls}
                        onClose={() => setActiveWorkflowDraft(null)}
                      />
                    </div>
                  )}
                  {!history.canSend && (
                    <div className="mx-4 my-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 min-w-0 flex-1 basis-48 text-xs leading-5 text-[#52627a]">
                        Messaging is paused while this conversation has no
                        active department head. Your message history is still
                        available.
                      </p>
                    </div>
                  )}
                  {history.canSend && (
                    <form
                      onSubmit={(event) => void submit(event)}
                      className="border-t border-[#efefee] px-5 py-3 max-[767px]:px-3"
                    >
                      {attachmentDraft && (
                        <div className="mb-3 space-y-2">
                          <AttachmentPreview
                            file={attachmentDraft}
                            disabled={controls.busy}
                            onRemove={() => {
                              setAttachmentDraft(null)
                              if (fileInput.current)
                                fileInput.current.value = ""
                            }}
                          />
                          <Button
                            type="button"
                            className="ml-auto flex bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
                            disabled={controls.busy || !history.canSend}
                            onClick={async () => {
                              if (await controls.attach(attachmentDraft)) {
                                setAttachmentDraft(null)
                                if (fileInput.current)
                                  fileInput.current.value = ""
                              }
                            }}
                          >
                            {controls.busy ? "Sending file…" : "Send file"}
                          </Button>
                        </div>
                      )}
                      <label htmlFor={inputId} className="sr-only">
                        Message
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInput}
                          type="file"
                          accept={attachmentAccept}
                          className="sr-only"
                          aria-label="Attach a file"
                          disabled={
                            controls.busy || !history.canSend || !canAttach
                          }
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0]
                            if (file) setAttachmentDraft(file)
                          }}
                        />
                        <ConversationTools
                          workflow={workflow}
                          bookings={conversationBookings}
                          isClient={isClient}
                          isManager={
                            isStaff &&
                            (history.conversation.head?.id === account.id ||
                              Boolean(workflow?.permissions.manage))
                          }
                          canSend={history.canSend}
                          loading={
                            controls.loading || (!workflow && !controls.error)
                          }
                          busy={controls.busy}
                          error={controls.error}
                          onSelectBooking={(id) => {
                            setSelectedBookingId(id)
                            setActiveWorkflowDraft(null)
                            setAttachmentDraft(null)
                            if (fileInput.current) fileInput.current.value = ""
                          }}
                          onDraft={setActiveWorkflowDraft}
                          onScheduleMeeting={() => setSchedulingMeeting(true)}
                          onSection={focusWorkflowSection}
                          onAttach={() => fileInput.current?.click()}
                          onRetry={() => void refreshWorkflow()}
                        />
                        <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-[#e8e9eb] bg-[#fafaf9] p-2">
                          <textarea
                            ref={messageInputRef}
                            id={inputId}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            maxLength={4000}
                            rows={1}
                            disabled={sending || !history.canSend}
                            placeholder="Write a message…"
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
                        <p
                          role="status"
                          className="mt-2 text-xs text-[#52627a]"
                        >
                          Your text is saved here so you can retry.
                        </p>
                      )}
                      <div className="mt-1.5 px-1 text-[9px] text-[#8791a2]">
                        {draft.length}/4000
                        {workflow ? " · Attachments up to 5 MB" : ""}
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
        {(workflow || (history?.conversation && selectedBookingId)) && (
          <WorkflowContextPanel
            id={`request-context-${requestId}`}
            hidden={isParticipant && !contextPanelOpen}
            workflow={workflow}
            controls={controls}
            conversationOverview={
              history?.conversation ? (
                <>
                  <section className="border-b border-[#e8ebef] py-3">
                    <h3 className="m-0 text-xs font-semibold text-[#182235]">
                      Conversation details
                    </h3>
                    <div className="mt-3 flex items-center gap-3">
                      <ConversationAvatar
                        name={participantName}
                        imageUrl={
                          isClient
                            ? history.conversation.head?.imageUrl
                            : history.conversation.client?.imageUrl
                        }
                        className="size-10"
                      />
                      <div className="min-w-0">
                        <p className="m-0 truncate text-xs font-semibold text-[#182235]">
                          {participantName}
                        </p>
                        <p className="mt-0.5 mb-0 text-[10px] text-[#8791a2]">
                          {isClient ? "Department head" : "Client"}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 mb-0 grid gap-2 text-[11px]">
                      {[
                        [
                          "Client",
                          isClient
                            ? "You"
                            : history.conversation.client?.fullName ||
                              clientName ||
                              "Client",
                        ],
                        ["Department", history.conversation.department.name],
                        [
                          "Status",
                          statusText(history.conversation.status || "ACTIVE"),
                        ],
                        [
                          "Manager",
                          history.conversation.head?.fullName ||
                            "No active manager",
                        ],
                        ["Bookings", String(conversationBookings.length)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-start justify-between gap-3"
                        >
                          <dt className="text-[#8791a2]">{label}</dt>
                          <dd className="m-0 text-right font-medium text-[#182235]">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="border-b border-[#e8ebef] py-3">
                    <h3 className="m-0 text-xs font-semibold text-[#182235]">
                      Booked services
                    </h3>
                    <p className="mt-1 mb-0 text-[10px] leading-4 text-[#52627a]">
                      Use + to choose a tool, then choose the service it applies
                      to.
                    </p>
                    <div className="mt-3 space-y-2">
                      {conversationBookings.map((booking) => {
                        const selected = booking.id === selectedBookingId
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedBookingId(booking.id)
                              setActiveWorkflowDraft(null)
                            }}
                            className={cn(
                              "w-full rounded-xl border p-3 text-left transition-colors",
                              selected
                                ? "border-[#294a9b] bg-[#edf1f8]"
                                : "border-[#e1e6ee] bg-white hover:bg-[#f7f9fc]",
                            )}
                          >
                            <span className="block truncate text-[11px] font-semibold text-[#182235]">
                              {booking.serviceName}
                            </span>
                            <span className="mt-0.5 block truncate text-[9px] text-[#52627a]">
                              {booking.referenceNumber || booking.id}
                            </span>
                            <span className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#52627a]">
                              <span>{statusText(booking.workflowState)}</span>
                              <span>{statusText(booking.status)}</span>
                            </span>
                            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[#dce3ef]">
                              <span
                                className="block h-full rounded-full bg-[#294a9b]"
                                style={{
                                  width: `${bookingProgress(
                                    booking.workflowState,
                                    booking.previousWorkflowState,
                                  )}%`,
                                }}
                              />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                  {/*
                      {workflow.request.serviceName} ·{" "}
                      {workflow.request.referenceNumber || workflow.request.id}
                    </p>
                    */}
                </>
              ) : null
            }
            onViewEvent={(entityId) => {
              const log = logRef.current
              const target = document.getElementById(`workflow-${entityId}`)
              if (!log || !target || !log.contains(target)) return
              followLatest.current = false
              log.scrollTo({
                top:
                  log.scrollTop +
                  target.getBoundingClientRect().top -
                  log.getBoundingClientRect().top -
                  16,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              })
            }}
          />
        )}
      </div>
      {schedulingMeeting &&
        history?.canSend &&
        history.conversation &&
        isStaff &&
        history.conversation.head?.id === account.id && (
          <ScheduleConversationMeeting
            conversationId={history.conversation.id}
            bookings={conversationBookings}
            onClose={() => setSchedulingMeeting(false)}
            onSaved={applyMeetingUpdate}
          />
        )}
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
