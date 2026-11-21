import { Prisma } from "../../generated/prisma/client.js"
import { fail } from "../../shared/http-error.js"
import { PAGE_SIZE, pageWindow } from "../../shared/query/pagination.js"
import { attendanceWorkdayInclude } from "./attendance.repository.js"
import type { AttendanceHistoryQuery } from "./attendance.schema.js"
import { summarizeAttendance } from "./attendance.summary.js"

type ReportRange = Pick<AttendanceHistoryQuery, "from" | "to">
type ReportScope = { employeeId?: string; departmentId?: string }
type ReportKey = { workdayId: string | null; leaveDayId: string | null }

const employeeSelect = {
  id: true,
  fullName: true,
  employeeId: true,
  departmentId: true,
  department: { select: { name: true } },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.EmployeeSelect

// Merge employee dates before counting, ordering or paging. A recorded workday
// remains the source for its sessions and base rules when leave also exists.
function reportDays(range: ReportRange, scope: ReportScope) {
  const inRange = Prisma.sql`BETWEEN ${range.from.toISOString().slice(0, 10)}::date AND ${range.to.toISOString().slice(0, 10)}::date`
  const employeeFilter = Prisma.sql`
    ${scope.employeeId ? Prisma.sql`AND employee.id = ${scope.employeeId}` : Prisma.empty}
    ${scope.departmentId ? Prisma.sql`AND employee."departmentId" = ${scope.departmentId}` : Prisma.empty}
  `
  return Prisma.sql`
    SELECT recorded.id AS "workdayId", approved.id AS "leaveDayId",
      coalesce(recorded."workDate", approved."workDate") AS "workDate",
      coalesce(recorded."employeeId", approved."employeeId") AS "employeeId"
    FROM (
      SELECT day.id, day."workDate", day."employeeId"
      FROM "AttendanceWorkday" day JOIN "Employee" employee ON employee.id = day."employeeId"
      WHERE day."workDate" ${inRange} ${employeeFilter}
    ) recorded
    FULL OUTER JOIN (
      SELECT day.id, day."workDate", day."employeeId"
      FROM "LeaveRequestDay" day
      JOIN "LeaveRequest" request ON request.id = day."requestId"
      JOIN "Employee" employee ON employee.id = day."employeeId"
      WHERE day."workDate" ${inRange} ${employeeFilter}
        AND day."leaveMinutes" > 0 AND request.status = 'APPROVED'
    ) approved USING ("employeeId", "workDate")
  `
}

async function loadReportDays(
  tx: Prisma.TransactionClient,
  keys: ReportKey[],
  asOf: Date,
) {
  const workdayIds = keys.flatMap(({ workdayId }) =>
    workdayId ? [workdayId] : [],
  )
  const leaveDayIds = keys.flatMap(({ leaveDayId }) =>
    leaveDayId ? [leaveDayId] : [],
  )
  const workdays = workdayIds.length
    ? await tx.attendanceWorkday.findMany({
        where: { id: { in: workdayIds } },
        include: {
          ...attendanceWorkdayInclude,
          employee: { select: employeeSelect },
        },
      })
    : []
  const leaveDays = leaveDayIds.length
    ? await tx.leaveRequestDay.findMany({
        where: { id: { in: leaveDayIds } },
        select: {
          id: true,
          employeeId: true,
          assignmentId: true,
          workDate: true,
          timeZone: true,
          policyName: true,
          baseRequiredMinutes: true,
          leaveMinutes: true,
          assignment: attendanceWorkdayInclude.assignment,
          employee: { select: employeeSelect },
        },
      })
    : []
  const workdaysById = new Map(workdays.map((day) => [day.id, day]))
  const leaveDaysById = new Map(leaveDays.map((day) => [day.id, day]))

  return keys.map(({ workdayId, leaveDayId }) => {
    const recorded = workdayId ? workdaysById.get(workdayId) : undefined
    const leave = leaveDayId ? leaveDaysById.get(leaveDayId) : undefined
    if (recorded) {
      return {
        employee: recorded.employee,
        day: summarizeAttendance(
          { ...recorded, approvedLeaveMinutes: leave?.leaveMinutes },
          asOf,
        ),
      }
    }
    if (!leave) throw new Error("Attendance report day was not found")
    return {
      employee: leave.employee,
      day: summarizeAttendance(
        {
          ...leave,
          id: null,
          isWorkingDay: true,
          sessions: [],
          requiredMinutes: leave.baseRequiredMinutes,
          approvedLeaveMinutes: leave.leaveMinutes,
          unpaidBreaksEnabled: leave.assignment.policy.unpaidBreaksEnabled,
          overnightRequiresReview:
            leave.assignment.policy.overnightRequiresReview,
        },
        asOf,
      ),
    }
  })
}

export async function attendanceReportPage(
  tx: Prisma.TransactionClient,
  range: AttendanceHistoryQuery,
  scope: ReportScope,
  asOf: Date,
) {
  const { skip, take } = pageWindow(range.page)
  const days = reportDays(range, scope)
  const keys = await tx.$queryRaw<(ReportKey & { total: number })[]>`
    SELECT "workdayId", "leaveDayId", count(*) OVER ()::int AS total FROM (${days}) report
    ORDER BY "workDate" DESC, coalesce("workdayId", "leaveDayId") DESC, "employeeId" DESC
    LIMIT ${take} OFFSET ${skip}
  `
  const total =
    keys[0]?.total ??
    (skip
      ? (
          await tx.$queryRaw<
            { total: number }[]
          >`SELECT count(*)::int AS total FROM (${days}) report`
        )[0].total
      : 0)
  return {
    rows: await loadReportDays(tx, keys, asOf),
    total,
    page: range.page,
    pageSize: PAGE_SIZE,
  }
}

export async function attendanceReportOverview(
  tx: Prisma.TransactionClient,
  range: ReportRange,
  scope: ReportScope,
  asOf: Date,
) {
  const keys = await tx.$queryRaw<ReportKey[]>`
    SELECT "workdayId", "leaveDayId" FROM (${reportDays(range, scope)}) report
    LIMIT 10001
  `
  if (keys.length > 10000)
    fail(400, "Narrow the overview date range to at most 10,000 records")
  return loadReportDays(tx, keys, asOf)
}
