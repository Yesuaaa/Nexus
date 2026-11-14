import type { Prisma } from "../../generated/prisma/client.js"

export const attendanceSessionInclude = {
  adjustments: {
    where: { status: "PENDING", type: "CORRECTION" },
    select: { id: true },
  },
  breaks: { orderBy: [{ startedAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.AttendanceWorkSessionInclude

export const attendanceWorkdayInclude = {
  assignment: {
    select: {
      policy: {
        select: {
          id: true,
          name: true,
          unpaidBreaksEnabled: true,
          overnightRequiresReview: true,
        },
      },
    },
  },
  sessions: {
    include: attendanceSessionInclude,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.AttendanceWorkdayInclude

export type AttendanceWorkdayRecord = Prisma.AttendanceWorkdayGetPayload<{
  include: typeof attendanceWorkdayInclude
}>
export type AttendanceSessionRecord = Prisma.AttendanceWorkSessionGetPayload<{
  include: typeof attendanceSessionInclude
}>

export const attendanceRepository = {
  activeSession(tx: Prisma.TransactionClient, employeeId: string) {
    return tx.attendanceWorkSession.findFirst({
      where: { employeeId, endedAt: null },
      include: attendanceSessionInclude,
    })
  },
  session(tx: Prisma.TransactionClient, employeeId: string, id: string) {
    return tx.attendanceWorkSession.findFirst({
      where: { id, employeeId },
      include: attendanceSessionInclude,
    })
  },
  workday(tx: Prisma.TransactionClient, employeeId: string, id: string) {
    return tx.attendanceWorkday.findFirst({
      where: { id, employeeId },
      include: attendanceWorkdayInclude,
    })
  },
  latestSession(tx: Prisma.TransactionClient, employeeId: string) {
    return tx.attendanceWorkSession.findFirst({
      where: { employeeId },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    })
  },
  assignments(tx: Prisma.TransactionClient, employeeId: string) {
    return tx.attendancePolicyAssignment.findMany({
      where: { employeeId },
      include: { policy: { include: { days: true } } },
    })
  },
}
