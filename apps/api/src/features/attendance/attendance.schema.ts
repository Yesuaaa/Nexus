import { fail } from "../../shared/http-error.js"
import { parsePage } from "../../shared/query/pagination.js"
import { isPlainObject, isRecordId } from "../../shared/validation.js"

export type AttendanceAction =
  "clock-in" | "clock-out" | "break-start" | "break-end"
export type AttendanceActionInput = {
  workdayId?: string
  sessionId?: string
  breakId?: string
}

export function parseAttendanceAction(
  action: AttendanceAction,
  input: unknown,
): AttendanceActionInput {
  const body = input === undefined ? {} : input
  if (!isPlainObject(body)) fail(400, "Provide a valid attendance action")
  const allowed =
    action === "clock-in"
      ? ["workdayId"]
      : action === "break-end"
        ? ["sessionId", "breakId"]
        : ["sessionId"]
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail(
      400,
      "Attendance timestamps and employee identity are managed by the server",
    )
  const result: AttendanceActionInput = {}
  for (const field of allowed) {
    const value = body[field]
    if (value === undefined && action === "clock-in") continue
    if (!isRecordId(value)) fail(400, `Provide a valid ${field}`)
    if (field === "workdayId") result.workdayId = value
    if (field === "sessionId") result.sessionId = value
    if (field === "breakId") result.breakId = value
  }
  return result
}

export type AttendanceHistoryQuery = { from: Date; to: Date; page: number }

function dateOnly(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, "Use YYYY-MM-DD attendance dates")
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    fail(400, "Provide a valid attendance date")
  return date
}

export function parseAttendanceHistory(
  query: Record<string, unknown>,
  now: Date,
): AttendanceHistoryQuery {
  if (Object.keys(query).some((key) => !["from", "to", "page"].includes(key)))
    fail(400, "Invalid attendance history filters")
  const from = dateOnly(
    query.from ??
      new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
  )
  const to = dateOnly(
    query.to ?? new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
  )
  const page = parsePage(query.page)
  if (
    page === null ||
    to < from ||
    to.getTime() - from.getTime() > 365 * 86400000
  )
    fail(400, "Choose a valid page and an attendance range of at most 366 days")
  return { from, to, page }
}
