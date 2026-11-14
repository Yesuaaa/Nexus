import type { Prisma } from "../../generated/prisma/client.js"

/** Callers authorize the scope before building a query. Organization access is
 * explicit so a missing head/client ID cannot silently broaden a query. */
export type ServiceCalendarScope =
  | { kind: "ORGANIZATION" }
  | { kind: "HEAD"; userId: string; departmentId?: string }
  | { kind: "CLIENT"; userId: string }

type CalendarFilter = {
  scope: ServiceCalendarScope
  period?: { from: Date; until: Date }
  scheduledOnly?: boolean
}

function timedEventFilter({ period, scheduledOnly }: CalendarFilter) {
  return {
    status: scheduledOnly
      ? ("SCHEDULED" as const)
      : { not: "CANCELLED" as const },
    ...(period
      ? { startsAt: { lt: period.until }, endsAt: { gt: period.from } }
      : {}),
  }
}

export function consultationCalendarWhere(
  filter: CalendarFilter,
): Prisma.WorkflowConsultationWhereInput {
  const { scope } = filter
  return {
    ...timedEventFilter(filter),
    workflow: {
      request: {
        status: { not: "CANCELLED" },
        ...(scope.kind === "HEAD"
          ? {
              acceptedDepartment: { headId: scope.userId },
              ...(scope.departmentId
                ? { acceptedDepartmentId: scope.departmentId }
                : {}),
            }
          : scope.kind === "CLIENT"
            ? { clientId: scope.userId }
            : {}),
      },
    },
  }
}

export function meetingCalendarWhere(
  filter: CalendarFilter,
): Prisma.ConversationMeetingWhereInput {
  const { scope } = filter
  return {
    ...timedEventFilter(filter),
    ...(scope.kind === "HEAD"
      ? {
          conversation: {
            department: { headId: scope.userId },
            ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          },
        }
      : scope.kind === "CLIENT"
        ? { conversation: { clientId: scope.userId } }
        : {}),
  }
}
