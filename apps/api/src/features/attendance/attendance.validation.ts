/** Date attribution uses the policy zone, never the browser or server zone. */
export function attendanceWorkDate(startedAt: Date, timeZone: string): string {
  if (!Number.isFinite(startedAt.getTime()))
    throw new RangeError("Invalid timestamp")
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: attendanceTimeZone(timeZone),
  }).format(startedAt)
}

export function attendanceTimeZone(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 100 ||
    value !== value.trim()
  )
    throw new RangeError("Provide an attendance timezone")
  new Intl.DateTimeFormat("en", { timeZone: value })
  return value
}

/** Accept explicit instants only; date-only and timezone-free strings are ambiguous. */
export function attendanceTimestamp(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    )
  )
    throw new RangeError("Provide a complete timestamp with an offset or Z")
  const calendarDay = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  const instant = new Date(value)
  if (
    !Number.isFinite(calendarDay.getTime()) ||
    calendarDay.toISOString().slice(0, 10) !== value.slice(0, 10) ||
    !Number.isFinite(instant.getTime())
  )
    throw new RangeError("Invalid attendance timestamp")
  return instant
}

export type AttendancePolicyDayInput = {
  /** Sunday = 0, Saturday = 6, matching PostgreSQL EXTRACT(DOW). */
  weekday: number
  isWorkingDay: boolean
  requiredMinutes: number
}

/** Explicit seven-day configuration avoids inventing a default working week. */
export function attendancePolicyDays(
  value: unknown,
): AttendancePolicyDayInput[] {
  if (!Array.isArray(value) || value.length !== 7)
    throw new RangeError("Configure all seven weekdays")
  const seen = new Set<number>()
  return value.map((day: unknown) => {
    if (
      !day ||
      typeof day !== "object" ||
      !("weekday" in day) ||
      !("requiredMinutes" in day) ||
      !("isWorkingDay" in day) ||
      typeof day.weekday !== "number" ||
      !Number.isInteger(day.weekday) ||
      day.weekday < 0 ||
      day.weekday > 6 ||
      typeof day.isWorkingDay !== "boolean" ||
      seen.has(day.weekday)
    )
      throw new RangeError(
        "Provide unique weekdays from 0 through 6 and working-day flags",
      )
    const requiredMinutes = requiredAttendanceMinutes(day.requiredMinutes)
    if (!day.isWorkingDay && requiredMinutes !== 0)
      throw new RangeError("A rest day must have zero required minutes")
    seen.add(day.weekday)
    return {
      weekday: day.weekday,
      isWorkingDay: day.isWorkingDay,
      requiredMinutes,
    }
  })
}

export function requiredAttendanceMinutes(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1440
  )
    throw new RangeError(
      "Required minutes must be an integer between 0 and 1440",
    )
  return value
}

export type AttendanceInterval = { startedAt: Date; endedAt: Date }

/** Closed, nonoverlapping intervals only. Round once when presenting totals. */
export function attendanceWorkedMilliseconds(
  sessions: readonly (AttendanceInterval & {
    breaks: readonly (AttendanceInterval & { isPaid: boolean })[]
  })[],
): number {
  function checked(
    intervals: readonly AttendanceInterval[],
  ): AttendanceInterval[] {
    const sorted = [...intervals].sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    )
    for (const [index, interval] of sorted.entries()) {
      if (
        !Number.isFinite(interval.startedAt.getTime()) ||
        !Number.isFinite(interval.endedAt.getTime()) ||
        interval.endedAt <= interval.startedAt
      )
        throw new RangeError("Invalid attendance interval")
      if (index && sorted[index - 1].endedAt > interval.startedAt)
        throw new RangeError("Attendance intervals overlap")
    }
    return sorted
  }
  checked(sessions)
  return sessions.reduce((total, session) => {
    checked(session.breaks)
    let unpaid = 0
    for (const pause of session.breaks) {
      if (
        pause.startedAt < session.startedAt ||
        pause.endedAt > session.endedAt
      )
        throw new RangeError("Break outside session")
      if (!pause.isPaid)
        unpaid += pause.endedAt.getTime() - pause.startedAt.getTime()
    }
    return (
      total + session.endedAt.getTime() - session.startedAt.getTime() - unpaid
    )
  }, 0)
}
