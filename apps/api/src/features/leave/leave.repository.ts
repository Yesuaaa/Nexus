import type { Prisma } from "../../generated/prisma/client.js"
import { attendanceWorkDate } from "../attendance/attendance.validation.js"

export const leaveAdminVisibility = {
  OR: [
    { status: { not: "SUBMITTED" } },
    { routeDepartmentId: null },
    { employee: { department: null } },
    { employee: { department: { head: null } } },
    { employee: { department: { head: { isActive: false } } } },
    { employee: { department: { head: { accountDeletedAt: { not: null } } } } },
    { employee: { department: { head: { role: { not: "STAFF" } } } } },
  ],
} satisfies Prisma.LeaveRequestWhereInput

/** Interval ends are exclusive, so a punch ending at midnight does not cover the next date. */
export async function approvedLeaveOverlappingInterval(
  tx: Prisma.TransactionClient,
  employeeId: string,
  start: Date,
  end: Date,
) {
  const days = await tx.leaveRequestDay.findMany({
    where: {
      employeeId,
      leaveMinutes: { gt: 0 },
      request: { status: "APPROVED" },
    },
    select: { workDate: true, timeZone: true, requestId: true },
  })
  return days.filter((day) => {
    const label = day.workDate.toISOString().slice(0, 10)
    return (
      attendanceWorkDate(start, day.timeZone) <= label &&
      attendanceWorkDate(
        new Date(Math.max(start.getTime(), end.getTime() - 1)),
        day.timeZone,
      ) >= label
    )
  })
}

export async function approvedLeaveForDate(
  tx: Prisma.TransactionClient,
  employeeId: string,
  workDate: string,
) {
  return tx.leaveRequestDay.findFirst({
    where: {
      employeeId,
      workDate: new Date(`${workDate}T00:00:00Z`),
      leaveMinutes: { gt: 0 },
      request: { status: "APPROVED" },
    },
    select: { leaveMinutes: true, requestId: true },
  })
}

export async function approvedLeaveMinutesByDate(
  tx: Prisma.TransactionClient,
  employeeIds: readonly string[],
  from: Date,
  to: Date,
) {
  if (!employeeIds.length) return new Map<string, number>()
  const days = await tx.leaveRequestDay.findMany({
    where: {
      employeeId: { in: [...employeeIds] },
      workDate: { gte: from, lte: to },
      request: { status: "APPROVED" },
    },
    select: { employeeId: true, workDate: true, leaveMinutes: true },
  })
  return new Map(
    days.map((day) => [
      `${day.employeeId}:${day.workDate.toISOString().slice(0, 10)}`,
      day.leaveMinutes,
    ]),
  )
}
