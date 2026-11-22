import type { Prisma } from "../../generated/prisma/client.js"
import { activeAccount } from "../../shared/query/accounts.js"
import { approvedLeaveOverlappingInterval } from "../leave/leave.repository.js"
import {
  attendanceRepository,
  type AttendanceWorkdayRecord,
} from "./attendance.repository.js"
import { summarizeAttendance } from "./attendance.summary.js"
import { notifyPendingAdjustment } from "./attendance.pending-notifications.js"

/** HR can review exceptions when the employee has no independent, active Head. */
export async function hrAdjustmentScope(
  tx: Prisma.TransactionClient,
): Promise<Prisma.AttendanceAdjustmentWhereInput> {
  const exceptions = await tx.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM "AttendanceAdjustment" a
    JOIN "Employee" e ON e.id = a."employeeId"
    LEFT JOIN "Department" d ON d.id = e."departmentId"
    LEFT JOIN "User" h ON h.id = d."headId" AND h.role = 'STAFF'
      AND h."isActive" AND h."accountDeletedAt" IS NULL
      AND h.id <> a."requestedById" AND h.id IS DISTINCT FROM e."userId"
    WHERE a.status = 'PENDING' AND h.id IS NULL
  `
  return {
    OR: [
      { status: { not: "PENDING" } },
      { id: { in: exceptions.map((row) => row.id) } },
    ],
  }
}

/** Uses the existing notification inbox, with the request as its source. */
export async function notifyOvertime(
  tx: Prisma.TransactionClient,
  requestId: string,
  stage: "VERIFIED" | "APPROVED" | "REJECTED",
) {
  const request = await tx.attendanceAdjustment.findUniqueOrThrow({
    where: { id: requestId },
    include: { employee: true },
  })
  const recipients = await tx.user.findMany({
    where: {
      ...activeAccount,
      OR: [
        { role: { in: ["ADMIN", "SUPERADMIN"] } },
        { id: request.requestedById },
      ],
    },
    select: { id: true },
  })
  if (stage === "VERIFIED") {
    await tx.workflowNotification.updateMany({
      where: {
        attendanceAdjustmentId: requestId,
        type: "ATTENDANCE_" + request.type + "_VERIFIED",
        userId: { in: recipients.map((row) => row.id) },
      },
      data: { readAt: null, createdAt: new Date() },
    })
  }
  await tx.workflowNotification.createMany({
    data: recipients.map(({ id }) => ({
      userId: id,
      attendanceAdjustmentId: request.id,
      type: `ATTENDANCE_${request.type}_${stage}`,
      summary: `${request.employee.fullName}: ${request.type === "OVERTIME" ? `${request.overtimeMinutes} overtime minutes` : "attendance correction"} ${stage === "VERIFIED" ? "verified, awaiting HR approval" : stage.toLowerCase()}.`,
    })),
    skipDuplicates: true,
  })
}

/** Missing sessions use the same policy attribution as the session insert trigger. */
export async function hasPendingWorkdayCorrection(
  tx: Prisma.TransactionClient,
  day: Pick<AttendanceWorkdayRecord, "id" | "employeeId" | "workDate">,
) {
  const workDate = day.workDate.toISOString().slice(0, 10)
  const [result] = await tx.$queryRaw<{ pending: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "AttendanceAdjustment" a
      LEFT JOIN "AttendanceWorkSession" s ON s.id = a."sessionId"
      WHERE a."employeeId" = ${day.employeeId}
        AND a.type = 'CORRECTION'
        AND a.status IN ('PENDING', 'VERIFIED')
        AND (
          s."workdayId" = ${day.id}
          OR (a."sessionId" IS NULL AND EXISTS (
            SELECT 1
            FROM attendance_policy_at(a."employeeId", a."proposedStartedAt") p
            WHERE p."workDate" = ${workDate}::date
          ))
        )
    ) AS pending
  `
  return result.pending
}

type MillisecondInterval = { start: number; end: number }

/** Return the parts of a half-open interval outside start-ordered exclusions. */
function subtractIntervals(
  interval: MillisecondInterval,
  exclusions: readonly MillisecondInterval[],
) {
  const remaining: MillisecondInterval[] = []
  let start = interval.start
  for (const exclusion of exclusions) {
    if (exclusion.end <= start) continue
    if (exclusion.start >= interval.end) break
    if (exclusion.start > start) remaining.push({ start, end: exclusion.start })
    start = exclusion.end
  }
  if (start < interval.end) remaining.push({ start, end: interval.end })
  return remaining
}

function startAfterWorkedTime(
  intervals: readonly MillisecondInterval[],
  elapsed: number,
) {
  for (const { start, end } of intervals) {
    const duration = end - start
    if (elapsed < duration) return start + elapsed
    elapsed -= duration
  }
}

/** Call within the attendance write transaction while holding the employee lock. */
export async function submitRecordedOvertime(
  tx: Prisma.TransactionClient,
  userId: string,
  employeeId: string,
  sessionId: string,
  now: Date,
) {
  const session = await attendanceRepository.session(tx, employeeId, sessionId)
  if (!session?.endedAt) return
  const day = await attendanceRepository.workday(
    tx,
    employeeId,
    session.workdayId,
  )
  if (!day || day.sessions.some((item) => !item.endedAt)) return
  if (await hasPendingWorkdayCorrection(tx, day)) return

  const sessionInterval = {
    start: session.startedAt.getTime(),
    end: Math.min(session.endedAt.getTime(), now.getTime()),
  }
  if (sessionInterval.end <= sessionInterval.start) return

  const { excessMinutes, requiredMinutes } = summarizeAttendance(day, now)
  if (excessMinutes < 1) return
  const existing = await tx.attendanceAdjustment.findMany({
    where: {
      employeeId,
      type: "OVERTIME",
      OR: [
        { session: { workdayId: day.id } },
        {
          proposedStartedAt: { lt: new Date(sessionInterval.end) },
          proposedEndedAt: { gt: session.startedAt },
        },
      ],
    },
    select: {
      proposedStartedAt: true,
      proposedEndedAt: true,
      overtimeMinutes: true,
      session: { select: { workdayId: true } },
    },
    orderBy: { proposedStartedAt: "asc" },
  })
  // Rejections still consume their recorded workday budget and block their intervals.
  const claimed = existing
    .filter((request) => request.session?.workdayId === day.id)
    .reduce((sum, request) => sum + request.overtimeMinutes, 0)
  let unclaimed = Math.floor(excessMinutes) - claimed
  if (unclaimed <= 0) return

  const earlierSessions = day.sessions.filter(
    (item) => item.startedAt < session.startedAt,
  )
  const { workedMilliseconds: earlierWorked } = summarizeAttendance(
    { ...day, sessions: earlierSessions },
    now,
  )
  const unpaid = session.breaks
    .filter((pause) => !pause.isPaid)
    .map((pause) => ({
      start: pause.startedAt.getTime(),
      end: pause.endedAt?.getTime() ?? sessionInterval.end,
    }))
  const eligibleStart = startAfterWorkedTime(
    subtractIntervals(sessionInterval, unpaid),
    Math.max(0, requiredMinutes * 60_000 - earlierWorked),
  )
  if (eligibleStart === undefined) return

  // A corrected overnight session can leave a historical request on another workday.
  const windows = subtractIntervals(
    { start: eligibleStart, end: sessionInterval.end },
    existing.map((request) => ({
      start: request.proposedStartedAt.getTime(),
      end: request.proposedEndedAt.getTime(),
    })),
  )
  // Prefer later work as before, without spanning previously requested time.
  for (const window of windows.reverse()) {
    const worked = subtractIntervals(window, unpaid)
    const duration = worked.reduce(
      (sum, { start, end }) => sum + end - start,
      0,
    )
    const minutes = Math.min(unclaimed, Math.floor(duration / 60_000))
    if (minutes === 0) continue
    const start = startAfterWorkedTime(worked, duration - minutes * 60_000)
    if (start === undefined) continue
    const startedAt = new Date(start)
    const endedAt = new Date(window.end)
    if (
      (
        await approvedLeaveOverlappingInterval(
          tx,
          employeeId,
          startedAt,
          endedAt,
        )
      ).length
    )
      continue
    const request = await tx.attendanceAdjustment.create({
      data: {
        requestKey: `automatic-overtime:${session.id}:${startedAt.toISOString()}:${endedAt.toISOString()}`,
        employeeId,
        sessionId,
        requestedById: userId,
        type: "OVERTIME",
        overtimeMinutes: minutes,
        proposedStartedAt: startedAt,
        proposedEndedAt: endedAt,
        reason: "Recorded overtime submitted automatically at clock-out.",
      },
    })
    await notifyPendingAdjustment(tx, request.id)
    unclaimed -= minutes
    if (unclaimed === 0) break
  }
}
