export type CalendarEvent = {
  id: string
  type: "consultation" | "meeting" | "milestone" | "task"
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
  staffMembers?: { id: string; name: string }[]
  department?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
}

export type CalendarResponse = {
  events: CalendarEvent[]
  canViewTeam: boolean
  organization: boolean
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
        !event.completed && event.endsAt && Date.parse(event.endsAt) > now,
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
  return conflicts
}
