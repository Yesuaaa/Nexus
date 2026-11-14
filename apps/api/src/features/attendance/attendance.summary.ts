import type { AttendanceWorkdayRecord } from "./attendance.repository.js"
import { attendanceWorkedMilliseconds } from "./attendance.validation.js"
import { attendanceWorkDate } from "./attendance.validation.js"

type SummarySource = Pick<
  AttendanceWorkdayRecord,
  | "employeeId"
  | "assignmentId"
  | "workDate"
  | "timeZone"
  | "isWorkingDay"
  | "requiredMinutes"
  | "policyName"
  | "unpaidBreaksEnabled"
  | "overnightRequiresReview"
  | "sessions"
  | "assignment"
> & { id: string | null }

/** Count elapsed instants against the attributed workday, never split at midnight. */
export function summarizeAttendance(day: SummarySource, asOf: Date) {
  let unpaidBreakMilliseconds = 0
  const intervals = day.sessions.flatMap((session) => {
    const end = new Date(
      Math.min(session.endedAt?.getTime() ?? asOf.getTime(), asOf.getTime()),
    )
    if (end <= session.startedAt) return []
    const breaks = session.breaks.flatMap((pause) => {
      const pauseEnd = new Date(
        Math.min(pause.endedAt?.getTime() ?? end.getTime(), end.getTime()),
      )
      if (pauseEnd <= pause.startedAt) return []
      if (!pause.isPaid)
        unpaidBreakMilliseconds +=
          pauseEnd.getTime() - pause.startedAt.getTime()
      return [
        { startedAt: pause.startedAt, endedAt: pauseEnd, isPaid: pause.isPaid },
      ]
    })
    return [{ startedAt: session.startedAt, endedAt: end, breaks }]
  })
  const workedMilliseconds = attendanceWorkedMilliseconds(intervals)
  const requiredMilliseconds = day.requiredMinutes * 60000
  const remainingMilliseconds = Math.max(
    0,
    requiredMilliseconds - workedMilliseconds,
  )
  const excessMilliseconds = Math.max(
    0,
    workedMilliseconds - requiredMilliseconds,
  )
  const activeSession = day.sessions.find((session) => session.endedAt === null)
  const status =
    day.requiredMinutes === 0
      ? "NOT_REQUIRED"
      : activeSession
        ? remainingMilliseconds === 0
          ? "HOURS_MET"
          : "IN_PROGRESS"
        : day.sessions.length > 0
          ? remainingMilliseconds === 0
            ? "COMPLETE"
            : "INCOMPLETE"
          : "NOT_STARTED"
  return {
    id: day.id,
    employeeId: day.employeeId,
    assignmentId: day.assignmentId,
    workDate: day.workDate.toISOString().slice(0, 10),
    timeZone: day.timeZone,
    isWorkingDay: day.isWorkingDay,
    policy: {
      id: day.assignment.policy.id,
      name: day.policyName,
      unpaidBreaksEnabled: day.unpaidBreaksEnabled,
      overnightRequiresReview: day.overnightRequiresReview,
    },
    hasOvernightSessions: day.sessions.some(
      (session) =>
        session.endedAt &&
        attendanceWorkDate(session.startedAt, day.timeZone) !==
          attendanceWorkDate(session.endedAt, day.timeZone),
    ),
    overnightRequiresReview:
      day.overnightRequiresReview &&
      day.sessions.some(
        (session) =>
          attendanceWorkDate(session.startedAt, day.timeZone) !==
          attendanceWorkDate(session.endedAt ?? asOf, day.timeZone),
      ),
    requiredMinutes: day.requiredMinutes,
    requiredHours: day.requiredMinutes / 60,
    workedMilliseconds,
    workedMinutes: workedMilliseconds / 60000,
    workedHours: workedMilliseconds / 3600000,
    unpaidBreakMilliseconds,
    remainingMinutes: remainingMilliseconds / 60000,
    excessMinutes: excessMilliseconds / 60000,
    excessRequiresReview: excessMilliseconds > 0,
    progressPercent:
      requiredMilliseconds > 0
        ? Math.min(100, (workedMilliseconds / requiredMilliseconds) * 100)
        : null,
    isComplete: remainingMilliseconds === 0,
    status,
    activeSessionId: activeSession?.id ?? null,
    pendingCorrections: day.sessions.reduce(
      (total, session) => total + session.adjustments.length,
      0,
    ),
    activeBreakId:
      activeSession?.breaks.find((pause) => pause.endedAt === null)?.id ?? null,
    sessions: day.sessions,
  }
}
