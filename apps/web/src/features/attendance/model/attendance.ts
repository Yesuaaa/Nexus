import type { AttendanceSession, AttendanceWorkday } from "../api/attendance-api"
import type { PillTone } from "@/components/ui/pill"
export { formatDateTime as attendanceDate } from "../../../lib/format.ts"

export const attendanceStatusLabels: Record<
  AttendanceWorkday["status"],
  string
> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  HOURS_MET: "Hours met",
  INCOMPLETE: "Incomplete",
  COMPLETE: "Complete",
  NOT_REQUIRED: "Not required",
}

export const attendanceStatusTones: Record<
  AttendanceWorkday["status"],
  PillTone
> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  HOURS_MET: "info",
  INCOMPLETE: "warning",
  COMPLETE: "success",
  NOT_REQUIRED: "neutral",
}

/** Also used with the live worked-time value between server refreshes. */
export function attendanceStatus(
  day: AttendanceWorkday,
): AttendanceWorkday["status"] {
  if (day.requiredMinutes === 0) return "NOT_REQUIRED"
  const met = day.workedMilliseconds >= day.requiredMinutes * 60000
  if (day.activeSessionId) return met ? "HOURS_MET" : "IN_PROGRESS"
  if (day.sessions.length) return met ? "COMPLETE" : "INCOMPLETE"
  return "NOT_STARTED"
}

export function attendanceStatusLabel(day: AttendanceWorkday) {
  const status = attendanceStatus(day)
  return status === "NOT_REQUIRED" && (day.approvedLeaveMinutes ?? 0) > 0
    ? "Approved leave"
    : attendanceStatusLabels[status]
}

export function isSuspendedSession(session: AttendanceSession) {
  return !session.endedAt && Boolean(session.suspendedAt)
}

export function elapsedWork(day: AttendanceWorkday, asOf: number): number {
  return day.sessions.reduce((total, session) => {
    const start = Date.parse(session.startedAt)
    const end = Math.min(
      session.endedAt || session.suspendedAt ? Date.parse((session.endedAt ?? session.suspendedAt)!) : asOf,
      asOf,
    )
    if (end <= start) return total
    const unpaid = session.breaks
      .filter((pause) => !pause.isPaid)
      .reduce(
        (sum, pause) =>
          sum +
          Math.max(
            0,
            Math.min(pause.endedAt ? Date.parse(pause.endedAt) : end, end) -
              Date.parse(pause.startedAt),
          ),
        0,
      )
    return total + Math.max(0, end - start - unpaid)
  }, 0)
}
export function duration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}
export function isOvernight(
  start: string,
  end: string | null,
  zone: string,
  now: number,
) {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: zone })
  return date.format(new Date(start)) !== date.format(new Date(end ?? now))
}
export function defaultRange() {
  const today = new Date()
  return {
    from: new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date(today.getTime() + 86400000).toISOString().slice(0, 10),
  }
}
function localClockAsUtc(instant: Date) {
  const wallTime = new Date(0)
  wallTime.setUTCFullYear(
    instant.getFullYear(),
    instant.getMonth(),
    instant.getDate(),
  )
  wallTime.setUTCHours(
    instant.getHours(),
    instant.getMinutes(),
    instant.getSeconds(),
    instant.getMilliseconds(),
  )
  return wallTime
}

export function deviceDateTime(value: string) {
  return localClockAsUtc(new Date(value)).toISOString().slice(0, 16)
}

/** Find the device-zone instants that round-trip to the entered wall time. */
export function deviceDateTimeOccurrences(value: string) {
  if (!value) return []
  const wallTime = new Date(`${value}Z`)
  const timestamp = wallTime.getTime()
  if (!Number.isFinite(timestamp) || !wallTime.toISOString().startsWith(value))
    return []

  const anchor = new Date(value).getTime()
  const day = 24 * 60 * 60 * 1000
  // Sample both sides of the local date so changes of any offset size are considered.
  const offsets = new Set(
    [-day, 0, day].map((delta) => {
      const sample = new Date(anchor + delta)
      return localClockAsUtc(sample).getTime() - sample.getTime()
    }),
  )
  return [...offsets]
    .map((offset) => new Date(timestamp - offset))
    .filter((instant) => localClockAsUtc(instant).getTime() === timestamp)
    .sort((first, second) => first.getTime() - second.getTime())
}
