import type { Prisma } from "../../generated/prisma/client.js"
import { activeAccount, activeStaff } from "../../shared/query/accounts.js"
import { attendanceWorkDate } from "../attendance/attendance.validation.js"

export const leaveReviewHeadSelect = {
  id: true,
  role: true,
  isActive: true,
  accountDeletedAt: true,
} satisfies Prisma.UserSelect

const leaveRoutingSelect = {
  id: true,
  requestedById: true,
  employee: {
    select: {
      userId: true,
      department: { select: { head: { select: leaveReviewHeadSelect } } },
    },
  },
} satisfies Prisma.LeaveRequestSelect

type LeaveRouting = Prisma.LeaveRequestGetPayload<{
  select: typeof leaveRoutingSelect
}>

export function isLeaveSubject(
  { requestedById, employee }: Omit<LeaveRouting, "id">,
  userId: string,
) {
  return requestedById === userId || employee.userId === userId
}

export function leaveReviewHead(request: Omit<LeaveRouting, "id">) {
  const head = request.employee.department?.head
  return head?.role === activeStaff.role &&
    head.isActive === activeStaff.isActive &&
    head.accountDeletedAt === activeStaff.accountDeletedAt &&
    !isLeaveSubject(request, head.id)
    ? head
    : null
}

export async function submittedLeaveFallbackScope(
  tx: Prisma.TransactionClient,
  reviewerId: string,
) {
  // Prisma can't compare the Head and subject IDs across these relations.
  // Find candidates here and recheck the relationship in the actual filter.
  const selfHeads = await tx.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT d."headId" AS id FROM "LeaveRequest" r
    JOIN "Employee" e ON e.id = r."employeeId"
    JOIN "Department" d ON d.id = e."departmentId"
    WHERE r.status = 'SUBMITTED'
      AND (d."headId" = r."requestedById" OR d."headId" = e."userId")
  `
  return {
    status: "SUBMITTED",
    requestedById: { not: reviewerId },
    employee: { OR: [{ userId: null }, { userId: { not: reviewerId } }] },
    OR: [
      { employee: { department: null } },
      { employee: { department: { head: null } } },
      { employee: { department: { head: { isNot: activeStaff } } } },
      ...selfHeads.map(({ id }) => ({
        employee: { department: { headId: id } },
        OR: [{ requestedById: id }, { employee: { userId: id } }],
      })),
    ],
  } satisfies Prisma.LeaveRequestWhereInput
}

export async function notifySubmittedLeave(
  tx: Prisma.TransactionClient,
  requests: LeaveRouting[],
  includeSuperadmins = false,
) {
  if (!requests.length) return
  const administrators = await tx.user.findMany({
    where: {
      ...activeAccount,
      role: { in: includeSuperadmins ? ["ADMIN", "SUPERADMIN"] : ["ADMIN"] },
    },
    select: { id: true, role: true },
  })
  const data = requests.flatMap((request) => {
    const head = leaveReviewHead(request)
    const recipients = administrators.filter(
      ({ id, role }) =>
        (role === "SUPERADMIN" || !head) && !isLeaveSubject(request, id),
    )
    const recipientIds = recipients.map(({ id }) => id)
    if (head) recipientIds.push(head.id)
    return recipientIds.map((userId) => ({
      userId,
      leaveRequestId: request.id,
      type: "LEAVE_SUBMITTED",
      summary: "A leave request is awaiting review.",
    }))
  })
  if (data.length)
    await tx.workflowNotification.createMany({ data, skipDuplicates: true })
}

export async function notifyPendingLeaveAfterHeadChange(
  tx: Prisma.TransactionClient,
  departmentId: string,
) {
  const requests = await tx.leaveRequest.findMany({
    where: { status: "SUBMITTED", employee: { departmentId } },
    select: leaveRoutingSelect,
  })
  await notifySubmittedLeave(tx, requests)
}

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
