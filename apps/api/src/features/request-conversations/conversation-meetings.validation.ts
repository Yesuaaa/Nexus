import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

function invalid(message: string): never {
  throw new ServiceRequestsError(400, message)
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    invalid("Invalid meeting details")
  return input as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, required = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    value.includes("\u0000")
  )
    invalid(`Enter a valid ${label}`)
  if (required && !value.trim()) invalid(`Enter a ${label}`)
  return value.trim()
}

function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid("Enter a valid meeting date and time")
  return new Date(value)
}

function schedule(input: Record<string, unknown>) {
  const startsAt = date(input.startsAt)
  const endsAt = date(input.endsAt)
  if (
    startsAt.getTime() <= Date.now() ||
    endsAt <= startsAt ||
    endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000
  )
    invalid("Schedule a future meeting lasting at most eight hours")
  return {
    startsAt,
    endsAt,
    location: text(input.location, "location or meeting link", 1000),
  }
}

export function parseMeeting(input: unknown) {
  const body = record(input)
  const clientActionId = text(body.clientActionId, "invitation ID", 36)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientActionId,
    )
  )
    invalid("Invalid invitation ID")
  if (
    !Array.isArray(body.bookingIds) ||
    body.bookingIds.length > 100 ||
    !body.bookingIds.every(
      (id): id is string =>
        typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id),
    )
  )
    invalid("Choose services from this conversation")
  return {
    ...schedule(body),
    notes: text(body.notes, "meeting topic", 2000, false),
    clientActionId,
    bookingIds: [...new Set(body.bookingIds)].sort(),
  }
}

export function parseMeetingAction(input: unknown) {
  const body = record(input)
  if (
    !Number.isSafeInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 0
  )
    invalid("Invalid meeting version")
  const expectedVersion = body.expectedVersion as number
  switch (body.type) {
    case "REQUEST_RESCHEDULE": {
      const startsAt = date(body.startsAt)
      if (startsAt.getTime() <= Date.now())
        invalid("Choose a future meeting time")
      return {
        type: body.type,
        expectedVersion,
        startsAt,
        note: text(body.note, "reschedule reason", 2000),
      } as const
    }
    case "RESCHEDULE":
      return { type: body.type, expectedVersion, ...schedule(body) } as const
    case "KEEP_SCHEDULE":
    case "COMPLETE":
    case "CANCEL":
      return { type: body.type, expectedVersion } as const
    default:
      return invalid("Invalid meeting action")
  }
}
