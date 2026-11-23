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
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileText,
  ListChecks,
  MessageCircle,
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

const textLink = cn(
  "inline-flex min-h-9 items-center gap-1.5 rounded-sm text-xs font-semibold text-[#203f8c] hover:underline focus-visible:underline",
  focusRing,
)
const sectionHeading = "text-sm leading-snug font-semibold"
const itemTitle =
  "min-w-0 [overflow-wrap:anywhere] text-[13px] leading-snug font-semibold"
const metadata =
  "mt-1 [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground"
function mostRequested(names: unknown[]) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const value of names) {
    if (typeof value !== "string" || !value.trim()) continue
    const name = value.trim()
    const key = name.toLowerCase()
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { name, count: 1 })
  }
  // Stable sorting favors the most recent request when counts tie.
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]
}

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
  resource: { loading: boolean; error: string | boolean },
  hasData: boolean,
): PreviewState {
  return resource.loading
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
      return { rows, summary: result.summary }
    },
    [account.id],
    { enabled },
  )
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
    calendarData.error,
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
    ? sampleRequests.map((item) => ({ ...item, id: item.reference }))
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
        status: item.status,
        date: validDashboardDate(item.createdAt) ? item.createdAt : null,
      }))
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

  const recentRequests = requestData.data?.rows ?? []
  const requestCount = preview ? sampleRequests.length : recentRequests.length
  const topService = mostRequested(
    preview
      ? sampleRequests.map((request) => request.service)
      : recentRequests.map((request) => request.service?.name),
  )
  const topSpecialist = mostRequested(
    recentRequests.map(
      (request) =>
        (typeof request.preferredSpecialistName === "string" &&
          request.preferredSpecialistName.trim()) ||
        request.preferredSpecialist?.fullName,
    ),
  )
  const requestSummary = preview
    ? {
        total: sampleRequests.length,
        pending: sampleRequests.filter(
          (request) => request.status === "SUBMITTED",
        ).length,
      }
    : requestData.data?.summary
  const preferenceState =
    preview?.state ?? resourceState(requestData, requestCount > 0)
  const event = calendarData.data?.find(
    (item) => Date.parse(item.startsAt) > now,
  )
  const appointment = preview
    ? sampleAppointment
    : event
      ? {
          title: event.title,
          project:
            typeof event.project?.name === "string"
              ? event.project.name
              : typeof event.context === "string"
                ? event.context
                : null,
          location:
            typeof event.location !== "string"
              ? null
              : event.location.includes("://")
                ? "Online"
                : event.location,
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
    if (
      earliestDeadline &&
      deadlineDays !== null &&
      actionsExpanded === false
    ) {
      welcomeSummary +=
        deadlineDays < 0
          ? " A response is overdue."
          : ` A response is due ${requestDate(earliestDeadline)}.`
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
        title={firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {welcomeSummary}
            {preview && <Pill tone="brand">Preview · Sample data</Pill>}
          </span>
        }
        actions={
          <>
            <Button asChild variant="brandOutline" size="header">
              <Link href="/services">
                <Plus size={14} aria-hidden="true" /> New Request
              </Link>
            </Button>
            <Button asChild variant="brand" size="header">
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
            <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <section
                aria-labelledby="client-input"
                className="min-w-0 overflow-hidden rounded-xl border border-primary/15 bg-card"
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3",
                    actionState === "loaded" &&
                      actionTotal > 0 &&
                      "bg-[#203f8c] text-white",
                  )}
                >
                  <h2
                    id="client-input"
                    tabIndex={-1}
                    className="flex min-w-0 items-center gap-2 text-base font-semibold"
                  >
                    <FileText
                      size={18}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    Needs Your Input
                  </h2>
                  {actionState === "loaded" && (
                    <Pill tone="brand">
                      <strong className="text-xs tabular-nums">
                        {actionTotal}
                      </strong>{" "}
                      {actionTotal === 1 ? "action" : "actions"}
                    </Pill>
                  )}
                  {actionState === "loaded" && actionTotal > 0 && (
                    <Button
                      variant="brandOutline"
                      size="header"
                      className="ml-auto"
                      aria-controls="dashboard-client-action-list"
                      onClick={() =>
                        document
                          .getElementById("dashboard-client-action-list")
                          ?.focus()
                      }
                    >
                      Review Now <ChevronRight size={14} aria-hidden="true" />
                    </Button>
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
                      {actions.map((action) => (
                        <li
                          key={action.id}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-primary/10 last:border-b-0 py-3 min-[1024px]:[@media(max-height:880px)]:py-1.5"
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
                                  calendarDaysUntil(action.deadline, now) < 0
                                    ? "danger"
                                    : calendarDaysUntil(action.deadline, now) <=
                                        3
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
                            <p className={metadata}>
                              {action.service}
                              {action.reference && <> · {action.reference}</>}
                            </p>
                            <p className={metadata}>{action.reason}</p>
                          </div>
                          <Link
                            href={action.destination ?? "/service-requests"}
                            aria-describedby={"dashboard-action-" + action.id}
                            className={textLink}
                          >
                            {action.destination
                              ? "Open deliverable"
                              : "View request"}{" "}
                            <ChevronRight
                              size={14}
                              className="inline"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
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
                aria-labelledby="next-up"
                className="grid min-w-0 content-start gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4"
              >
                <div>
                  <h2
                    id="next-up"
                    tabIndex={-1}
                    className="text-xs font-semibold text-primary"
                  >
                    Next Up
                  </h2>
                  {calendarState === "loaded" && appointment && startsAt ? (
                    <>
                      <p className="mt-1 [overflow-wrap:anywhere] text-sm leading-tight font-semibold tracking-tight">
                        {appointment.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays size={16} aria-hidden="true" />
                          {requestDate(startsAt)}
                        </span>
                        <time dateTime={startsAt}>{time} PHT</time>
                        {appointment.location && (
                          <span className="[overflow-wrap:anywhere]">
                            {appointment.location}
                          </span>
                        )}
                        {consultationDays !== null && consultationDays >= 0 && (
                          <span className="font-semibold text-primary">
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
                    className="text-xs text-muted-foreground"
                  >
                    Today · {weekday}, {month} {day}
                  </time>
                  <Button asChild variant="brandOutline" size="header">
                    <Link href="/calendar">
                      View Calendar <ArrowRight size={15} aria-hidden="true" />
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
            </div>
            <div className="mt-4 grid items-start gap-4 @2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 gap-4">
                <section
                  aria-labelledby="active-projects"
                  className="min-w-0 rounded-xl border border-border bg-card @container/projects p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
                    <h2
                      id="active-projects"
                      tabIndex={-1}
                      className={sectionHeading}
                    >
                      Active Projects
                    </h2>
                    <ViewAll href="/projects" label="View all projects" />
                  </div>
                  <p className={metadata}>
                    {projectTotals.length}{" "}
                    {projectTotals.length === 1 ? "project" : "projects"} ·{" "}
                    {
                      projectTotals.filter(
                        (project) => project.status === "ON_HOLD",
                      ).length
                    }{" "}
                    on hold
                  </p>
                  <SectionContent
                    headingId="active-projects"
                    state={projectState}
                    retry={preview ? undefined : projectData.retry}
                    empty="No active projects"
                  >
                    <ul className="divide-y divide-border">
                      {projects.map((project) => {
                        const percent = projectProgress(project)
                        return (
                          <li
                            key={project.id}
                            className="py-3 min-[1024px]:[@media(max-height:880px)]:py-1.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <h3 className={itemTitle}>
                                  {project.href ? (
                                    <Link
                                      href={project.href}
                                      className={cn(
                                        "hover:underline",
                                        focusRing,
                                      )}
                                    >
                                      {project.name}
                                    </Link>
                                  ) : (
                                    project.name
                                  )}
                                </h3>
                                <Pill tone={statusTone(project.status)}>
                                  {statusLabel(project.status)}
                                </Pill>
                              </div>
                            </div>
                            <div className="mt-1 grid items-center gap-x-3 gap-y-2 @md/projects:grid-cols-[minmax(0,1fr)_minmax(4rem,0.65fr)_auto]">
                              <p className={metadata}>
                                {project.service}
                                {project.lead && <> · Led by {project.lead}</>}
                              </p>
                              <ProgressMeter
                                value={percent}
                                max={100}
                                label={`${project.name} progress`}
                                colorClass="bg-[#203f8c]"
                              />
                              <p className="flex justify-between gap-2 text-xs tabular-nums">
                                <span className="text-muted-foreground">
                                  {project.completedTasks} of{" "}
                                  {project.taskCount} tasks
                                </span>
                                <strong>{percent}%</strong>
                              </p>
                            </div>
                            {project.memberCount !== null && (
                              <div className="mt-2 flex items-center gap-3">
                                <ul
                                  aria-label="Project team initials"
                                  className="flex shrink-0 -space-x-2"
                                >
                                  {project.team.map((member, index) => (
                                    <li
                                      key={index}
                                      className="rounded-full ring-2 ring-card"
                                    >
                                      <span className="sr-only">{member}</span>
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
                                    : project.memberCount === 1
                                      ? "1 member"
                                      : project.memberCount + " members"}
                                </span>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </SectionContent>
                </section>
                <section
                  aria-labelledby="booked-requests"
                  className="min-w-0 self-start rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
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
                    <p className={metadata}>
                      {requestSummary.total}{" "}
                      {requestSummary.total === 1 ? "request" : "requests"} ·{" "}
                      {requestSummary.pending} pending
                    </p>
                  )}
                  <SectionContent
                    headingId="booked-requests"
                    state={requestState}
                    retry={preview ? undefined : requestData.retry}
                    empty="No booked requests"
                  >
                    <ul className="divide-y divide-border">
                      {requests.map((request) => {
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
                            className="flex flex-wrap items-center justify-between gap-x-3 py-3 min-[1024px]:[@media(max-height:880px)]:py-1.5"
                          >
                            <div className="min-w-0">
                              <h3
                                className={itemTitle}
                                id={"dashboard-request-" + request.id}
                              >
                                {request.service}
                              </h3>
                              <p className={metadata}>
                                {request.reference && (
                                  <>
                                    {request.reference}
                                    {request.date && " · "}
                                  </>
                                )}
                                {request.date && (
                                  <time dateTime={request.date}>
                                    {requestDate(request.date)}
                                  </time>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3">
                              <Pill tone={status.tone}>{status.label}</Pill>
                              <Link
                                href="/service-requests"
                                className={textLink}
                                aria-describedby={
                                  "dashboard-request-" + request.id
                                }
                              >
                                View request{" "}
                                <ChevronRight size={14} aria-hidden="true" />
                              </Link>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </SectionContent>
                </section>
              </div>
              <div className="grid min-w-0 gap-4">
                <section
                  aria-labelledby="quick-actions"
                  className="@container/shortcuts min-w-0 rounded-xl border border-border bg-card p-4"
                >
                  <h2 id="quick-actions" className={sectionHeading}>
                    Quick Actions
                  </h2>
                  <ul className="mt-3 grid gap-2 @min-[18rem]/shortcuts:grid-cols-3">
                    {[
                      {
                        href: "/services",
                        label: "New Service Request",
                        icon: Plus,
                      },
                      {
                        href: "/service-requests",
                        label: "View Booked Requests",
                        icon: ListChecks,
                      },
                      {
                        href: "/help",
                        label: "Contact Support",
                        icon: MessageCircle,
                      },
                    ].map(({ href, label, icon: Icon }) => (
                      <li key={href} className="grid min-w-0">
                        <Button asChild variant="outline" size="shortcutTile">
                          <Link href={href} prefetch={false}>
                            <Icon
                              size={16}
                              className="shrink-0 text-primary"
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
                <section
                  aria-labelledby="most-requested"
                  className="min-w-0 px-1 py-2"
                >
                  <h2
                    id="most-requested"
                    tabIndex={-1}
                    className={sectionHeading}
                  >
                    Your Most Requested
                  </h2>
                  {preferenceState === "loaded" && (
                    <p className={metadata}>
                      Based on your latest {requestCount}{" "}
                      {requestCount === 1 ? "request" : "requests"}.
                    </p>
                  )}
                  <SectionContent
                    headingId="most-requested"
                    state={
                      preferenceState === "error" ? "empty" : preferenceState
                    }
                    empty={
                      preferenceState === "error"
                        ? "Request statistics unavailable. Retry in Booked Requests."
                        : "No requests to summarize"
                    }
                  >
                    <dl className="mt-2 divide-y divide-border">
                      {[
                        {
                          label: "Service",
                          entry: topService,
                          empty: "No service recorded",
                        },
                        {
                          label: "Specialist",
                          entry: topSpecialist,
                          empty: "No specialist requested",
                        },
                      ].map(({ label, entry, empty }) => (
                        <div key={label} className="py-2">
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                            <span className={itemTitle}>
                              {entry?.name ?? empty}
                            </span>
                            {entry && (
                              <Pill tone="brand">
                                {entry.count}{" "}
                                {entry.count === 1 ? "request" : "requests"}
                              </Pill>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
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
