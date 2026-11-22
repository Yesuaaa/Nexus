export type CalendarEvent = {
  id: string
  type: "consultation" | "meeting" | "milestone" | "task" | "leave"
  title: string
  context: string
  startsAt: string
  endsAt: string | null
  location: string | null
  staff: string | null
  pending: boolean
  href: string | null
  completed?: boolean
  deadline?: boolean
  unassigned?: boolean
  timeZone?: string
  allDay?: boolean
  startDate?: string
  endDateExclusive?: string
  staffMembers?: { id: string; name: string }[]
  department?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
}

export type CalendarResponse = {
  events: CalendarEvent[]
  canViewTeam: boolean
  organization: boolean
}

export function calendarEventDate(event: CalendarEvent) {
  return event.allDay && event.startDate
    ? event.startDate
    : new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila" }).format(
        new Date(event.startsAt),
      )
}

export function calendarEventStatus(event: CalendarEvent, today: string) {
  if (event.completed) return "Completed"
  if (
    event.deadline &&
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila" }).format(
      new Date(event.startsAt),
    ) < today
  )
    return "Overdue"
  return null
}

export function calendarConflicts(events: CalendarEvent[], now: number) {
  const conflicts = new Set<string>()
  const timed = events
    .filter(
      (event) =>
        !event.allDay &&
        !event.completed &&
        event.endsAt &&
        Date.parse(event.endsAt) > now,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  for (let index = 0; index < timed.length; index++) {
    const first = timed[index]
    for (const second of timed.slice(index + 1)) {
      if (Date.parse(second.startsAt) >= Date.parse(first.endsAt!)) break
      if (
        first.staffMembers?.some((person) =>
          second.staffMembers?.some(({ id }) => id === person.id),
        )
      ) {
        conflicts.add(first.id)
        conflicts.add(second.id)
      }
    }
  }
  const leaveByPerson = new Map<string, CalendarEvent[]>()
  for (const leave of events) {
    if (leave.type !== "leave" || !leave.startDate || !leave.timeZone) continue
    for (const person of leave.staffMembers ?? []) {
      const days = leaveByPerson.get(person.id) ?? []
      days.push(leave)
      leaveByPerson.set(person.id, days)
    }
  }
  const formatters = new Map<string, Intl.DateTimeFormat>()
  const tasks = events.filter(
    (event) => event.type === "task" && !event.completed,
  )
  for (const item of [...timed, ...tasks]) {
    for (const person of item.staffMembers ?? []) {
      for (const leave of leaveByPerson.get(person.id) ?? []) {
        const zone = leave.timeZone!
        let formatter = formatters.get(zone)
        if (!formatter) {
          formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: zone })
          formatters.set(zone, formatter)
        }
        const start = item.deadline
          ? calendarEventDate(item)
          : formatter.format(Date.parse(item.startsAt))
        const end = item.endsAt
          ? formatter.format(Date.parse(item.endsAt) - 1)
          : start
        if (start <= leave.startDate! && leave.startDate! <= end) {
          conflicts.add(item.id)
          conflicts.add(leave.id)
        }
      }
    }
  }
  return conflicts
}
