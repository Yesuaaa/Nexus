import { leaveDayOverlapsInterval } from "../leave/leave.repository.js"
import type { Prisma } from "../../generated/prisma/client.js"
import {
  consultationCalendarWhere,
  meetingCalendarWhere,
} from "../projects/calendar.queries.js"

type PolicyAssignment = Prisma.AttendancePolicyAssignmentGetPayload<{
  include: { policy: { include: { days: true } } }
}>

/** Dates are attendance work-date labels in each assigned policy's time zone,
 * not UTC instants or promises of fixed start/end times. */
export function weeklyPolicyRequirement(
  week: string,
  assignments: PolicyAssignment[],
) {
  const start = new Date(`${week}T00:00:00Z`)
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() + offset)
    const assignment = assignments.find(
      (item) =>
        item.effectiveFrom <= date &&
        (!item.effectiveUntil || date < item.effectiveUntil),
    )
    const day = assignment?.policy.days.find(
      (item) => item.weekday === date.getUTCDay(),
    )
    return {
      workDate: date.toISOString().slice(0, 10),
      requiredMinutes: day?.requiredMinutes ?? null,
      isWorkingDay: day?.isWorkingDay ?? null,
      policyName: assignment?.policy.name ?? null,
      timeZone: assignment?.policy.timeZone ?? null,
    }
  })
  const knownHours =
    days.reduce((total, day) => total + (day.requiredMinutes ?? 0), 0) / 60
  return {
    days,
    knownHours,
    totalHours: days.every((day) => day.requiredMinutes !== null)
      ? knownHours
      : null,
  }
}

/** Only the current department head is a known internal participant in these
 * calendar models. Project staff membership does not imply meeting attendance.
 * Keep the existing calendar's current-head mapping and cancellation rules. */
export async function workloadPlanningContext(
  tx: Prisma.TransactionClient,
  department: { id: string | null; headId: string | null },
  week: string,
  staff: { id: string; userId: string | null }[],
) {
  const start = new Date(`${week}T00:00:00Z`)
  const until = new Date(start)
  until.setUTCDate(until.getUTCDate() + 7)
  const head = department.headId
    ? staff.find((employee) => employee.userId === department.headId)
    : undefined
  const calendarFilter =
    department.id && department.headId
      ? {
          scope: {
            kind: "HEAD" as const,
            userId: department.headId,
            departmentId: department.id,
          },
          period: { from: start, until },
          scheduledOnly: true,
        }
      : null
  const [assignments, consultations, meetings, approvedLeave] =
    await Promise.all([
      tx.attendancePolicyAssignment.findMany({
        where: {
          employeeId: { in: staff.map((employee) => employee.id) },
          cancelledAt: null,
          effectiveFrom: { lt: until },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: start } }],
        },
        include: { policy: { include: { days: true } } },
      }),
      head && calendarFilter
        ? tx.workflowConsultation.findMany({
            where: consultationCalendarWhere(calendarFilter),
            select: { id: true, startsAt: true, endsAt: true },
          })
        : [],
      head && calendarFilter
        ? tx.conversationMeeting.findMany({
            where: meetingCalendarWhere(calendarFilter),
            select: { id: true, startsAt: true, endsAt: true },
          })
        : [],
      tx.leaveRequestDay.findMany({
        where: {
          employeeId: { in: staff.map((employee) => employee.id) },
          workDate: {
            gte: new Date(start.getTime() - 86400000),
            lt: new Date(until.getTime() + 86400000),
          },
          leaveMinutes: { gt: 0 },
          request: { status: "APPROVED" },
        },
        select: {
          employeeId: true,
          workDate: true,
          leaveMinutes: true,
          timeZone: true,
        },
        orderBy: [{ workDate: "asc" }, { id: "asc" }],
      }),
    ])
  const weeklyLeave = approvedLeave.filter(
    (day) => day.workDate >= start && day.workDate < until,
  )
  const headLeave = approvedLeave.filter((day) => day.employeeId === head?.id)
  const commitments = [
    ...consultations.map((item) => ({
      ...item,
      id: `consultation-${item.id}`,
      title: "Service consultation",
    })),
    ...meetings.map((item) => ({
      ...item,
      id: `meeting-${item.id}`,
      title: "Service meeting",
    })),
  ]
    .map((item) => ({
      ...item,
      overlapsLeave: headLeave.some((day) =>
        leaveDayOverlapsInterval(day, item.startsAt, item.endsAt),
      ),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const overlaps = commitments.flatMap((first, index) =>
    commitments
      .slice(index + 1)
      .flatMap((second) =>
        first.startsAt < second.endsAt && second.startsAt < first.endsAt
          ? [{ firstId: first.id, secondId: second.id }]
          : [],
      ),
  )
  return new Map(
    staff.map((employee) => [
      employee.id,
      {
        requirement: weeklyPolicyRequirement(
          week,
          assignments.filter((item) => item.employeeId === employee.id),
        ),
        approvedLeave: weeklyLeave
          .filter((day) => day.employeeId === employee.id)
          .map((day) => ({
            workDate: day.workDate.toISOString().slice(0, 10),
            minutes: day.leaveMinutes,
          })),
        approvedLeaveHours:
          weeklyLeave
            .filter((day) => day.employeeId === employee.id)
            .reduce((sum, day) => sum + day.leaveMinutes, 0) / 60,
        // Null means unknown, not an empty week of confirmed free time.
        confirmedAvailableSlots: null,
        commitments: employee.id === head?.id ? commitments : [],
        overlaps: employee.id === head?.id ? overlaps : [],
      },
    ]),
  )
}
