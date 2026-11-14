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
  department: { id: string; headId: string },
  week: string,
  staff: { id: string; userId: string | null }[],
) {
  const start = new Date(`${week}T00:00:00Z`)
  const until = new Date(start)
  until.setUTCDate(until.getUTCDate() + 7)
  const head = staff.find((employee) => employee.userId === department.headId)
  const calendarFilter = {
    scope: {
      kind: "HEAD" as const,
      userId: department.headId,
      departmentId: department.id,
    },
    period: { from: start, until },
    scheduledOnly: true,
  }
  const [assignments, consultations, meetings] = await Promise.all([
    tx.attendancePolicyAssignment.findMany({
      where: {
        employeeId: { in: staff.map((employee) => employee.id) },
        effectiveFrom: { lt: until },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: start } }],
      },
      include: { policy: { include: { days: true } } },
    }),
    head
      ? tx.workflowConsultation.findMany({
          where: consultationCalendarWhere(calendarFilter),
          select: { id: true, startsAt: true, endsAt: true },
        })
      : [],
    head
      ? tx.conversationMeeting.findMany({
          where: meetingCalendarWhere(calendarFilter),
          select: { id: true, startsAt: true, endsAt: true },
        })
      : [],
  ])
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
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
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
        // Null means unknown, not an empty week of confirmed free time.
        confirmedAvailableSlots: null,
        commitments: employee.id === head?.id ? commitments : [],
        overlaps: employee.id === head?.id ? overlaps : [],
      },
    ]),
  )
}
