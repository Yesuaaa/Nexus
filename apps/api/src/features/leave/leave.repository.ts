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

/** An interval ending at midnight stops before the next date. */
export function leaveDayOverlapsInterval(
  day: { workDate: Date; timeZone: string },
  start: Date,
  end: Date,
) {
  const label = day.workDate.toISOString().slice(0, 10)
  const lastInstant = new Date(Math.max(start.getTime(), end.getTime() - 1))
  return (
    attendanceWorkDate(start, day.timeZone) <= label &&
    attendanceWorkDate(lastInstant, day.timeZone) >= label
  )
}

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
  return days.filter((day) => leaveDayOverlapsInterval(day, start, end))
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
