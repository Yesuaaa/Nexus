import type { Prisma } from "../../generated/prisma/client.js"
import { activeAccount, activeStaff } from "../../shared/query/accounts.js"
import { attendanceRepository } from "./attendance.repository.js"
import { summarizeAttendance } from "./attendance.summary.js"

/** Uses the existing notification inbox, with the request as its source. */
export async function notifyOvertime(
  tx: Prisma.TransactionClient,
  requestId: string,
  stage: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED",
) {
  const request = await tx.attendanceAdjustment.findUniqueOrThrow({
    where: { id: requestId },
    include: { employee: true },
  })
  const department = request.employee.departmentId
    ? await tx.department.findUnique({
        where: { id: request.employee.departmentId },
      })
    : null
  const recipients = await tx.user.findMany({
    where: {
      ...activeAccount,
      id: { not: request.requestedById },
      OR: [
        { role: "ADMIN" },
        ...(stage === "PENDING" && department?.headId
          ? [{ ...activeStaff, id: department.headId }]
          : []),
      ],
    },
    select: { id: true },
  })
  await tx.workflowNotification.createMany({
    data: recipients.map(({ id }) => ({
      userId: id,
      attendanceAdjustmentId: request.id,
      type: `ATTENDANCE_OVERTIME_${stage}`,
      summary: `${request.employee.fullName}: ${request.overtimeMinutes} overtime minutes ${stage === "PENDING" ? "awaiting department verification" : stage === "VERIFIED" ? "verified, awaiting HR approval" : stage.toLowerCase()}.`,
    })),
    skipDuplicates: true,
  })
}

/** Called inside the serialized punch transaction; clock-out and request are atomic. */
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
  if (
    await tx.attendanceAdjustment.findFirst({
      where: {
        employeeId,
        type: "CORRECTION",
        status: "PENDING",
        session: { workdayId: session.workdayId },
      },
    })
  )
    return
  const existing = await tx.attendanceAdjustment.findMany({
    where: {
      employeeId,
      type: "OVERTIME",
      session: { workdayId: session.workdayId },
    },
  })
  // Rejected time is already reviewed; subsequent punches must not resubmit it.
  const unclaimed =
    Math.floor(summarizeAttendance(day, now).excessMinutes) -
    existing.reduce((sum, item) => sum + item.overtimeMinutes, 0)
  const before = day.sessions.filter(
    (item) => item.startedAt < session.startedAt,
  )
  const sessionExcess =
    Math.floor(
      summarizeAttendance({ ...day, sessions: [...before, session] }, now)
        .excessMinutes,
    ) -
    Math.floor(
      summarizeAttendance({ ...day, sessions: before }, now).excessMinutes,
    )
  const available = Math.min(
    unclaimed,
    sessionExcess -
      existing
        .filter((item) => item.sessionId === session.id)
        .reduce((sum, item) => sum + item.overtimeMinutes, 0),
  )
  if (available <= 0) return
  let remaining = available * 60000
  let cursor = session.endedAt.getTime()
  const pauses = session.breaks
    .filter((pause) => !pause.isPaid && pause.endedAt)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  for (const pause of pauses) {
    const worked = cursor - pause.endedAt!.getTime()
    if (remaining <= worked) break
    remaining -= worked
    cursor = pause.startedAt.getTime()
  }
  const start = new Date(
    Math.max(session.startedAt.getTime(), cursor - remaining),
  )
  const unpaid = pauses.reduce(
    (sum, pause) =>
      sum +
      Math.max(
        0,
        pause.endedAt!.getTime() -
          Math.max(start.getTime(), pause.startedAt.getTime()),
      ),
    0,
  )
  const minutes = Math.floor(
    (session.endedAt.getTime() - start.getTime() - unpaid) / 60000,
  )
  if (
    minutes <= 0 ||
    existing.some(
      (item) =>
        item.proposedStartedAt < session.endedAt! &&
        item.proposedEndedAt > start,
    )
  )
    return
  const request = await tx.attendanceAdjustment.create({
    data: {
      requestKey: `automatic-overtime:${session.id}:${start.toISOString()}:${session.endedAt.toISOString()}`,
      employeeId,
      sessionId,
      requestedById: userId,
      type: "OVERTIME",
      overtimeMinutes: minutes,
      proposedStartedAt: start,
      proposedEndedAt: session.endedAt,
      reason: "Recorded overtime submitted automatically at clock-out.",
    },
  })
  await notifyOvertime(tx, request.id, "PENDING")
}
