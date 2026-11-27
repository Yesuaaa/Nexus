"use client"

import { useCurrentTime } from "@/lib/use-current-time"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import { useAsyncResource } from "@/lib/use-async-resource"
import { apiRequest, getToken } from "@/features/auth/api/auth-api"
import { listClientProjects } from "@/features/projects/api/projects-api"
import { listMyServiceRequests } from "@/features/services/api/client-services-api"
import {
  listClientOutstandingActions,
  type ClientOutstandingAction,
} from "@/features/request-workflow/api/workflow-api"
import {
  calendarTimeZone,
  calendarTimeLabel,
  type CalendarEvent,
  type CalendarResponse,
} from "@/features/calendar/model/calendar"
import { useDashboardConversations } from "@/features/request-conversations/hooks/use-dashboard-conversations"
import { ConversationRow } from "@/features/request-conversations/components/conversation-list-item"
import {
  messagePreview,
  orderConversations,
} from "@/features/request-conversations/model/conversation-groups"
import type { RequestMessage } from "@/features/request-conversations/api/request-conversations-api"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Plus,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  projectProgress,
  statusLabel,
  statusTone,
} from "@/features/projects/model/project-status"
import {
  requestDate,
  serviceRequestStatuses,
} from "@/features/services/model/service-request-status"
import { getInitials } from "@/lib/initials"
import { cn } from "@/lib/utils"
import {
  actions as sampleActions,
  appointment as sampleAppointment,
  projects as sampleProjects,
  requests as sampleRequests,
  type PreviewState,
} from "../model/dashboard-preview"

function deadlineTime(value?: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? Date.parse(value)
    : Number.POSITIVE_INFINITY
}

const manilaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: calendarTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
function calendarDaysUntil(target: string, now: number) {
  return Math.round(
    (Date.parse(manilaDay.format(new Date(target))) -
      Date.parse(manilaDay.format(new Date(now)))) /
      86_400_000,
  )
}

function deadlineLabel(days: number) {
  if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`
  if (days === 0) return "Due today"
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`
}

const relativeMessageTime = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
})

function inboxMessagePreview(message: RequestMessage | null) {
  const text =
    message && !message.deletedAt && !message.body && message.deliverable
      ? "Attachment: " + message.deliverable.fileName
      : message && !message.deletedAt && !message.body && message.booking
        ? message.booking.title
        : messagePreview(message)
  return text.length > 160 ? text.slice(0, 157).trimEnd() + "…" : text
}

const textLink = cn(
  "inline-flex min-h-9 items-center gap-1.5 rounded-sm text-xs font-semibold text-[#203f8c] hover:underline focus-visible:underline",
  focusRing,
)
const sectionHeading =
  "flex items-center gap-3 text-sm leading-snug font-semibold"
const dashboardCard = "min-w-0 rounded-xl border border-[#e7e5e4] bg-white p-5"
const dashboardCardHeader =
  "-mx-5 -mt-5 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-5 py-2.5 [&_a]:order-last [&_a]:ml-auto"
const itemTitle =
  "min-w-0 [overflow-wrap:anywhere] text-[13px] leading-snug font-semibold"
const metadata =
  "mt-1 [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground"
// Reject malformed service responses inside the resource hook, before React renders them.
function dashboardRows<T>(
  rows: T[] | undefined,
  valid: (row: T) => boolean,
): T[] {
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row !== "object" || !valid(row))
  )
    throw new Error("Unexpected dashboard data")
  return rows
}

function validDashboardDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function resourceState(
  resource: { loading: boolean; error: string | boolean; data?: unknown },
  hasData: boolean,
): PreviewState {
  return resource.loading && resource.data === undefined
    ? "loading"
    : resource.error
      ? "error"
      : hasData
        ? "loaded"
        : "empty"
}

function SectionContent({
  headingId,
  state,
  empty,
  children,
  retry,
}: {
  retry?: () => void
  headingId: string
  state: PreviewState
  empty: string
  children: ReactNode
}) {
  if (state === "empty") return <EmptyState size="sm" title={empty} />
  if (state === "error")
    return (
      <EmptyState
        size="sm"
        role="alert"
        title={retry ? "Could not load this section" : "Preview unavailable"}
        action={
          retry && (
            <Button
              variant="brandOutline"
              size="sm"
              onClick={() => {
                document.getElementById(headingId)?.focus()
                retry()
              }}
            >
              Try again
            </Button>
          )
        }
        description="This section could not be loaded."
      />
    )
  if (state === "loading") {
    return (
      <div role="status" className="grid gap-3 py-2">
        <span className="sr-only">Loading section…</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  return children
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link className={textLink} href={href} aria-label={label}>
      View all <ChevronRight size={14} aria-hidden="true" />
    </Link>
  )
}

export function DashboardPage({
  preview,
}: {
  preview?: { state: PreviewState; startsAt: string }
}) {
  const account = usePortalAccount()
  const now = useCurrentTime()
  const enabled = account.role === "USER" && !preview
  const projectData = useAsyncResource(
    async (signal) =>
      dashboardRows(
        await listClientProjects(signal),
        (item) =>
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.status === "string",
      ),
    [account.id],
    { enabled },
  )
  const requestData = useAsyncResource(
    async (signal) => {
      const result = await listMyServiceRequests({
        page: 1,
        sortOrder: "desc",
        signal,
      })
      const rows = dashboardRows(
        result?.requests,
        (item) =>
          typeof item.id === "string" && typeof item.status === "string",
      )
      return {
        rows: [...rows].sort((a, b) => {
          const aTime = validDashboardDate(a.createdAt)
            ? Date.parse(a.createdAt)
            : -Infinity
          const bTime = validDashboardDate(b.createdAt)
            ? Date.parse(b.createdAt)
            : -Infinity
          return aTime === bTime ? 0 : bTime - aTime
        }),
        summary: result.summary,
      }
    },
    [account.id],
    { enabled },
  )
  const conversations = useDashboardConversations()
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [actionPage, setActionPage] = useState(1)
  const actionData = useAsyncResource(
    async (signal) => {
      const result = await listClientOutstandingActions(actionPage, signal)
      dashboardRows(
        result?.actions,
        (item) =>
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.service === "string" &&
          typeof item.reason === "string" &&
          (item.reference == null || typeof item.reference === "string") &&
          (item.deadline == null || validDashboardDate(item.deadline)) &&
          (item.destination == null ||
            (typeof item.destination === "string" &&
              /^\/projects\/[\w%.~-]+\/deliverables\/[\w%.~-]+$/.test(
                item.destination,
              ))),
      )
      if (
        !Number.isSafeInteger(result.total) ||
        result.total < 0 ||
        !Number.isSafeInteger(result.pageSize) ||
        result.pageSize <= 0 ||
        result.page !== actionPage
      )
        throw new Error("Unexpected action page")
      return result
    },
    [account.id, actionPage],
    { enabled },
  )
  const { retry: retryActions } = actionData
  const nextDeadline = actionData.data?.actions.reduce(
    (earliest, action) =>
      action.deadline
        ? Math.min(earliest, Date.parse(action.deadline))
        : earliest,
    Infinity,
  )
  useEffect(() => {
    if (!enabled || !nextDeadline || !Number.isFinite(nextDeadline)) return
    const delay = nextDeadline - Date.now()
    if (delay >= 2_147_483_647) return
    const timer = setTimeout(retryActions, Math.max(0, delay) + 1)
    return () => clearTimeout(timer)
  }, [enabled, nextDeadline, retryActions])
  useEffect(() => {
    if (!enabled) return
    return watchVisibleRefresh(retryActions, { poll: false })
  }, [enabled, retryActions])

  const calendarData = useAsyncResource(
    async (signal) => {
      const response = await apiRequest<CalendarEvent[] | CalendarResponse>(
        "/api/projects/calendar",
        { signal },
      )
      return dashboardRows(
        Array.isArray(response) ? response : response?.events,
        (event) =>
          typeof event.title === "string" && typeof event.type === "string",
      )
        .filter(
          (event) =>
            (event.type === "consultation" || event.type === "meeting") &&
            !event.pending &&
            !event.completed &&
            validDashboardDate(event.startsAt),
        )
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    },
    [account.id],
    { enabled },
  )
  const [readyAccountId, setReadyAccountId] = useState<string | null>(null)
  const requestsPending =
    projectData.loading ||
    requestData.loading ||
    calendarData.loading ||
    actionData.loading
  const initialLoading =
    enabled && readyAccountId !== account.id && requestsPending
  if (enabled && readyAccountId !== account.id && !requestsPending) {
    setReadyAccountId(account.id)
  }

  const { retry: retryProjects } = projectData
  const { retry: retryRequests } = requestData
  const { retry: retryCalendar } = calendarData
  useEffect(() => {
    if (!enabled) return
    return watchVisibleRefresh(
      () => {
        retryProjects()
        retryRequests()
        retryCalendar()
      },
      { poll: false },
    )
  }, [enabled, retryProjects, retryRequests, retryCalendar])
  const sectionFailed = Boolean(
    projectData.error ||
    requestData.error ||
    actionData.error ||
    calendarData.error ||
    conversations?.error,
  )
  useEffect(() => {
    // A revoked dashboard read clears the token. Ask the existing account watcher
    // to revoke the portal immediately instead of waiting for the next poll.
    if (sectionFailed && !getToken())
      window.dispatchEvent(new Event("nexus:account-updated"))
  }, [sectionFailed])

  if (account.role !== "USER") return null
  const firstName = account.fullName?.trim().split(/\s+/)[0]
  const activeProjects = (projectData.data ?? []).filter(
    (item) => item.status === "IN_PROGRESS" || item.status === "ON_HOLD",
  )
  const projectTotals = preview ? sampleProjects : activeProjects
  const projects = preview
    ? sampleProjects.map((item) => ({
        ...item,
        id: item.name,
        href: null,
        memberCount: item.team.length,
        team: item.team.map(getInitials),
      }))
    : activeProjects.slice(0, 2).map((item) => ({
        ...item,
        service:
          typeof item.request?.service?.name === "string"
            ? item.request.service.name
            : undefined,
        taskCount:
          Number.isSafeInteger(item.taskCount) && item.taskCount > 0
            ? item.taskCount
            : 0,
        completedTasks:
          Number.isSafeInteger(item.completedTasks) &&
          item.completedTasks > 0 &&
          Number.isSafeInteger(item.taskCount)
            ? Math.min(item.completedTasks, Math.max(item.taskCount, 0))
            : 0,
        memberCount:
          typeof item.memberCount === "number" &&
          Number.isSafeInteger(item.memberCount) &&
          item.memberCount >= 0
            ? item.memberCount
            : null,
        team: Array.isArray(item.memberInitials)
          ? item.memberInitials
              .filter(
                (initials) => typeof initials === "string" && initials.trim(),
              )
              .slice(0, 3)
          : [],
        lead: null,
        href: "/projects/" + encodeURIComponent(item.id),
      }))
  const requests = preview
    ? sampleRequests.map((item) => ({
        ...item,
        id: item.reference,
        context: null,
      }))
    : (requestData.data?.rows ?? []).slice(0, 2).map((item) => ({
        id: item.id,
        reference:
          typeof item.referenceNumber === "string"
            ? item.referenceNumber
            : null,
        service:
          (typeof item.title === "string" && item.title) ||
          (typeof item.service?.name === "string" && item.service.name) ||
          "Service request",
        context:
          typeof item.preferredSpecialistName === "string" &&
          item.preferredSpecialistName.trim()
            ? "Preferred: " + item.preferredSpecialistName.trim()
            : typeof item.preferredSpecialist?.fullName === "string" &&
                item.preferredSpecialist.fullName.trim()
              ? "Preferred: " + item.preferredSpecialist.fullName.trim()
              : typeof item.package?.name === "string" &&
                  item.package.name.trim()
                ? item.package.name.trim()
                : typeof item.packageName === "string"
                  ? item.packageName.trim()
                  : null,
        status: item.status,
        date: validDashboardDate(item.createdAt) ? item.createdAt : null,
      }))
  const lastRequest = preview ? undefined : requestData.data?.rows[0]
  const lastRequestStatus =
    lastRequest && Object.hasOwn(serviceRequestStatuses, lastRequest.status)
      ? serviceRequestStatuses[lastRequest.status]
      : undefined
  const pageActions: ClientOutstandingAction[] = preview
    ? sampleActions.map((item) => ({
        ...item,
        id: item.reference,
        requestId: item.reference,
      }))
    : (actionData.data?.actions ?? [])
  const orderedActions = [...pageActions].sort(
    (a, b) => deadlineTime(a.deadline) - deadlineTime(b.deadline),
  )
  const actions = orderedActions.slice(
    0,
    preview || actionsExpanded ? undefined : 2,
  )
  const actionTotal = preview ? actions.length : (actionData.data?.total ?? 0)
  const actionPages = Math.max(
    1,
    Math.ceil(actionTotal / (actionData.data?.pageSize ?? 10)),
  )
  const actionPageOutOfRange =
    enabled &&
    !actionData.loading &&
    !actionData.error &&
    actionPage > actionPages
  if (actionPageOutOfRange) setActionPage(actionPages)

  const requestSummary = preview
    ? {
        total: sampleRequests.length,
        pending: sampleRequests.filter(
          (request) => request.status === "SUBMITTED",
        ).length,
      }
    : requestData.data?.summary
  const messageRows = preview
    ? []
    : orderConversations(
        [
          ...(conversations?.data?.requests ?? []).flatMap((row) => {
            if (row?.client?.id !== account.id || typeof row.id !== "string")
              return []
            return [
              {
                id: "service:" + row.id,
                href: "/messages?request=" + encodeURIComponent(row.id),
                title:
                  row.acceptedDepartment?.head?.fullName ||
                  row.title ||
                  "Service conversation",
                context:
                  row.service?.name || row.acceptedDepartment?.name || "",
                imageUrl:
                  row.acceptedDepartment?.head?.id ===
                  (row.lastTeamMessage ?? row.lastMessage)?.sender?.id
                    ? row.acceptedDepartment?.head?.imageUrl
                    : undefined,
                unreadCount: row.unreadCount ?? 0,
                message:
                  row.lastTeamMessage ??
                  ((row.lastTeamMessage ?? row.lastMessage)?.sender?.id !==
                  account.id
                    ? row.lastMessage
                    : null),
                updatedAt:
                  row.lastTeamMessage?.createdAt ??
                  row.lastMessage?.createdAt ??
                  row.updatedAt,
              },
            ]
          }),
          ...(conversations?.data?.projects ?? []).flatMap((row) => {
            if (!row || typeof row.id !== "string") return []
            return [
              {
                id: "project:" + row.id,
                href: "/messages?project=" + encodeURIComponent(row.id),
                title: row.name || "Project conversation",
                context: row.name || "",
                imageUrl: undefined,
                unreadCount: row.unreadCount ?? 0,
                message:
                  row.lastTeamMessage ??
                  ((row.lastTeamMessage ?? row.lastMessage)?.sender?.id !==
                  account.id
                    ? row.lastMessage
                    : null),
                updatedAt:
                  row.lastTeamMessage?.createdAt ??
                  row.lastMessage?.createdAt ??
                  row.updatedAt,
              },
            ]
          }),
        ].filter((row) => row.message && validDashboardDate(row.updatedAt)),
      )
        .sort((a, b) => Number(b.unreadCount > 0) - Number(a.unreadCount > 0))
        .filter(
          (row, index) => index === 0 || (index === 1 && row.unreadCount > 0),
        )
  const messageState = preview
    ? "empty"
    : resourceState(
        {
          loading: Boolean(conversations?.loading && !conversations.data),
          error: conversations?.error ?? "",
        },
        messageRows.length > 0,
      )
  const event = calendarData.data?.find(
    (item) => Date.parse(item.startsAt) > now,
  )
  const appointment = preview
    ? sampleAppointment
    : event
      ? {
          title: event.title,
          bookingType: event.type === "meeting" ? "Meeting" : "Consultation",
          project:
            typeof event.project?.name === "string"
              ? event.project.name
              : typeof event.context === "string"
                ? event.context
                : null,
          location:
            typeof event.location !== "string" ||
            event.location.trim().toLowerCase() === "hh"
              ? null
              : event.location.includes("://")
                ? "Online"
                : event.location.trim(),
        }
      : null
  const startsAt = preview?.startsAt ?? event?.startsAt
  const date = startsAt ? new Date(startsAt) : null
  const today = new Date(now)
  const weekday = new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    timeZone: calendarTimeZone,
  }).format(today)
  const month = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    timeZone: calendarTimeZone,
  }).format(today)
  const day = new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    timeZone: calendarTimeZone,
  }).format(today)
  const time = date && calendarTimeLabel.format(date)
  const projectState =
    preview?.state ?? resourceState(projectData, projects.length > 0)
  const requestState =
    preview?.state ?? resourceState(requestData, requests.length > 0)
  const calendarState =
    preview?.state ?? resourceState(calendarData, !!appointment)
  const actionState =
    preview?.state ??
    resourceState(
      { ...actionData, loading: actionData.loading || actionPageOutOfRange },
      actions.length > 0,
    )
  const earliestDeadline = orderedActions[0]?.deadline
  const deadlineDays = earliestDeadline
    ? calendarDaysUntil(earliestDeadline, now)
    : null
  const consultationDays = startsAt ? calendarDaysUntil(startsAt, now) : null
  let welcomeSummary = "Explore services to get started."
  if (projectState === "loaded") {
    const inProgress = projectTotals.filter(
      (project) => project.status === "IN_PROGRESS",
    ).length
    welcomeSummary = `${projectTotals.length} active ${projectTotals.length === 1 ? "project" : "projects"}, ${inProgress} in progress.`
  }
  if (calendarState === "loaded" && consultationDays !== null) {
    welcomeSummary =
      consultationDays === 0
        ? "Your next consultation is today."
        : consultationDays === 1
          ? "Your next consultation is tomorrow."
          : `Your next consultation is in ${consultationDays} days.`
  }
  if (actionState === "loaded" && actionTotal > 0) {
    welcomeSummary = `${actionTotal} ${actionTotal === 1 ? "item needs" : "items need"} your response.`
    if (earliestDeadline && deadlineDays !== null && actionPage === 1) {
      const urgent = orderedActions[0]
      const subject =
        urgent.id.startsWith("quotation:") ||
        urgent.title === "Review your quotation"
          ? "Your quotation"
          : urgent.id.startsWith("payment:")
            ? "Your payment request"
            : "A response"
      welcomeSummary =
        deadlineDays < 0
          ? subject + " is overdue and needs attention."
          : subject +
            (subject === "A response" ? " is due " : " needs attention by ") +
            requestDate(earliestDeadline) +
            "."
    } else if (pageActions.some((action) => action.id.startsWith("payment:"))) {
      welcomeSummary += " One is a payment request."
    }
  }
  if (initialLoading) welcomeSummary = ""
  return (
    <main
      className={cn(contentClass, "p-[clamp(20px,2.1vw,32px)]")}
      aria-label="Client dashboard"
    >
      <PageHeader
        tone="client"
        mobileActions="stack"
        titleSize="small"
        className="[&_h1]:text-[23px]"
        title={firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {welcomeSummary}
            {preview && <Pill tone="brand">Preview · Sample data</Pill>}
          </span>
        }
        actions={
          <>
            <Button asChild variant="brand" size="header">
              <Link href="/services">
                <Plus size={14} aria-hidden="true" /> New Request
              </Link>
            </Button>
            <Button asChild variant="brandOutline" size="header">
              <Link href="/services">
                Explore Services <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </>
        }
      />

      {initialLoading ? (
        <div role="status" className="mt-5 grid gap-4">
          <span className="sr-only">Loading dashboard…</span>
          <div aria-hidden="true" className="grid gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="@container mt-5 min-w-0">
            <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="contents @2xl:grid @2xl:min-w-0 @2xl:gap-4">
                <section
                  aria-labelledby="next-up"
                  className="order-2 relative isolate grid min-w-0 content-start gap-4 overflow-hidden rounded-xl bg-[#182f69] bg-linear-to-r from-[#0e172c] via-[#182f69] to-[#1246bd] py-5 pr-5 pl-12 text-white @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-center"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
                  >
                    <div className="absolute -right-28 -bottom-52 h-80 w-[34rem] -rotate-18 rounded-[50%] bg-blue-600/45" />
                  </div>
                  <CalendarDays
                    size={21}
                    className="absolute top-6 left-4 text-blue-200"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2
                      id="next-up"
                      tabIndex={-1}
                      className="text-xs font-semibold tracking-wide text-blue-200 uppercase"
                    >
                      Next Up
                    </h2>
                    {calendarState === "loaded" && appointment && startsAt ? (
                      <>
                        <p className="mt-2 [overflow-wrap:anywhere] text-lg leading-tight font-semibold tracking-tight">
                          {appointment.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/90">
                          <span>{requestDate(startsAt)}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={startsAt}>{time} PHT</time>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/90">
                          <span>
                            {"bookingType" in appointment
                              ? appointment.bookingType
                              : "Consultation"}
                          </span>
                          {appointment.location && (
                            <span className="[overflow-wrap:anywhere]">
                              {appointment.location}
                            </span>
                          )}
                          {consultationDays !== null &&
                            consultationDays >= 0 && (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 font-medium text-white">
                                {consultationDays === 0
                                  ? "Today"
                                  : consultationDays === 1
                                    ? "Tomorrow"
                                    : "In " + consultationDays + " days"}
                              </span>
                            )}
                        </div>
                      </>
                    ) : calendarState === "loading" ? (
                      <div role="status" className="mt-3 grid gap-2">
                        <span className="sr-only">Loading appointment…</span>
                        <Skeleton className="h-7 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <p
                        className="mt-2 text-sm font-semibold"
                        role={calendarState === "error" ? "alert" : undefined}
                      >
                        {calendarState === "empty"
                          ? "No upcoming appointments"
                          : "Could not load your schedule"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time
                      dateTime={manilaDay.format(today)}
                      className="sr-only"
                    >
                      Today · {weekday}, {month} {day}
                    </time>
                    <Button
                      asChild
                      variant="brandOutline"
                      size="header"
                      className="border-white/60 bg-white text-[#203f8c] shadow-sm hover:bg-white/90"
                    >
                      <Link href="/calendar">
                        View Calendar{" "}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </Button>
                    {calendarState === "error" && !preview && (
                      <Button
                        variant="brandOutline"
                        size="header"
                        className="ml-2"
                        onClick={() => {
                          document.getElementById("next-up")?.focus()
                          calendarData.retry()
                        }}
                      >
                        Try again
                      </Button>
                    )}
                  </div>
                </section>
                <section
                  aria-labelledby="active-projects"
                  className={cn(dashboardCard, "order-3 @container/projects")}
                >
                  <div className={dashboardCardHeader}>
                    <div className="contents">
                      <h2
                        id="active-projects"
                        tabIndex={-1}
                        className={sectionHeading}
                      >
                        Active Projects
                      </h2>
                      <ViewAll href="/projects" label="View all projects" />
                    </div>
                    <p className={cn(metadata, "mt-0 text-[11px]")}>
                      {projectTotals.length}{" "}
                      {projectTotals.length === 1 ? "project" : "projects"} ·{" "}
                      {
                        projectTotals.filter(
                          (project) => project.status === "ON_HOLD",
                        ).length
                      }{" "}
                      on hold
                    </p>
                  </div>
                  <SectionContent
                    headingId="active-projects"
                    state={projectState}
                    retry={preview ? undefined : projectData.retry}
                    empty="No active projects"
                  >
                    <ul className="grid gap-2">
                      {projects.map((project) => {
                        const percent = projectProgress(project)
                        return (
                          <li
                            key={project.id}
                            className="relative space-y-1 py-1.5 pl-1 pr-6 transition-colors hover:bg-muted/40"
                          >
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <h3 className={itemTitle}>
                                  {project.href ? (
                                    <Link
                                      href={project.href}
                                      className={cn(
                                        "after:absolute after:inset-0 hover:underline",
                                        focusRing,
                                      )}
                                    >
                                      {project.name}
                                    </Link>
                                  ) : (
                                    project.name
                                  )}
                                </h3>
                              </div>
                              <div>
                                <Pill
                                  tone={
                                    project.status === "IN_PROGRESS"
                                      ? "success"
                                      : statusTone(project.status)
                                  }
                                >
                                  {statusLabel(project.status)}
                                </Pill>
                              </div>
                              {project.href && (
                                <ChevronRight
                                  size={14}
                                  aria-hidden="true"
                                  className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                              )}
                            </div>
                            <p className={metadata}>
                              {project.service}
                              {project.lead && <> · Led by {project.lead}</>}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {project.taskCount > 0 && (
                                <div className="flex min-w-0 flex-[2_1_13rem] items-center gap-2">
                                  <div className="min-w-12 flex-1">
                                    <ProgressMeter
                                      value={percent}
                                      max={100}
                                      label={`${project.name} progress`}
                                      colorClass="bg-[#203f8c]"
                                    />
                                  </div>
                                  <p className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                                    <span className="order-last text-muted-foreground">
                                      {project.completedTasks} of{" "}
                                      {project.taskCount} tasks
                                    </span>
                                    <strong>{percent}%</strong>
                                  </p>
                                </div>
                              )}

                              {project.memberCount !== null && (
                                <div className="flex items-center gap-2">
                                  <ul
                                    aria-label="Project team initials"
                                    className="flex shrink-0 -space-x-2"
                                  >
                                    {project.team.map((member, index) => (
                                      <li
                                        key={index}
                                        className="rounded-full ring-2 ring-card"
                                      >
                                        <span className="sr-only">
                                          {member}
                                        </span>
                                        <Avatar
                                          name={null}
                                          initials={member}
                                          size="sm"
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                  <span className="text-xs text-muted-foreground">
                                    {project.memberCount === 0
                                      ? "No team yet"
                                      : project.memberCount > 3
                                        ? "+" + (project.memberCount - 3)
                                        : project.memberCount === 1
                                          ? "1 member"
                                          : project.memberCount + " members"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </SectionContent>
                </section>
              </div>
              <div className="contents @2xl:grid @2xl:min-w-0 @2xl:gap-4">
                <section
                  aria-labelledby="client-input"
                  className={
                    actionState === "empty"
                      ? "sr-only"
                      : "order-1 min-w-0 rounded-xl border border-[#d7e0ee] bg-[#f3f7fd]"
                  }
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center text-[#203f8c]"
                    >
                      <ClipboardList size={18} strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="client-input"
                        tabIndex={-1}
                        className="text-sm leading-snug font-semibold"
                      >
                        Needs Your Input
                      </h2>
                      {actionState === "loading" && (
                        <div role="status" className="mt-2">
                          <span className="sr-only">
                            Loading pending actions
                          </span>
                          <Skeleton className="h-3 w-32 bg-white/20" />
                        </div>
                      )}
                      {actionState === "loaded" && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs leading-relaxed">
                          <span>
                            {actionTotal}{" "}
                            {actionTotal === 1 ? "action" : "actions"}
                          </span>
                        </p>
                      )}
                    </div>
                    {actionState === "loading" && (
                      <Skeleton
                        aria-hidden="true"
                        className="h-[34px] w-[120px] shrink-0 rounded-lg bg-white/20"
                      />
                    )}
                  </div>
                  <div
                    id="dashboard-client-action-list"

                    tabIndex={-1}
                    className="px-4"
                  >
                    <SectionContent
                      headingId="client-input"
                      state={actionState}
                      retry={preview ? undefined : retryActions}
                      empty={
                        preview ? "You’re all caught up" : "No pending actions"
                      }
                    >
                      <ul className="grid gap-2 py-2">
                        {actions.map((action) => {
                          const payment = action.id.startsWith("payment:")
                          return (
                            <li
                              key={action.id}
                              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-[#f5f4f1] px-3 py-2 transition-colors hover:bg-[#efeeea] focus-within:bg-[#efeeea]"
                            >
                              <div className="min-w-0">
                                <h3
                                  className={itemTitle}
                                  id={"dashboard-action-" + action.id}
                                >
                                  {action.title}
                                </h3>
                                {action.deadline && (
                                  <Pill
                                    tone={
                                      calendarDaysUntil(action.deadline, now) <
                                      0
                                        ? "danger"
                                        : calendarDaysUntil(
                                              action.deadline,
                                              now,
                                            ) <= 3
                                          ? "warning"
                                          : "info"
                                    }
                                  >
                                    <time
                                      dateTime={action.deadline}
                                      title={requestDate(action.deadline)}
                                    >
                                      {deadlineLabel(
                                        calendarDaysUntil(action.deadline, now),
                                      )}
                                    </time>
                                  </Pill>
                                )}
                                <p className={metadata}>{action.service}</p>
                                <p className={metadata}>{action.reason}</p>
                              </div>
                              <Button
                                asChild
                                variant={
                                  payment ? "actionWarning" : "actionInfo"
                                }
                                size="actionPill"
                              >
                                <Link
                                  href={
                                    action.destination ?? "/service-requests"
                                  }
                                  aria-describedby={
                                    "dashboard-action-" + action.id
                                  }
                                >
                                  {action.destination
                                    ? "Open deliverable"
                                    : action.id.startsWith("payment:")
                                      ? "View payment request"
                                      : action.id.startsWith("quotation:")
                                        ? "View quote request"
                                        : "View request"}{" "}
                                  <ChevronRight
                                    size={14}
                                    className="inline"
                                    aria-hidden="true"
                                  />
                                </Link>
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    </SectionContent>
                  </div>
                  {!preview &&
                    (actionsExpanded ||
                      (actionState === "loaded" && actionTotal > 2)) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={actionsExpanded}
                          aria-controls="dashboard-client-action-list"
                          onClick={() => {
                            setActionsExpanded(!actionsExpanded)
                            if (actionsExpanded) setActionPage(1)
                          }}
                        >
                          {actionsExpanded
                            ? "Show fewer actions"
                            : "Show all actions"}
                        </Button>
                        {actionsExpanded && actionPages > 1 && (
                          <NumberedPagination
                            page={actionPage}
                            totalPages={actionPages}
                            label="Outstanding action pages"
                            onPageChange={(page) => {
                              document.getElementById("client-input")?.focus()
                              setActionPage(page)
                            }}
                            disabled={actionData.loading}
                          />
                        )}
                      </div>
                    )}
                </section>
                <section
                  aria-labelledby="booked-requests"
                  className={cn(dashboardCard, "order-4 self-start")}
                >
                  <div className={dashboardCardHeader}>
                    <div className="contents">
                      <h2
                        id="booked-requests"
                        tabIndex={-1}
                        className={sectionHeading}
                      >
                        Booked Requests
                      </h2>
                      <ViewAll
                        href="/service-requests"
                        label="View all booked requests"
                      />
                    </div>
                    {requestState === "loaded" && requestSummary && (
                      <p className={cn(metadata, "mt-0 text-[11px]")}>
                        {requestSummary.total}{" "}
                        {requestSummary.total === 1 ? "request" : "requests"} ·{" "}
                        {requestSummary.pending} pending
                      </p>
                    )}
                  </div>
                  <SectionContent
                    headingId="booked-requests"
                    state={requestState}
                    retry={preview ? undefined : requestData.retry}
                    empty="No booked requests"
                  >
                    <ul className="divide-y divide-border">
                      {requests.map((request) => {
                        const sameDay = requests.filter(
                          (other) =>
                            other.id !== request.id &&
                            other.service === request.service &&
                            other.context === request.context &&
                            (other.date ? requestDate(other.date) : null) ===
                              (request.date ? requestDate(request.date) : null),
                        )
                        const timeLabel = request.date
                          ? calendarTimeLabel.format(new Date(request.date))
                          : null
                        const needsReference = sameDay.some(
                          (other) =>
                            (other.date
                              ? calendarTimeLabel.format(new Date(other.date))
                              : null) === timeLabel,
                        )
                        const reference =
                          needsReference &&
                          request.reference &&
                          /^[A-Z]{2,12}-[0-9]{1,9}$/i.test(request.reference) &&
                          sameDay.every(
                            (other) => other.reference !== request.reference,
                          )
                            ? request.reference
                            : null
                        const idSuffix =
                          needsReference &&
                          !reference &&
                          /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
                            request.id,
                          ) &&
                          sameDay.every(
                            (other) =>
                              other.id.slice(-8).toLowerCase() !==
                              request.id.slice(-8).toLowerCase(),
                          )
                            ? request.id.slice(-8).toUpperCase()
                            : null
                        const status = Object.hasOwn(
                          serviceRequestStatuses,
                          request.status,
                        )
                          ? serviceRequestStatuses[request.status]
                          : {
                              tone: "neutral" as const,
                              label: "Status unavailable",
                            }
                        return (
                          <li
                            key={request.id}
                            className="min-w-0 py-3 min-[1024px]:[@media(max-height:880px)]:py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3
                                className={itemTitle}
                                id={"dashboard-request-" + request.id}
                              >
                                {request.service}
                              </h3>
                              <div className="flex flex-wrap items-center gap-x-3">
                                <Pill
                                  tone={
                                    request.status === "SUBMITTED"
                                      ? "neutral"
                                      : status.tone
                                  }
                                >
                                  {status.label}
                                </Pill>
                                <Link
                                  href="/service-requests"
                                  className={textLink}
                                  aria-describedby={
                                    "dashboard-request-" + request.id
                                  }
                                >
                                  <span className="sr-only">View request</span>
                                  <ChevronRight size={16} aria-hidden="true" />
                                </Link>
                              </div>
                            </div>
                            <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs leading-relaxed text-muted-foreground">
                              {request.date && (
                                <time dateTime={request.date}>
                                  Requested {requestDate(request.date)}
                                  {timeLabel && <> · {timeLabel} PHT</>}
                                </time>
                              )}
                              {reference && <span>{reference}</span>}
                              {idSuffix && <span>Ref. {idSuffix}</span>}
                            </p>
                            {request.context && (
                              <p className={metadata}>{request.context}</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </SectionContent>
                </section>
                {(lastRequest || requestState === "error") && !preview && (
                  <section
                    aria-labelledby="last-booked-service"
                    className={cn(dashboardCard, "order-4 self-start")}
                  >
                    <div className={dashboardCardHeader}>
                      <h2
                        id="last-booked-service"
                        tabIndex={-1}
                        className={sectionHeading}
                      >
                        Your Last Booked Service
                      </h2>
                    </div>
                    <SectionContent
                      headingId="last-booked-service"
                      state={requestState}
                      retry={requestData.retry}
                      empty="No booking history"
                    >
                      {lastRequest && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className={itemTitle}>
                              {lastRequest.service?.name ||
                                lastRequest.title ||
                                "Service request"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {validDashboardDate(lastRequest.createdAt) ? (
                                <time dateTime={lastRequest.createdAt}>
                                  {requestDate(lastRequest.createdAt)}
                                </time>
                              ) : (
                                <span>Request date unavailable</span>
                              )}
                              {lastRequestStatus && (
                                <Pill
                                  tone={
                                    lastRequest.status === "SUBMITTED"
                                      ? "neutral"
                                      : lastRequestStatus.tone
                                  }
                                >
                                  {lastRequestStatus.label}
                                </Pill>
                              )}
                            </div>
                          </div>
                          <Button asChild size="sm" variant="brand">
                            <Link
                              href={{
                                pathname: "/services",
                                query: { service: lastRequest.service?.id },
                              }}
                            >
                              Book Again{" "}
                              <ChevronRight size={14} aria-hidden="true" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </SectionContent>
                  </section>
                )}
                <section
                  aria-labelledby="from-your-team"
                  className={cn(dashboardCard, "order-5 pb-3")}
                >
                  <div className={dashboardCardHeader}>
                    <h2
                      id="from-your-team"
                      tabIndex={-1}
                      className={sectionHeading}
                    >
                      <MessageSquare
                        size={16}
                        className="text-[#203f8c]"
                        aria-hidden="true"
                      />
                      From Your Team
                    </h2>
                    {!preview && (
                      <Link className={textLink} href="/messages">
                        View inbox <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  <SectionContent
                    headingId="from-your-team"
                    state={messageState}
                    retry={conversations?.retry}
                    empty="No conversations with your team yet."
                  >
                    <div className="grid min-w-0 gap-2">
                      {messageRows.map(({ message, ...row }) => {
                        const own = message?.sender?.id === account.id
                        const sender = own
                          ? row.title
                          : message?.sender?.fullName?.trim() || row.title
                        const previewText = inboxMessagePreview(message)
                        const excerpt = (own ? "You: " : "") + previewText
                        const unreadCount =
                          Number.isSafeInteger(row.unreadCount) &&
                          row.unreadCount > 0
                            ? row.unreadCount
                            : 0
                        const age = Math.max(
                          0,
                          Math.floor(
                            (now - Date.parse(row.updatedAt)) / 60_000,
                          ),
                        )
                        const timeLabel =
                          age < 1
                            ? "Just now"
                            : age < 60
                              ? relativeMessageTime.format(-age, "minute")
                              : age < 1440
                                ? relativeMessageTime.format(
                                    -Math.floor(age / 60),
                                    "hour",
                                  )
                                : age < 10080
                                  ? relativeMessageTime.format(
                                      -Math.floor(age / 1440),
                                      "day",
                                    )
                                  : undefined
                        return (
                          <ConversationRow
                            key={row.id}
                            id={row.id}
                            href={row.href}
                            name={sender}
                            subtitle={row.context === sender ? "" : row.context}
                            imageUrl={row.imageUrl}
                            preview={excerpt}
                            updatedAt={row.updatedAt}
                            timeLabel={timeLabel}
                            unreadCount={unreadCount}
                            label={[
                              sender,
                              row.context,
                              excerpt,
                              unreadCount
                                ? unreadCount + " unread messages"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(". ")}
                            compact
                          />
                        )
                      })}
                    </div>
                  </SectionContent>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
