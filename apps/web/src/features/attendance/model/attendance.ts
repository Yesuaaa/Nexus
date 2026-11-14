import type { AttendanceWorkday } from "../api/attendance-api"
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

export function elapsedWork(day: AttendanceWorkday, asOf: number): number {
  return day.sessions.reduce((total, session) => {
    const start = Date.parse(session.startedAt)
    const end = Math.min(
      session.endedAt ? Date.parse(session.endedAt) : asOf,
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
export function deviceDateTime(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
