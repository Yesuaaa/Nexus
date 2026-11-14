"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  ListTodo,
  ChevronRight,
  Plus,
  TriangleAlert,
  UsersRound,
} from "lucide-react"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar, calendarDate } from "@/components/ui/calendar"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import { pillToneClass, type PillTone } from "@/components/ui/pill"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { FilterSelect, filterGridClass } from "@/components/ui/filter-select"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import {
  calendarConflicts,
  calendarEventStatus,
  type CalendarEvent,
  type CalendarResponse,
} from "../model/calendar"
import { errorMessage } from "@/lib/error-message"
import { cn } from "@/lib/utils"

const eventTypes = {
  consultation: { label: "Consultation", color: "#203f8c" },
  meeting: { label: "Meeting", color: "#0d9488" },
  milestone: { label: "Milestone", color: "#d97706" },
  task: { label: "Task deadline", color: "#7c3aed" },
}

const timezone = "Asia/Manila"
const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone })
const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})
const timeLabel = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: timezone,
})
const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
})
// Agenda rows: borderless, a soft hover wash, and a stretched link overlay.
const eventRowClass =
  "group relative -mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[#f6f8fb] focus-within:bg-[#f6f8fb] motion-reduce:transition-none"
const mutedText = "text-xs leading-5 text-[#8a94a6]"
const tag = "inline-flex rounded-full px-1.5 text-[10px] leading-4 font-medium"

function meetingLink(event: CalendarEvent) {
  if (!event.endsAt || !event.location) return null
  try {
    const url = new URL(event.location)
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

function EventAction({
  event,
  join = false,
}: {
  event: CalendarEvent
  join?: boolean
}) {
  const url = join ? meetingLink(event) : null
  if (url)
    return (
      <Button
        asChild
        variant="brand"
        size="sm"
        className="relative z-10 mt-2 shrink-0"
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          Join meeting
        </a>
      </Button>
    )
  return null
}

function EventRowLink({
  event,
  showChevron,
}: {
  event: CalendarEvent
  showChevron: boolean
}) {
  if (!event.href) return null
  return (
    <Link
      href={event.href}
      aria-label={`View ${event.title}`}
      className="grid size-7 shrink-0 place-items-center self-center text-[#9aa4b5] transition-colors group-hover:text-[#203f8c] after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-[#294a9b] motion-reduce:transition-none"
    >
      {showChevron && <ChevronRight size={16} aria-hidden="true" />}
    </Link>
  )
}

function Tag({ tone, children }: { tone: PillTone; children: string }) {
  return <span className={cn(tag, pillToneClass(tone))}>{children}</span>
}

function CalendarFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string }[]
}) {
  return (
    <FilterSelect
      label={label}
      value={value}
      onChange={onChange}
      triggerClassName="w-[170px]"
      options={[
        { value: "all", label: `All ${label.toLowerCase()}` },
        ...options.map(({ id, name }) => ({ value: id, label: name })),
      ]}
    />
  )
}

export function CalendarPage() {
  const account = usePortalAccount()
  const isClient = account.role === "USER"
  const organization = account.role === "ADMIN" || account.role === "SUPERADMIN"
  const [scope, setScope] = useState("mine")
  const [canViewTeam, setCanViewTeam] = useState(false)
  const [eventType, setEventType] = useState("all")
  const [projectId, setProjectId] = useState("all")
  const [departmentId, setDepartmentId] = useState("all")
  const [staffId, setStaffId] = useState("all")
  const [now, setNow] = useState(() => Date.now())
  const today = dateKey.format(now)
  const [selected, setSelected] = useState(today)
  const [allEvents, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let inFlight = false
    const load = () => {
      if (inFlight) return
      inFlight = true
      apiRequest<CalendarEvent[] | CalendarResponse>(
        `/api/projects/calendar${isClient ? "" : `?scope=${scope}`}`,
        {
          signal: controller.signal,
        },
      )
        .then((response) => {
          if (!controller.signal.aborted) {
            const items = Array.isArray(response) ? response : response.events
            setEvents(
              items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
            )
            setCanViewTeam(!Array.isArray(response) && response.canViewTeam)
            setError("")
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setEvents([])
            setError(errorMessage(reason, "Could not load your calendar."))
          }
        })
        .finally(() => {
          inFlight = false
          if (!controller.signal.aborted) setLoading(false)
        })
    }
    load()
    const stopRefresh = watchVisibleRefresh(load, { poll: false })
    return () => {
      controller.abort()
      stopRefresh()
    }
  }, [isClient, scope, revision, account.id])

  const events = allEvents.filter(
    (event) =>
      (eventType === "all" || event.type === eventType) &&
      (projectId === "all" || event.project?.id === projectId) &&
      (departmentId === "all" || event.department?.id === departmentId) &&
      (staffId === "all" ||
        event.staffMembers?.some(({ id }) => id === staffId)),
  )
  const options = (items: { id: string; name: string }[]) =>
    [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  const conflicts = calendarConflicts(allEvents, now)
  const overdue = events.filter(
    (event) => calendarEventStatus(event, today) === "Overdue",
  ).length
  const conflictCount = events.filter((event) => conflicts.has(event.id)).length
  const unassigned = events.filter(
    (event) =>
      event.type === "consultation" &&
      event.unassigned &&
      !event.completed &&
      Date.parse(event.endsAt ?? event.startsAt) > now,
  ).length
  const scheduleMetrics: KpiMetric[] = [
    {
      label: "Scheduled events",
      value: events.length,
      description: organization
        ? "Visible organization events"
        : "Events on your schedule",
      icon: CalendarDays,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Overdue tasks",
      value: overdue,
      description: "Unfinished past deadlines",
      icon: ListTodo,
      iconClassName: "text-[#d97706]",
    },
    {
      label: "Overlapping appointments",
      value: conflictCount,
      description: "Events sharing staff",
      icon: TriangleAlert,
      iconClassName: "text-[#b78112]",
    },
    {
      label: "Unassigned consultations",
      value: unassigned,
      description: "Upcoming consultations",
      icon: UsersRound,
      iconClassName: "text-[#159447]",
    },
  ]

  const byDay: Record<string, CalendarEvent[]> = {}
  for (const event of events) {
    const day = dateKey.format(new Date(event.startsAt))
    ;(byDay[day] ??= []).push(event)
  }
  const markers = Object.fromEntries(
    Object.entries(byDay).map(([day, items]) => [
      day,
      items.map(({ type, title }) => ({ ...eventTypes[type], title })),
    ]),
  )
  const dayEvents = [...(byDay[selected] ?? [])].sort(
    (a, b) => Number(b.type === "milestone") - Number(a.type === "milestone"),
  )
  const upcoming = events.filter(
    (event) =>
      event.type !== "milestone" &&
      !event.completed &&
      (event.deadline
        ? dateKey.format(new Date(event.startsAt)) >= today
        : Date.parse(event.endsAt ?? event.startsAt) >= now),
  )
  const nextJoin = events.find(
    (event) =>
      event.type === "meeting" &&
      !event.completed &&
      Date.parse(event.startsAt) <= now + 15 * 60_000 &&
      Date.parse(event.endsAt ?? event.startsAt) > now &&
      meetingLink(event),
  )
  const comingUp = upcoming
    .filter((event) => dateKey.format(new Date(event.startsAt)) !== selected)
    .slice(0, 3)
  const emptyMessage = loading
    ? "Loading calendar…"
    : error
      ? "Calendar unavailable."
      : null
  const hasFilters = [eventType, projectId, departmentId, staffId].some(
    (value) => value !== "all",
  )

  return (
    <main
      className={`${contentClass} p-[clamp(20px,2.1vw,32px)]`}
      aria-label="Your calendar"
    >
      <ClientPageHeader
        eyebrow="Schedule"
        title="Calendar"
        description={
          isClient
            ? "See your consultations, meetings, and shared project milestones."
            : organization
              ? "Follow schedules and deadlines across departments and projects."
              : "Keep track of your assigned work, meetings, and project deadlines."
        }
      >
        {isClient && (
          <Button asChild className={clientPageHeaderActionClass}>
            <Link href="/services">
              <Plus size={16} aria-hidden="true" />
              Book a consultation
            </Link>
          </Button>
        )}
      </ClientPageHeader>
      {error && (
        <Alert variant="text" className="mt-4 text-sm">
          {error}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => {
              setLoading(true)
              setRevision((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </Alert>
      )}
      {!isClient && (
        <section className="mt-6 space-y-4" aria-label="Calendar filters">
          <div className={filterGridClass}>
            {!organization && canViewTeam && (
              <FilterSelect
                label="Calendar scope"
                value={scope}
                triggerClassName="w-[170px]"
                options={[
                  { value: "mine", label: "My schedule" },
                  { value: "team", label: "My team" },
                ]}
                onChange={(value) => {
                  setLoading(true)
                  setEvents([])
                  setScope(value)
                  setProjectId("all")
                  setStaffId("all")
                  setDepartmentId("all")
                }}
              />
            )}
            <CalendarFilter
              label="Event types"
              value={eventType}
              onChange={setEventType}
              options={Object.entries(eventTypes).map(([id, item]) => ({
                id,
                name: item.label,
              }))}
            />
            <CalendarFilter
              label="Projects"
              value={projectId}
              onChange={setProjectId}
              options={options(
                allEvents.flatMap((event) =>
                  event.project ? [event.project] : [],
                ),
              )}
            />
            {organization && (
              <>
                <CalendarFilter
                  label="Departments"
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={options(
                    allEvents.flatMap((event) =>
                      event.department ? [event.department] : [],
                    ),
                  )}
                />
                <CalendarFilter
                  label="Staff"
                  value={staffId}
                  onChange={setStaffId}
                  options={options(
                    allEvents.flatMap((event) => event.staffMembers ?? []),
                  )}
                />
              </>
            )}
            {hasFilters && (
              <button
                type="button"
                className={cn(
                  "h-[34px] cursor-pointer rounded-lg px-2.5 text-xs font-medium text-[#52627a] transition-colors hover:bg-[#f3f5f8] hover:text-[#182235] motion-reduce:transition-none max-[560px]:h-11",
                  focusRing,
                )}
                onClick={() => {
                  setEventType("all")
                  setProjectId("all")
                  setDepartmentId("all")
                  setStaffId("all")
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <KpiCards
            metrics={scheduleMetrics}
            label="Schedule overview"
            pending={loading && allEvents.length === 0}
            unavailable={Boolean(error) && allEvents.length === 0}
            showCharts={false}
            className="grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:gap-2"
          />
          {organization && (
            <p className={cn(mutedText, "m-0")}>
              Organization events are shown for planning. Open links are
              available for workflows you can access.
            </p>
          )}
        </section>
      )}
      <div
        className={cn(
          isClient ? "mt-[clamp(30px,4vw,52px)]" : "mt-8",
          "grid items-start gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1fr)_320px]",
        )}
      >
        <section className="min-w-0" aria-label="Month calendar">
          <Calendar
            variant="month"
            value={selected}
            today={today}
            markers={markers}
            onSelect={setSelected}
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {Object.entries(eventTypes)
              .filter(([key]) => !isClient || key !== "task")
              .map(([, { color, label }]) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 text-[11px] text-[#738096]"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ))}
          </div>
        </section>
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="calendar-day">
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="calendar-day"
                className="m-0 text-base font-semibold tracking-[-0.01em] text-[#101d35]"
                aria-live="polite"
              >
                {dayLabel.format(calendarDate(selected))}
              </h2>
              <span className={cn(mutedText, "shrink-0 tabular-nums")}>
                {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
              </span>
            </div>
            <p className={cn(mutedText, "m-0")}>Philippine time</p>
            {dayEvents.length ? (
              <ul className="mt-3 max-h-[520px] list-none space-y-0.5 overflow-y-auto p-0">
                {dayEvents.map((event) => {
                  const { color, label } = eventTypes[event.type]
                  const { title, staff } = event
                  const status = calendarEventStatus(event, today)
                  const overlap = !isClient && conflicts.has(event.id)
                  const needsStaff = organization && event.unassigned
                  const time = event.endsAt
                    ? timeLabel.formatRange(
                        new Date(event.startsAt),
                        new Date(event.endsAt),
                      )
                    : "All day"
                  const details = [
                    staff && `with ${staff}`,
                    !isClient && event.context,
                  ].filter(Boolean)
                  return (
                    <li key={event.id} className={eventRowClass}>
                      <span
                        className="w-[3px] shrink-0 self-stretch rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[11px] leading-4 text-[#8a94a6] tabular-nums">
                          {time} · {label}
                        </p>
                        <p className="m-0 mt-0.5 text-sm leading-5 font-medium break-words text-[#182235]">
                          {title}
                        </p>
                        {details.length > 0 && (
                          <p className={cn(mutedText, "m-0 break-words")}>
                            {details.join(" · ")}
                          </p>
                        )}
                        {(status || overlap || needsStaff) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {status && (
                              <Tag
                                tone={
                                  status === "Overdue" ? "danger" : "success"
                                }
                              >
                                {status}
                              </Tag>
                            )}
                            {overlap && (
                              <Tag tone="warning">Schedule overlap</Tag>
                            )}
                            {needsStaff && <Tag tone="warning">Unassigned</Tag>}
                          </div>
                        )}
                        <EventAction
                          event={event}
                          join={event.id === nextJoin?.id}
                        />
                      </div>
                      <EventRowLink event={{ ...event, title }} showChevron />
                    </li>
                  )
                })}
              </ul>
            ) : emptyMessage ? (
              <p className={cn(mutedText, "mt-4 mb-0")}>{emptyMessage}</p>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#e3e7ed] px-4 py-7 text-center">
                <h3 className="m-0 text-sm font-medium text-[#3b4658]">
                  No events on this day
                </h3>
                <p className={cn(mutedText, "mt-1 mb-0")}>
                  Select a date in the calendar to see its schedule.
                </p>
              </div>
            )}
          </section>
          <section
            aria-labelledby="calendar-upcoming"
            className="border-t border-[#eceef2] pt-6"
          >
            <h2
              id="calendar-upcoming"
              className="m-0 text-sm font-semibold text-[#101d35]"
            >
              Coming up next
            </h2>
            {comingUp.length ? (
              <ul className="mt-3 list-none space-y-0.5 p-0">
                {comingUp.map((event) => {
                  const date = calendarDate(
                    dateKey.format(new Date(event.startsAt)),
                  )
                  return (
                    <li key={event.id} className={eventRowClass}>
                      <time
                        dateTime={event.startsAt}
                        className="w-9 shrink-0 pt-0.5 text-center leading-none"
                      >
                        <span className="block text-[10px] font-medium tracking-wide text-[#8a94a6] uppercase">
                          {monthLabel.format(date)}
                        </span>
                        <span className="mt-1 block text-base font-semibold tabular-nums text-[#182235]">
                          {date.getUTCDate()}
                        </span>
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm leading-5 font-medium break-words text-[#182235]">
                          {event.title}
                        </p>
                        <p className={cn(mutedText, "m-0 break-words")}>
                          {event.deadline
                            ? "Due this day"
                            : timeLabel.format(new Date(event.startsAt))}
                          {" · "}
                          {event.context}
                        </p>
                        {event.pending && (
                          <div className="mt-1.5" title="Reschedule pending">
                            <Tag tone="warning">Pending</Tag>
                          </div>
                        )}
                        <EventAction
                          event={event}
                          join={event.id === nextJoin?.id}
                        />
                      </div>
                      <EventRowLink
                        event={event}
                        showChevron={event.id !== nextJoin?.id}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className={cn(mutedText, "mt-3 mb-0")}>
                {emptyMessage ?? "No other upcoming events."}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
