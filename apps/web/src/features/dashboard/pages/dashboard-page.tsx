"use client"

import { useCurrentTime } from "@/lib/use-current-time"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import { useAsyncResource } from "@/lib/use-async-resource"
import { apiRequest } from "@/features/auth/api/auth-api"
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
import { useWorkflowInbox } from "@/features/workflow-notifications/components/workflow-notification-provider"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, CircleCheck, FileText } from "lucide-react"
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
import { cn } from "@/lib/utils"
import {
  actions as sampleActions,
  appointment as sampleAppointment,
  projects as sampleProjects,
  requests as sampleRequests,
  updates as sampleUpdates,
  type PreviewState,
} from "../model/dashboard-preview"

const textLink = cn(
  "inline-flex min-h-9 items-center gap-1.5 rounded-sm text-xs font-semibold text-[#203f8c] hover:underline focus-visible:underline",
  focusRing,
)
const sectionHeading = "text-[22px] leading-tight font-semibold tracking-tight"
const itemTitle =
  "min-w-0 [overflow-wrap:anywhere] text-[15px] leading-snug font-semibold"
const metadata =
  "mt-1 [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground"
const updateIcons = {
  plan: FileText,
  calendar: CalendarDays,
  milestone: CircleCheck,
}
const activityKinds = new Map<string, keyof typeof updateIcons>([
  ["CONSULTATION_SCHEDULED", "calendar"],
  ["CONSULTATION_RESCHEDULE_CONFIRMED", "calendar"],
  ["CONSULTATION_COMPLETED", "calendar"],
  ["CONSULTATION_CANCELLED", "calendar"],
  ["PROJECT_ACTIVATED", "plan"],
  ["PROJECT_MILESTONE_UPDATED", "milestone"],
  ["PROJECT_DELIVERABLE_SENT_TO_CLIENT", "milestone"],
  ["DELIVERABLE_CLIENT_REVIEWED", "milestone"],
  ["QUOTATION_SENT", "plan"],
  ["REQUIREMENT_REQUESTED", "plan"],
  ["APPROVAL_CONFIRMED", "plan"],
])
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
      View all <ArrowRight size={14} aria-hidden="true" />
    </Link>
  )
}

export function DashboardPage({
  preview,
}: {
  preview?: { state: PreviewState; startsAt: string }
}) {
  const account = usePortalAccount()
  const inbox = useWorkflowInbox()
  const now = useCurrentTime()
  const enabled = account.role === "USER" && !preview
  const projectData = useAsyncResource(listClientProjects, [account.id], {
    enabled,
  })
  const requestData = useAsyncResource(
    (signal) => listMyServiceRequests({ page: 1, sortOrder: "desc", signal }),
    [account.id],
    { enabled },
  )
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [actionPage, setActionPage] = useState(1)
  const actionData = useAsyncResource(
    (signal) => listClientOutstandingActions(actionPage, signal),
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
      return (Array.isArray(response) ? response : response.events)
        .filter(
          (event) =>
            (event.type === "consultation" || event.type === "meeting") &&
            !event.pending &&
            !event.completed,
        )
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    },
    [account.id],
    { enabled },
  )
  if (account.role !== "USER") return null
  const firstName = account.fullName?.trim().split(/\s+/)[0]
  const projects = preview
    ? sampleProjects.map((item) => ({ ...item, id: item.name, href: null }))
    : (projectData.data ?? [])
        .filter(
          (item) => item.status === "IN_PROGRESS" || item.status === "ON_HOLD",
        )
        .slice(0, 2)
        .map((item) => ({
          ...item,
          service: item.request?.service.name,
          team: [],
          lead: null,
          href: "/projects/" + encodeURIComponent(item.id),
        }))
  const requests = preview
    ? sampleRequests.map((item) => ({ ...item, id: item.reference }))
    : (requestData.data?.requests ?? []).slice(0, 2).map((item) => ({
        id: item.id,
        reference: item.referenceNumber,
        service: item.title || item.service.name,
        status: item.status,
        date: item.createdAt,
      }))
  const actions: ClientOutstandingAction[] = preview
    ? sampleActions.map((item) => ({
        ...item,
        id: item.reference,
        requestId: item.reference,
      }))
    : (actionData.data?.actions ?? []).slice(0, actionsExpanded ? undefined : 2)
  const actionTotal = preview ? actions.length : (actionData.data?.total ?? 0)
  const actionPages = Math.max(
    actionPage,
    Math.ceil(actionTotal / (actionData.data?.pageSize ?? 10)),
  )

  const seen = new Set<string>()
  const updates = preview
    ? sampleUpdates.map((item) => ({ ...item, id: item.title }))
    : (inbox.result?.notifications ?? [])
        .flatMap((item) => {
          const kind = activityKinds.get(item.type)
          if (!item.requestId || !kind || !item.summary) return []
          if (seen.has(item.id)) return []
          seen.add(item.id)
          return [
            {
              id: item.id,
              kind,
              title: item.summary,
              context: null,
              date: item.createdAt,
            },
          ]
        })
        .slice(0, 3)
  const event = calendarData.data?.find(
    (item) => Date.parse(item.startsAt) > now,
  )
  const appointment = preview
    ? sampleAppointment
    : event
      ? {
          title: event.title,
          project: event.project?.name ?? event.context,
          location: event.location?.includes("://") ? "Online" : event.location,
        }
      : null
  const startsAt = preview?.startsAt ?? event?.startsAt
  const date = startsAt ? new Date(startsAt) : null
  const month =
    date &&
    new Intl.DateTimeFormat("en-PH", {
      month: "short",
      timeZone: calendarTimeZone,
    }).format(date)
  const day =
    date &&
    new Intl.DateTimeFormat("en-PH", {
      day: "numeric",
      timeZone: calendarTimeZone,
    }).format(date)
  const time = date && calendarTimeLabel.format(date)
  const projectState =
    preview?.state ?? resourceState(projectData, projects.length > 0)
  const requestState =
    preview?.state ?? resourceState(requestData, requests.length > 0)
  const calendarState =
    preview?.state ?? resourceState(calendarData, !!appointment)
  const actionState =
    preview?.state ?? resourceState(actionData, actions.length > 0)
  const updateState =
    preview?.state ??
    resourceState(
      { loading: !inbox.result && !inbox.error, error: inbox.error },
      updates.length > 0,
    )
  return (
    <main
      className={cn(
        contentClass,
        "px-[clamp(16px,2.1vw,32px)] py-6 min-[1024px]:[@media(max-height:880px)]:py-3",
      )}
      aria-label="Client dashboard"
    >
      <PageHeader
        tone="client"
        mobileActions="stack"
        className="min-[1024px]:[@media(max-height:880px)]:pb-2"
        title={firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Your projects and requests, in one place.{" "}
            {preview && <Pill tone="brand">Preview · Sample data</Pill>}
          </span>
        }
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/services">Explore Services</Link>
          </Button>
        }
      />

      <section
        aria-labelledby="next-up"
        className="mt-5 grid min-h-44 items-center gap-5 rounded-[13px] bg-[#203f8c] px-[clamp(18px,3vw,48px)] py-6 text-white min-[1024px]:[@media(max-height:880px)]:mt-3 min-[1024px]:[@media(max-height:880px)]:min-h-32 min-[1024px]:[@media(max-height:880px)]:py-3 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_auto]"
      >
        <div>
          <h2
            id="next-up"
            tabIndex={-1}
            className="text-xs font-semibold tracking-widest uppercase"
          >
            Next Up
          </h2>
          {calendarState === "loaded" && appointment && startsAt ? (
            <>
              <p className="mt-2 [overflow-wrap:anywhere] text-[clamp(22px,2.4vw,32px)] leading-tight font-semibold tracking-tight">
                {appointment.title}
              </p>
              <p className="mt-1 [overflow-wrap:anywhere] text-sm text-white/85">
                {appointment.project}
              </p>
            </>
          ) : calendarState === "loading" ? (
            <div role="status" className="mt-3 grid gap-2">
              <span className="sr-only">Loading appointment…</span>
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <p
              className="mt-2 text-xl font-semibold"
              role={calendarState === "error" ? "alert" : undefined}
            >
              {calendarState === "empty"
                ? "No upcoming appointments"
                : "Could not load your schedule"}
            </p>
          )}
        </div>
        <div className="md:border-l md:border-white/25 md:pl-6">
          {calendarState === "loaded" && appointment && startsAt && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <CalendarDays size={18} aria-hidden="true" />
                <time dateTime={startsAt}>{time} PHT</time>
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {appointment.location ?? "Confirmed"}
              </span>
            </p>
          )}
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
        {calendarState === "loaded" && appointment && startsAt && (
          <time
            dateTime={startsAt}
            aria-label={requestDate(startsAt)}
            className="grid w-fit min-w-20 justify-items-center rounded-xl bg-white/15 px-4 py-3 md:min-w-24"
          >
            <span className="text-xs font-semibold uppercase">{month}</span>
            <span className="text-4xl leading-tight font-semibold tabular-nums">
              {day}
            </span>
          </time>
        )}
      </section>

      <div className="mt-5 grid min-w-0 items-stretch gap-x-5 gap-y-5 min-[1024px]:[@media(max-height:880px)]:mt-3 min-[1024px]:[@media(max-height:880px)]:gap-y-3 min-[1024px]:grid-cols-[repeat(2,minmax(0,1fr))]">
        <section
          aria-labelledby="active-projects"
          className="min-w-0 rounded-[13px] border border-border bg-card px-4 py-3 min-[1024px]:[@media(max-height:880px)]:py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 id="active-projects" tabIndex={-1} className={sectionHeading}>
              Active Projects
            </h2>
            <ViewAll href="/projects" label="View all projects" />
          </div>
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
                              className={cn("hover:underline", focusRing)}
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
                      <ul
                        aria-label="Preview project team"
                        className="flex shrink-0 -space-x-2"
                      >
                        {project.team.map((member) => (
                          <li
                            key={member}
                            title={member}
                            className="rounded-full ring-2 ring-card"
                          >
                            <span className="sr-only">{member}</span>
                            <Avatar name={member} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-1 grid items-center gap-x-3 gap-y-2 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(4rem,0.65fr)_auto]">
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
                          {project.completedTasks} of {project.taskCount} tasks
                        </span>
                        <strong>{percent}%</strong>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </SectionContent>
        </section>

        <section
          aria-labelledby="client-input"
          className="min-w-0 rounded-[13px] border border-border bg-[#e8eef9] px-4 py-3 min-[1024px]:[@media(max-height:880px)]:py-2"
        >
          <div className="mb-2 min-[1024px]:[@media(max-height:880px)]:mb-0 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="client-input" tabIndex={-1} className={sectionHeading}>
              Needs Your Input
            </h2>
            {actionState === "loaded" && (
              <Pill tone="warning">
                {actionTotal} {actionTotal === 1 ? "action" : "actions"}
              </Pill>
            )}
          </div>
          <div id="dashboard-client-action-list">
            <SectionContent
              headingId="client-input"
              state={actionState}
              retry={preview ? undefined : retryActions}
              empty={preview ? "You’re all caught up" : "No pending actions"}
            >
              <ul className="divide-y divide-border">
                {actions.map((action) => (
                  <li
                    key={action.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 py-3 min-[1024px]:[@media(max-height:880px)]:py-1.5"
                  >
                    <div className="min-w-0">
                      <h3
                        className={itemTitle}
                        id={"dashboard-action-" + action.id}
                      >
                        {action.title}
                      </h3>
                      <p className={metadata}>
                        {action.service}
                        {action.reference && <> · {action.reference}</>}
                      </p>
                      <p className={metadata}>
                        {action.reason}
                        {action.deadline && (
                          <>
                            {" "}
                            · Respond by{" "}
                            <time dateTime={action.deadline}>
                              {requestDate(action.deadline)}
                            </time>
                          </>
                        )}
                      </p>
                    </div>
                    <Link
                      href={action.destination ?? "/service-requests"}
                      aria-describedby={"dashboard-action-" + action.id}
                      className={textLink}
                    >
                      {action.destination
                        ? "Open deliverable"
                        : "Find in Booked Requests"}
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionContent>
          </div>
          {!preview &&
            (actionsExpanded ||
              (actionState === "loaded" && actionTotal > 2)) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                  {actionsExpanded ? "Show fewer actions" : "Show all actions"}
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
          className="min-w-0 self-start rounded-[13px] border border-border bg-card px-4 py-3 min-[1024px]:[@media(max-height:880px)]:py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 id="booked-requests" tabIndex={-1} className={sectionHeading}>
              Booked Requests
            </h2>
            <ViewAll
              href="/service-requests"
              label="View all booked requests"
            />
          </div>
          <SectionContent
            headingId="booked-requests"
            state={requestState}
            retry={preview ? undefined : requestData.retry}
            empty="No booked requests"
          >
            <ul className="divide-y divide-border">
              {requests.map((request) => {
                const status = serviceRequestStatuses[request.status]
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
                        {request.reference && <>{request.reference} · </>}
                        <time dateTime={request.date}>
                          {requestDate(request.date)}
                        </time>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3">
                      <Pill tone={status.tone}>{status.label}</Pill>
                      <Link
                        href="/service-requests"
                        className={textLink}
                        aria-describedby={"dashboard-request-" + request.id}
                      >
                        Find in Booked Requests
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </SectionContent>
        </section>

        <section
          aria-labelledby="recent-updates"
          className="min-w-0 rounded-[13px] border border-border bg-card px-4 py-3 min-[1024px]:[@media(max-height:880px)]:py-2"
        >
          <h2
            id="recent-updates"
            tabIndex={-1}
            className={cn(
              sectionHeading,
              "mb-2 min-[1024px]:[@media(max-height:880px)]:mb-0 flex min-h-9 items-center",
            )}
          >
            Recent Updates
          </h2>
          <SectionContent
            headingId="recent-updates"
            state={updateState}
            retry={preview ? undefined : inbox.load}
            empty="No recent updates"
          >
            <ul className="divide-y divide-border">
              {updates.map((update) => {
                const Icon = updateIcons[update.kind]
                return (
                  <li
                    key={update.id}
                    className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2 min-[1024px]:[@media(max-height:880px)]:min-h-11 min-[1024px]:[@media(max-height:880px)]:py-1"
                  >
                    <Icon
                      size={16}
                      className="text-[#203f8c]"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                      <div>
                        <h3 className={itemTitle}>{update.title}</h3>
                        {update.context && (
                          <p className={metadata}>{update.context}</p>
                        )}
                      </div>
                      <time
                        dateTime={update.date}
                        className="text-xs text-muted-foreground"
                      >
                        {requestDate(update.date)}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ul>
          </SectionContent>
        </section>
      </div>
    </main>
  )
}
