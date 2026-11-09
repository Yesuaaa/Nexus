"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  ListTodo,
  ChevronRight,
  Flag,
  Plus,
  TriangleAlert,
  UsersRound,
} from "lucide-react"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Calendar, calendarDate } from "@/components/ui/calendar"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import {
  calendarConflicts,
  calendarEventStatus,
  type CalendarEvent,
  type CalendarResponse,
} from "../model/calendar"

const eventTypes = {
  consultation: { label: "Consultation", color: "#203f8c", Icon: CalendarDays },
  meeting: { label: "Meeting", color: "#0d9488", Icon: UsersRound },
  milestone: { label: "Milestone", color: "#d97706", Icon: Flag },
  task: { label: "Task deadline", color: "#7c3aed", Icon: ListTodo },
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
const eventRowClass =
  "relative flex items-center gap-2 px-5 py-3 hover:bg-[#f1f5fb] focus-within:bg-[#f1f5fb] max-[560px]:px-4"

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
        className="relative z-10 h-8 shrink-0 bg-[#203f8c] px-3 text-sm text-white hover:bg-[#172f70]"
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
      className="grid size-8 shrink-0 place-items-center text-[#203f8c] after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-[#294a9b]"
    >
      {showChevron && <ChevronRight size={17} aria-hidden="true" />}
    </Link>
  )
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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-[34px] w-[180px] text-xs max-[560px]:h-11 max-[560px]:w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map(({ id, name }) => (
          <SelectItem key={id} value={id}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load your calendar.",
            )
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
  const card =
    "min-w-0 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-5 text-[#182235] shadow-[0_2px_8px_rgb(30_55_80_/_3%)] max-[560px]:p-4"

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
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
          <Button
            variant="outline"
            className="ml-3 h-8 text-xs"
            onClick={() => {
              setLoading(true)
              setRevision((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </p>
      )}
      {!isClient && (
        <section className="mt-4 space-y-2" aria-label="Calendar filters">
          <div className="flex flex-wrap items-center gap-2.5">
            {!organization && canViewTeam && (
              <Select
                value={scope}
                onValueChange={(value) => {
                  setLoading(true)
                  setEvents([])
                  setScope(value)
                  setProjectId("all")
                  setStaffId("all")
                  setDepartmentId("all")
                }}
              >
                <SelectTrigger
                  aria-label="Calendar scope"
                  className="h-[34px] w-[180px] text-xs max-[560px]:h-11 max-[560px]:w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">My schedule</SelectItem>
                  <SelectItem value="team">My team</SelectItem>
                </SelectContent>
              </Select>
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
            {[eventType, projectId, departmentId, staffId].some(
              (value) => value !== "all",
            ) && (
              <Button
                variant="outline"
                className="h-[34px] text-xs max-[560px]:h-11"
                onClick={() => {
                  setEventType("all")
                  setProjectId("all")
                  setDepartmentId("all")
                  setStaffId("all")
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <KpiCards
            metrics={scheduleMetrics}
            label="Schedule overview"
            pending={loading && allEvents.length === 0}
            unavailable={Boolean(error) && allEvents.length === 0}
            showCharts={false}
            className="mt-3 grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
          />
          {organization && (
            <p className="m-0 text-xs leading-5 text-[#52627a]">
              Organization events are shown for planning. Open links are
              available for workflows you can access.
            </p>
          )}
        </section>
      )}
      <div
        className={`${isClient ? "mt-[clamp(30px,4vw,52px)]" : "mt-5"} grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]`}
      >
        <section className={card} aria-label="Month calendar">
          <Calendar
            variant="month"
            value={selected}
            today={today}
            markers={markers}
            onSelect={setSelected}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#e8ebef] pt-4">
            {Object.entries(eventTypes)
              .filter(([key]) => !isClient || key !== "task")
              .map(([, { color, label }]) => (
                <span
                  key={label}
                  className="flex items-center gap-2 text-xs font-medium text-[#52627a]"
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ))}
          </div>
        </section>
        <div className="min-w-0 space-y-5">
          <section className={card} aria-labelledby="calendar-day">
            <h2
              id="calendar-day"
              className="m-0 text-sm leading-5 font-semibold"
              aria-live="polite"
            >
              {dayLabel.format(calendarDate(selected))}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"} ·
              Philippine time
            </p>
            <div className="-mx-5 mt-3 border-t border-[#e8ebef] max-[560px]:-mx-4" />
            {dayEvents.length ? (
              <ul className="-mx-5 max-h-[520px] divide-y divide-[#e8ebef] overflow-y-auto max-[560px]:-mx-4">
                {dayEvents.map((event) => {
                  const { Icon, color, label } = eventTypes[event.type]
                  const { title, staff } = event
                  const status = calendarEventStatus(event, today)
                  const time = event.endsAt
                    ? timeLabel.formatRange(
                        new Date(event.startsAt),
                        new Date(event.endsAt),
                      )
                    : "All day"
                  return (
                    <li key={event.id} className={eventRowClass}>
                      <span
                        title={label}
                        className="grid size-8 shrink-0 place-items-center rounded-md bg-[#edf2f8]"
                        style={{ color }}
                      >
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm leading-5 font-semibold">
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600">
                          {time}
                          {staff && ` · with ${staff}`}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {status && (
                            <span
                              className={`inline-flex rounded-full px-1.5 text-[10px] leading-4 font-medium ${status === "Overdue" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
                            >
                              {status}
                            </span>
                          )}
                          {!isClient && conflicts.has(event.id) && (
                            <span className="text-[10px] leading-4 font-medium text-amber-800">
                              Schedule overlap
                            </span>
                          )}
                          {organization && event.unassigned && (
                            <span className="text-[10px] leading-4 font-medium text-amber-800">
                              Unassigned
                            </span>
                          )}
                        </div>
                        {!isClient && (
                          <p className="mt-0.5 text-xs leading-5 text-slate-600">
                            {event.context}
                          </p>
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
              <p className="mt-4 text-xs leading-5 text-slate-600">
                {emptyMessage}
              </p>
            ) : (
              <div className="mt-4 grid min-h-32 place-items-center px-3 text-center">
                <div>
                  <CalendarDays
                    size={26}
                    className="mx-auto text-[#8293ad]"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                    No events on this day
                  </h3>
                  <p className="text-xs leading-5 text-slate-600">
                    Select a date in the calendar to see its schedule.
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className={card} aria-labelledby="calendar-upcoming">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="calendar-upcoming"
                className="m-0 text-sm leading-5 font-semibold"
              >
                Coming up next
              </h2>
              <span className="text-xs leading-5 text-slate-600">
                Philippine time
              </span>
            </div>
            {comingUp.length ? (
              <ul className="-mx-5 mt-3 divide-y divide-[#e8ebef] border-t border-[#e8ebef] max-[560px]:-mx-4">
                {comingUp.map((event) => {
                  const date = calendarDate(
                    dateKey.format(new Date(event.startsAt)),
                  )
                  return (
                    <li key={event.id} className={`${eventRowClass} flex-wrap`}>
                      <time
                        dateTime={event.startsAt}
                        className="w-10 shrink-0 text-center"
                      >
                        <span className="block overflow-hidden rounded-md border border-[#dfe5ec] bg-white">
                          <span className="block bg-[#203f8c] py-0.5 text-[10px] leading-3 font-semibold uppercase text-white">
                            {monthLabel.format(date)}
                          </span>
                          <span className="block py-0.5 text-base leading-5 font-semibold tabular-nums">
                            {date.getUTCDate()}
                          </span>
                        </span>
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm leading-5 font-semibold">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600">
                          {event.deadline
                            ? "Due this day"
                            : timeLabel.format(new Date(event.startsAt))}
                          {" · "}
                          {event.context}
                        </p>
                      </div>

                      {event.pending && (
                        <span
                          className="rounded-full bg-amber-100 px-1.5 text-[10px] leading-4 font-medium text-amber-800"
                          title="Reschedule pending"
                        >
                          Pending
                        </span>
                      )}
                      <EventRowLink
                        event={event}
                        showChevron={event.id !== nextJoin?.id}
                      />
                      <EventAction
                        event={event}
                        join={event.id === nextJoin?.id}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-4 text-xs leading-5 text-slate-600">
                {emptyMessage ?? "No other upcoming events."}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
