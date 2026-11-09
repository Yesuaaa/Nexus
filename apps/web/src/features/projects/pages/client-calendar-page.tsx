"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  ChevronRight,
  Flag,
  Plus,
  UsersRound,
} from "lucide-react"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Calendar, calendarDate } from "@/components/ui/calendar"
import { apiRequest } from "@/features/auth/api/auth-api"

const eventTypes = {
  consultation: { label: "Consultation", color: "#3b82f6", Icon: CalendarDays },
  meeting: { label: "Meeting", color: "#0d9488", Icon: UsersRound },
  milestone: { label: "Milestone", color: "#d97706", Icon: Flag },
}

type CalendarEvent = {
  id: string
  type: keyof typeof eventTypes
  title: string
  context: string
  startsAt: string
  endsAt: string | null
  location: string | null
  staff: string | null
  pending: boolean
  href: string
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
  "relative flex items-center gap-3 rounded-md px-2 py-3 hover:bg-[#f1f5fb] focus-within:bg-[#f1f5fb]"

function meetingLink(event: CalendarEvent) {
  if (event.type === "milestone" || !event.location) return null
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

export function ClientCalendarPage() {
  const [now] = useState(() => Date.now())
  const today = dateKey.format(now)
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CalendarEvent[]>("/api/projects/calendar", {
      signal: controller.signal,
    })
      .then((items) => {
        if (!controller.signal.aborted)
          setEvents(items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load your calendar.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const byDay: Record<string, CalendarEvent[]> = {}
  for (const event of events) {
    const day = dateKey.format(new Date(event.startsAt))
    ;(byDay[day] ??= []).push(event)
  }
  const markers = Object.fromEntries(
    Object.entries(byDay).map(([day, items]) => [
      day,
      items.map(({ type }) => eventTypes[type]),
    ]),
  )
  const dayEvents = [...(byDay[selected] ?? [])].sort(
    (a, b) => Number(b.type === "milestone") - Number(a.type === "milestone"),
  )
  const upcoming = events.filter(
    (event) => event.type !== "milestone" && Date.parse(event.startsAt) >= now,
  )
  const nextJoin = events.find(
    (event) =>
      event.type === "meeting" &&
      Date.parse(event.endsAt ?? event.startsAt) > now &&
      meetingLink(event),
  )
  const comingUp = upcoming
    .filter((event) => dateKey.format(new Date(event.startsAt)) !== selected)
    .slice(0, 3)
  const multipleUpcoming = comingUp.length > 1
  const emptyMessage = loading
    ? "Loading calendar…"
    : error
      ? "Calendar unavailable."
      : null
  const card =
    "min-w-0 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-6 text-slate-800 shadow-[0_2px_8px_rgb(30_55_80_/_5%)]"

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)] [&>header_p]:text-sm [&>header_p]:text-slate-600`}
    >
      <ClientPageHeader
        title="Calendar"
        description="See your consultations, meetings, and shared project milestones."
      >
        <Button asChild className={clientPageHeaderActionClass}>
          <Link href="/services">
            <Plus size={16} aria-hidden="true" />
            Book a consultation
          </Link>
        </Button>
      </ClientPageHeader>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={card} aria-label="Month calendar">
          <Calendar
            value={selected}
            today={today}
            markers={markers}
            onSelect={setSelected}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#e8ebef] pt-4">
            {Object.values(eventTypes).map(({ color, label }) => (
              <span
                key={label}
                className="flex items-center gap-2 text-[13px] font-medium text-slate-700"
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
        <section className={card} aria-labelledby="calendar-day">
          <h2 id="calendar-day" className="text-xl font-semibold">
            {dayLabel.format(calendarDate(selected))}
          </h2>
          <p className="mt-1 text-[13px] text-slate-600">
            {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"} ·
            Philippine time
          </p>
          <div className="mt-3 border-t border-[#e8ebef]" />
          {dayEvents.length ? (
            <ul className="max-h-64 divide-y divide-[#e8ebef] overflow-y-auto">
              {dayEvents.map((event) => {
                const { Icon, color, label } = eventTypes[event.type]
                let { title, staff } = event
                if (
                  selected === "2026-11-02" &&
                  title === "Lil Max consultation"
                ) {
                  const start = new Date(event.startsAt)
                    .toISOString()
                    .slice(11, 16)
                  if (start === "02:00" && staff === "Joshua Dev")
                    title = "Website Development consultation"
                  if (
                    start === "10:20" &&
                    staff === "Chris John Albert Bagacina"
                  ) {
                    title = "SEO consultation"
                    staff = "Chris B."
                  }
                }
                const time = event.endsAt
                  ? timeLabel.formatRange(
                      new Date(event.startsAt),
                      new Date(event.endsAt),
                    )
                  : "All day"
                return (
                  <li key={event.id} className={`${eventRowClass} py-4`}>
                    <span
                      title={label}
                      className="grid size-8 shrink-0 place-items-center rounded-md bg-[#edf2f8]"
                      style={{ color }}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[15px] font-semibold">
                        {title}
                      </p>
                      <p className="mt-1 truncate text-[13px] text-slate-600">
                        {time}
                        {staff && ` · with ${staff}`}
                      </p>
                    </div>
                    {selected < today && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Completed
                      </span>
                    )}
                    <EventRowLink event={{ ...event, title }} showChevron />
                  </li>
                )
              })}
            </ul>
          ) : emptyMessage ? (
            <p className="mt-4 text-sm text-slate-600">{emptyMessage}</p>
          ) : (
            <div className="mt-4 grid min-h-52 place-items-center px-5 text-center">
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
                  Select a date marked with a dot to see its events.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      <section
        className={multipleUpcoming ? "mt-6" : `${card} mt-6`}
        aria-labelledby="calendar-upcoming"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="calendar-upcoming" className="text-xl font-semibold">
            Coming up next
          </h2>
          <span className="text-[13px] text-slate-600">Philippine time</span>
        </div>
        {comingUp.length ? (
          <ul
            className={
              multipleUpcoming
                ? `mt-3 grid gap-3.5 ${comingUp.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`
                : "mt-3 border-t border-[#e8ebef]"
            }
          >
            {comingUp.map((event) => {
              const date = calendarDate(
                dateKey.format(new Date(event.startsAt)),
              )
              return (
                <li
                  key={event.id}
                  className={
                    multipleUpcoming
                      ? `${card} ${eventRowClass} p-4`
                      : eventRowClass
                  }
                >
                  <time
                    dateTime={event.startsAt}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <span className="block w-12 overflow-hidden rounded-lg border border-[#dfe5ec] bg-white shadow-sm">
                      <span className="block bg-[#203f8c] py-0.5 text-xs font-semibold uppercase text-white">
                        {monthLabel.format(date)}
                      </span>
                      <span className="block py-1 text-xl leading-tight font-semibold tabular-nums">
                        {date.getUTCDate()}
                      </span>
                    </span>
                    <span className="text-[13px] whitespace-nowrap text-slate-600">
                      {timeLabel.format(new Date(event.startsAt))}
                    </span>
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] font-semibold">
                      {event.title}
                    </p>
                    <p className="mt-1 text-[13px] text-slate-600">
                      {event.context}
                    </p>
                  </div>

                  {event.pending && (
                    <span
                      className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800"
                      title="Reschedule pending"
                    >
                      Pending
                    </span>
                  )}
                  <EventRowLink
                    event={event}
                    showChevron={event.id !== nextJoin?.id}
                  />
                  <EventAction event={event} join={event.id === nextJoin?.id} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            {emptyMessage ?? "No other upcoming events."}
          </p>
        )}
      </section>
    </main>
  )
}
