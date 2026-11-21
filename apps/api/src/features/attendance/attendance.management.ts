import { Prisma } from "../../generated/prisma/client.js"
import { isDeepStrictEqual } from "node:util"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import {
  paginate,
  parsePage,
  insensitive,
} from "../../shared/query/pagination.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { isPlainObject, isRecordId, isUuidV4 } from "../../shared/validation.js"
import { actor, selfEmployee, policyAt } from "./attendance.service.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import {
  hasOperationalCapability,
  OperationalCapability,
} from "../auth/auth.capabilities.js"
import {
  attendancePolicyDays,
  attendanceTimestamp,
  attendanceTimeZone,
  attendanceWorkDate,
} from "./attendance.validation.js"
import { attendanceRepository } from "./attendance.repository.js"
import {
  attendanceReportOverview,
  attendanceReportPage,
} from "./attendance.reporting.js"
import { summarizeAttendance } from "./attendance.summary.js"
import { notifyPendingCorrection } from "./attendance.correction-notifications.js"
import {
  notifyOvertime,
  hrAdjustmentScope,
  hasPendingWorkdayCorrection,
  submitRecordedOvertime,
} from "./attendance.overtime.js"
import { parseAttendanceHistory } from "./attendance.schema.js"
import { setAttendanceAuditContext as context } from "../workforce-compliance-logs/write-context.js"
import {
  approvedLeaveForDate,
  approvedLeaveOverlappingInterval,
} from "../leave/leave.repository.js"

type PolicyAssignmentStatus = "SCHEDULED" | "ENDED" | "CURRENT" | "CANCELLED"

function policyAssignmentStatusAt(asOf: Date, timeZone: string) {
  const instant = Prisma.sql`${asOf.toISOString()}::timestamptz`
  // Match attendance_policy_at and the cancellation trigger at ambiguous midnight.
  return Prisma.sql`CASE
    WHEN "cancelledAt" IS NOT NULL THEN 'CANCELLED'
    WHEN ${instant} < ("effectiveFrom"::timestamp AT TIME ZONE ${timeZone})
      THEN 'SCHEDULED'
    WHEN ${instant} >= attendance_assignment_end_at("employeeId", "effectiveUntil", ${timeZone})
      THEN 'ENDED'
    ELSE 'CURRENT'
  END`
}

function attendanceEmployeeIdentity<
  T extends {
    fullName: string
    employeeId: string
    user: { fullName: string | null } | null
  },
>(employee: T) {
  const { user, ...identity } = employee
  const name = [employee.fullName, user?.fullName]
    .map((value) => value?.trim())
    .find((value) => value && !value.includes("@"))
  return { ...identity, fullName: name || `Employee ${employee.employeeId}` }
}

async function managementScope(
  tx: Prisma.TransactionClient,
  userId: string,
  configure = false,
) {
  const user = await actor(tx, userId)
  if (
    hasPermission(
      user.role,
      configure ? Permission.EMPLOYEES_MANAGE : Permission.EMPLOYEES_READ,
    )
  )
    return undefined
  if (!configure && user.role === "STAFF") {
    const head = await tx.department.findFirst({ where: { headId: userId } })
    if (head) return head.id
  }
  return fail(403, "Attendance management access is required")
}
function object(input: unknown, keys: string[]) {
  if (
    !isPlainObject(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    fail(400, "Invalid attendance fields")
  return input
}
function text(value: unknown, min = 1, max = 2000): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, "Provide a valid name or reason")
  return value.trim()
}
function id(value: unknown): string {
  if (!isRecordId(value)) fail(400, "Provide a valid record ID")
  return value
}
function validated<T>(parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    if (error instanceof RangeError) fail(400, error.message)
    throw error
  }
}
function policyInput(body: unknown) {
  const input = object(body, [
    "name",
    "timeZone",
    "days",
    "unpaidBreaksEnabled",
    "overnightRequiresReview",
  ])
  if (
    typeof input.unpaidBreaksEnabled !== "boolean" ||
    typeof input.overnightRequiresReview !== "boolean"
  )
    fail(400, "Choose break and overnight policy options")
  return {
    name: text(input.name, 1, 100),
    timeZone: validated(() => attendanceTimeZone(input.timeZone)),
    days: validated(() => attendancePolicyDays(input.days)),
    unpaidBreaksEnabled: input.unpaidBreaksEnabled,
    overnightRequiresReview: input.overnightRequiresReview,
  }
}
async function lockedPolicy(tx: Prisma.TransactionClient, policyId: string) {
  await tx.$queryRaw`SELECT id FROM "AttendancePolicy" WHERE id = ${policyId} FOR UPDATE`
  const policy = await tx.attendancePolicy.findUnique({
    where: { id: policyId },
    include: { _count: { select: { assignments: true } } },
  })
  if (!policy) fail(404, "Attendance policy not found")
  return policy
}
function sessionSnapshot(
  session: NonNullable<
    Awaited<ReturnType<typeof attendanceRepository.session>>
  >,
) {
  return {
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    breaks: session.breaks.map((pause) => ({
      id: pause.id,
      startedAt: pause.startedAt.toISOString(),
      endedAt: pause.endedAt?.toISOString() ?? null,
      isPaid: pause.isPaid,
    })),
  }
}
async function validateCorrection(
  tx: Prisma.TransactionClient,
  employeeId: string,
  start: Date,
  end: Date,
  now: Date,
  sessionId?: string,
) {
  if (end <= start || end > now)
    fail(
      400,
      "Correction timestamps must be ordered and cannot be in the future",
    )
  if (
    (await approvedLeaveOverlappingInterval(tx, employeeId, start, end)).length
  )
    fail(
      409,
      "Proposed attendance crosses approved leave; ask HR to reverse the leave first",
    )
  const session = sessionId
    ? await attendanceRepository.session(tx, employeeId, sessionId)
    : null
  if (sessionId && !session) fail(404, "Attendance session not found")
  const day = session
    ? await tx.attendanceWorkday.findUniqueOrThrow({
        where: { id: session.workdayId },
      })
    : null
  const workDate = day
    ? day.workDate.toISOString().slice(0, 10)
    : (await policyAt(tx, employeeId, start))?.workDate
  if (!workDate)
    fail(409, "No policy is assigned for the missing session's starting date")
  if (
    await tx.attendanceAdjustment.findFirst({
      where: {
        type: "OVERTIME",
        status: { in: ["PENDING", "VERIFIED", "APPROVED"] },
        session: { workday: { employeeId, workDate: new Date(workDate) } },
      },
      select: { id: true },
    })
  )
    fail(
      409,
      "Resolve overtime requests for this workday before correcting attendance",
    )
  if (await approvedLeaveForDate(tx, employeeId, workDate))
    fail(409, "Approved leave covers this attendance workday")
  if (session && day) {
    if (
      attendanceWorkDate(start, day.timeZone) !==
      attendanceWorkDate(session.startedAt, day.timeZone)
    )
      fail(400, "A correction must retain the session's starting local date")
    if (
      session.breaks.some(
        (pause) =>
          !pause.endedAt || pause.startedAt < start || pause.endedAt > end,
      )
    )
      fail(
        409,
        "The proposed session must contain its recorded breaks; end any open break first",
      )
  }
  if (
    await tx.attendanceWorkSession.findFirst({
      where: {
        employeeId,
        ...(sessionId ? { id: { not: sessionId } } : {}),
        startedAt: { lt: end },
        OR: [{ endedAt: null }, { endedAt: { gt: start } }],
      },
      select: { id: true },
    })
  )
    fail(409, "Proposed attendance overlaps another session")
  return session
}
async function validateOvertime(
  tx: Prisma.TransactionClient,
  employeeId: string,
  start: Date,
  end: Date,
  now: Date,
  excludeId?: string,
) {
  if (end <= start || end > now)
    fail(400, "Overtime must be recorded work in the past")
  if (
    (await approvedLeaveOverlappingInterval(tx, employeeId, start, end)).length
  )
    fail(
      409,
      "Overtime overlaps approved leave. Ask HR to reconcile the leave first.",
    )
  const session = await tx.attendanceWorkSession.findFirst({
    where: {
      employeeId,
      startedAt: { lte: start },
      endedAt: { gte: end },
    },
    include: { breaks: true, adjustments: { select: { id: true } } },
  })
  if (!session)
    fail(409, "Choose an overtime period inside a completed attendance session")
  const day = await attendanceRepository.workday(
    tx,
    employeeId,
    session.workdayId,
  )
  if (!day || day.sessions.some((item) => !item.endedAt))
    fail(409, "Clock out of this workday before requesting overtime")
  const unpaid = session.breaks
    .filter((pause) => !pause.isPaid)
    .reduce(
      (total, pause) =>
        total +
        Math.max(
          0,
          Math.min(end.getTime(), pause.endedAt?.getTime() ?? now.getTime()) -
            Math.max(start.getTime(), pause.startedAt.getTime()),
        ),
      0,
    )
  const minutes = Math.floor((end.getTime() - start.getTime() - unpaid) / 60000)
  if (minutes <= 0) fail(400, "Request at least one worked minute of overtime")
  const existing = await tx.attendanceAdjustment.findMany({
    where: {
      employeeId,
      type: "OVERTIME",
      status: { in: ["PENDING", "VERIFIED", "APPROVED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      session: { workdayId: day.id! },
    },
  })
  if (
    existing.some(
      (item) => item.proposedStartedAt < end && item.proposedEndedAt > start,
    )
  )
    fail(409, "Overtime overlaps an existing request")
  if (
    minutes +
      existing.reduce((total, item) => total + item.overtimeMinutes, 0) >
    Math.floor(summarizeAttendance(day, now).excessMinutes)
  )
    fail(409, "Requested overtime exceeds the workday's unclaimed excess hours")
  if (await hasPendingWorkdayCorrection(tx, day))
    fail(
      409,
      "Resolve pending attendance corrections before requesting overtime",
    )
  return { session, minutes }
}

const adjustmentInclude = {
  employee: {
    select: { id: true, fullName: true, employeeId: true, departmentId: true },
  },
  requestedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AttendanceAdjustmentInclude

async function adjustmentScope(
  tx: Prisma.TransactionClient,
  userId: string,
  scope: unknown,
): Promise<Prisma.AttendanceAdjustmentWhereInput> {
  if (scope !== undefined && scope !== "mine" && scope !== "team")
    fail(400, "Invalid adjustment scope")
  if (scope !== "team")
    return { employeeId: (await selfEmployee(tx, userId)).id }
  const departmentId = await managementScope(tx, userId)
  const user = await actor(tx, userId)
  return {
    employee: { departmentId },
    ...(user.role === "ADMIN" ? await hrAdjustmentScope(tx) : {}),
  }
}

/** Review eligibility only. Attendance validation, locks and stages still apply. */
function adjustmentReviewAccess(
  request: {
    requestedById: string
    employeeId: string
    type: string
    status: string
  },
  userId: string,
  ownEmployeeId: string | undefined,
  organization: boolean,
  management = true,
  superadmin = false,
  exception = false,
) {
  const own =
    request.requestedById === userId || request.employeeId === ownEmployeeId
  const reviewable =
    request.status === "PENDING" || request.status === "VERIFIED"
  const finalReview = request.status === "VERIFIED" || exception
  const allowed = management && !own && reviewable
  return {
    own,
    reviewable,
    approve:
      allowed &&
      (superadmin || (organization && finalReview)),
    verify: allowed && !organization && request.status === "PENDING",
    reject:
      allowed &&
      (superadmin ||
        (organization
          ? finalReview
          : request.status === "PENDING")),
  }
}

export function createAttendanceManagement(clock: () => Date) {
  return {
    async departments(userId: string) {
      return getPrisma()!.$transaction(
        async (tx) => {
          const scope = await managementScope(tx, userId)
          return {
            departments: await tx.department.findMany({
              where: scope ? { id: scope } : {},
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            }),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async records(
      userId: string,
      query: Record<string, unknown>,
      audit = false,
    ) {
      const input = object(query, [
        "from",
        "to",
        "page",
        "employeeId",
        "departmentId",
        ...(audit ? ["recordsOnly", "search"] : []),
      ])
      if (input.recordsOnly !== undefined && input.recordsOnly !== "true")
        fail(400, "Invalid record audit filter")
      const search = audit ? parseQueryString(input.search) : ""
      if (search === null || search.length > 100)
        fail(400, "Invalid attendance search")
      const range = parseAttendanceHistory(
        { from: input.from, to: input.to, page: input.page },
        clock(),
      )
      const employeeId =
        input.employeeId === undefined || input.employeeId === ""
          ? undefined
          : id(input.employeeId)
      const requestedDepartment =
        input.departmentId === undefined || input.departmentId === ""
          ? undefined
          : id(input.departmentId)
      return getPrisma()!.$transaction(
        async (tx) => {
          const scope = await managementScope(tx, userId)
          if (scope && requestedDepartment && scope !== requestedDepartment)
            fail(403, "Department is outside your attendance scope")
          const departmentId = scope ?? requestedDepartment
          if (
            departmentId &&
            !(await tx.department.findUnique({
              where: { id: departmentId },
              select: { id: true },
            }))
          )
            fail(404, "Department not found")
          if (
            employeeId &&
            !(await tx.employee.findFirst({
              where: {
                id: employeeId,
                ...(departmentId ? { departmentId } : {}),
              },
              select: { id: true },
            }))
          )
            fail(404, "Employee not found")
          const employee = {
            ...(employeeId ? { id: employeeId } : {}),
            ...(departmentId ? { departmentId } : {}),
          }
          const now = clock()
          if (audit) {
            const until = new Date(range.to)
            until.setUTCDate(until.getUTCDate() + 1)
            const where: Prisma.AttendanceAuditWhereInput = {
              createdAt: { gte: range.from, lt: until },
              ...(input.recordsOnly === "true"
                ? {
                    entityType: {
                      in: [
                        "AttendanceWorkday",
                        "AttendanceWorkSession",
                        "AttendanceBreak",
                      ],
                    },
                  }
                : {}),
              ...(employeeId || departmentId
                ? { employee: { is: employee } }
                : {}),
              ...insensitive<Prisma.AttendanceAuditWhereInput>(search, [
                "action",
                "entityType",
                "reason",
                "actorId",
                (filter) => ({ employee: { is: { fullName: filter } } }),
                (filter) => ({ employee: { is: { employeeId: filter } } }),
                (filter) => ({ actor: { is: { fullName: filter } } }),
                (filter) => ({ actor: { is: { email: filter } } }),
              ]),
            }
            const { rows, ...paging } = await paginate(
              range.page,
              {
                rows: (db, window) =>
                  db.attendanceAudit.findMany({
                    where,
                    omit: {
                      operationId: true,
                      correlationId: true,
                      actorRoleAtTime: true,
                    },
                    include: {
                      actor: { select: { fullName: true } },
                      employee: { select: { fullName: true } },
                    },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    ...window,
                  }),
                count: (db) => db.attendanceAudit.count({ where }),
              },
              { tx },
            )
            const actions = await tx.attendanceAudit.groupBy({
              by: ["action"],
              where,
              _count: { _all: true },
              orderBy: { action: "asc" },
            })
            return {
              asOf: now,
              ...paging,
              events: rows,
              actionCounts: actions.map((row) => ({
                action: row.action,
                count: row._count._all,
              })),
            }
          }
          const { rows, ...paging } = await attendanceReportPage(
            tx,
            range,
            { employeeId, departmentId },
            now,
          )
          const suspendedRows = rows.filter(({ day }) =>
            day.sessions.some(
              (session) => !session.endedAt && session.suspendedAt,
            ),
          )
          const canManageReconciliation =
            suspendedRows.length > 0 &&
            hasPermission(
              (await actor(tx, userId)).role,
              Permission.EMPLOYEES_MANAGE,
            )
          const reconcilableWorkdays = new Set(
            canManageReconciliation
              ? suspendedRows
                  .filter(({ employee }) => employee.user?.id !== userId)
                  .map(({ day }) => day.id)
              : [],
          )
          return {
            asOf: now,
            ...paging,
            workdays: rows.map(({ day, employee }) => ({
              ...day,
              employee: attendanceEmployeeIdentity(employee),
              canReconcile: reconcilableWorkdays.has(day.id),
            })),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async employees(userId: string, query: Record<string, unknown>) {
      const input = object(query, ["search", "page", "departmentId"])
      const page = parsePage(input.page)
      const search =
        input.search === undefined ? "" : text(input.search, 0, 100)
      if (page === null) fail(400, "Invalid employee page")
      return getPrisma()!.$transaction(
        async (tx) => {
          const scope = await managementScope(tx, userId)
          const requested =
            input.departmentId === undefined || input.departmentId === ""
              ? undefined
              : id(input.departmentId)
          if (scope && requested && scope !== requested)
            fail(403, "Department is outside your attendance scope")
          const departmentId = scope ?? requested
          const where: Prisma.EmployeeWhereInput = {
            ...(departmentId ? { departmentId } : {}),
            ...insensitive<Prisma.EmployeeWhereInput>(search, [
              "fullName",
              "employeeId",
            ]),
          }
          const { rows, ...paging } = await paginate(
            page,
            {
              rows: (db, window) =>
                db.employee.findMany({
                  where,
                  select: {
                    id: true,
                    fullName: true,
                    employeeId: true,
                    departmentId: true,
                    user: { select: { fullName: true } },
                  },
                  orderBy: [{ fullName: "asc" }, { id: "asc" }],
                  ...window,
                }),
              count: (db) => db.employee.count({ where }),
            },
            { tx },
          )
          return { employees: rows.map(attendanceEmployeeIdentity), ...paging }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async overview(
      userId: string,
      query: Record<string, unknown>,
      personal = false,
    ) {
      const input = object(query, [
        "from",
        "to",
        ...(personal ? [] : ["departmentId"]),
      ])
      const range = parseAttendanceHistory(
        { from: input.from, to: input.to },
        clock(),
      )
      const requestedDepartment =
        input.departmentId === undefined || input.departmentId === ""
          ? undefined
          : id(input.departmentId)
      return getPrisma()!.$transaction(
        async (tx) => {
          const employee = personal ? await selfEmployee(tx, userId) : null
          const scope = personal ? undefined : await managementScope(tx, userId)
          if (scope && requestedDepartment && scope !== requestedDepartment)
            fail(403, "Department is outside your attendance scope")
          const departmentId = scope ?? requestedDepartment
          if (
            departmentId &&
            !(await tx.department.findUnique({
              where: { id: departmentId },
              select: { id: true },
            }))
          )
            fail(404, "Department not found")
          const now = clock()
          const rows = await attendanceReportOverview(
            tx,
            range,
            { employeeId: employee?.id, departmentId },
            now,
          )
          const days = rows.map(({ day }) => day)
          const recorded = rows.filter(({ day }) => day.id !== null)
          const approvedLeave = days.filter(
            (day) => day.approvedLeaveMinutes > 0,
          )
          const statusBreakdown = {
            NOT_STARTED: 0,
            IN_PROGRESS: 0,
            HOURS_MET: 0,
            INCOMPLETE: 0,
            COMPLETE: 0,
            NOT_REQUIRED: 0,
          }
          for (const day of days) {
            const status = day.status as keyof typeof statusBreakdown
            statusBreakdown[status] += 1
          }
          const sessions = recorded.flatMap(({ day }) => day.sessions)
          const open = sessions.filter((session) => !session.endedAt && !session.suspendedAt)
          const onBreak = open.filter((session) =>
            session.breaks.some((pause) => !pause.endedAt && !pause.isPaid),
          ).length
          const recentActivity = recorded
            .flatMap(({ day, employee }) =>
              day.sessions.flatMap((session) => [
                {
                  id: session.id + ":in",
                  action: "CLOCK_IN" as const,
                  at: session.startedAt,
                  employeeName: employee.fullName,
                },
                ...(session.endedAt
                  ? [
                      {
                        id: session.id + ":out",
                        action: "CLOCK_OUT" as const,
                        at: session.endedAt,
                        employeeName: employee.fullName,
                      },
                    ]
                  : []),
                ...session.breaks.flatMap((pause) => [
                  {
                    id: pause.id + ":start",
                    action: "BREAK_START" as const,
                    at: pause.startedAt,
                    employeeName: employee.fullName,
                  },
                  ...(pause.endedAt
                    ? [
                        {
                          id: pause.id + ":end",
                          action: "BREAK_END" as const,
                          at: pause.endedAt,
                          employeeName: employee.fullName,
                        },
                      ]
                    : []),
                ]),
              ]),
            )
            .sort(
              (a, b) =>
                b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id),
            )
            .slice(0, 8)
          return {
            checkIns: {
              employees: new Set(
                recorded
                  .filter(({ day }) => day.sessions.length)
                  .map(({ day }) => day.employeeId),
              ).size,
              total: sessions.length,
              closed: sessions.filter(session=>session.endedAt).length,
              working: open.length - onBreak,
              onBreak,
              recentActivity,
            },
            asOf: now,
            scope: personal
              ? "PERSONAL"
              : departmentId
                ? "DEPARTMENT"
                : "ORGANIZATION",
            recordedDays: recorded.length,
            employees: new Set(recorded.map(({ day }) => day.employeeId)).size,
            approvedLeaveDays: approvedLeave.length,
            approvedLeaveHours:
              approvedLeave.reduce(
                (sum, day) => sum + day.approvedLeaveMinutes,
                0,
              ) / 60,
            workedHours: days.reduce((sum, day) => sum + day.workedHours, 0),
            requiredHours: days.reduce(
              (sum, day) => sum + day.requiredHours,
              0,
            ),
            completeDays: days.filter(
              (day) => day.isComplete && day.requiredMinutes > 0,
            ).length,
            activeSessions: days.filter((day) => day.activeSessionId).length,
            excessDays: days.filter((day) => day.excessRequiresReview).length,
            pendingCorrections: days.reduce(
              (sum, day) => sum + day.pendingCorrections,
              0,
            ),
            overnightReviews: days.filter((day) => day.overnightRequiresReview)
              .length,
            statusBreakdown,
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async policies(userId: string, query: Record<string, unknown> = {}) {
      object(query, ["page", "search", "status", "size"])
      const page = parsePage(query.page)
      const search = parseQueryString(query.search)
      if (page === null || search === null || search.length > 100 ||
          (query.size !== undefined && query.size !== "10" && query.size !== "200") ||
          (query.status !== undefined && query.status !== "active" && query.status !== "archived"))
        fail(400, "Invalid policy directory filters")
      const pageSize = query.size === "10" ? 10 : 200
      const where: Prisma.AttendancePolicyWhereInput = {
        ...(query.status === "active" ? { archivedAt: null } : query.status === "archived" ? { archivedAt: { not: null } } : {}),
        ...insensitive<Prisma.AttendancePolicyWhereInput>(search, ["name", "timeZone"]),
      }
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const [totalPolicies, activePolicies, assignmentPeriods] =
          await Promise.all([
            tx.attendancePolicy.count(),
            tx.attendancePolicy.count({ where: { archivedAt: null } }),
            tx.attendancePolicyAssignment.count({
              where: { cancelledAt: null },
            }),
          ])
        return {
          page, pageSize,
          total: search || query.status ? await tx.attendancePolicy.count({where}) : totalPolicies,
          summary: {
            totalPolicies,
            activePolicies,
            archivedPolicies: totalPolicies - activePolicies,
            assignmentPeriods,
          },
          policies: await tx.attendancePolicy.findMany({
            include: {
              days: { orderBy: { weekday: "asc" } },
              _count: { select: { assignments: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        }
      }, {isolationLevel: "RepeatableRead"})
    },
    async createPolicy(userId: string, body: unknown) {
      const { days, ...input } = policyInput(body)
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const zones = await tx.$queryRaw<
          { name: string }[]
        >`SELECT name FROM pg_timezone_names WHERE name = ${input.timeZone}`
        if (!zones.length)
          fail(400, "Choose a named attendance timezone such as Asia/Manila")
        await context(tx, userId, "Created attendance policy version")
        return {
          policy: await tx.attendancePolicy.create({
            data: {
              ...input,
              days: { create: days },
            },
            include: { days: true },
          }),
        }
      })
    },
    async updatePolicy(userId: string, policyId: string, body: unknown) {
      const { days, ...input } = policyInput(body)
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const policy = await lockedPolicy(tx, policyId)
        if (policy.archivedAt)
          fail(409, "Restore the archived policy before editing it")
        const futureLeave = await tx.leaveRequestDay.findFirst({
          where: {
            assignment: { policyId },
            request: { status: "APPROVED" },
            workDate: {
              gte: new Date(attendanceWorkDate(clock(), policy.timeZone)),
            },
          },
        })
        if (futureLeave)
          fail(
            409,
            "Reverse future approved leave before editing its attendance policy",
          )
        if (policy._count.assignments && policy.timeZone !== input.timeZone)
          fail(
            409,
            "Assigned policies must retain their timezone. Create a policy for a different timezone.",
          )
        const zones = await tx.$queryRaw<
          { name: string }[]
        >`SELECT name FROM pg_timezone_names WHERE name = ${input.timeZone}`
        if (!zones.length)
          fail(400, "Choose a named attendance timezone such as Asia/Manila")
        await context(
          tx,
          userId,
          "Updated attendance policy; recorded workday snapshots retained",
        )
        await tx.attendancePolicy.update({
          where: { id: policyId },
          data: input,
        })
        for (const day of days) {
          const { weekday, ...rule } = day
          await tx.attendancePolicyDay.upsert({
            where: { policyId_weekday: { policyId, weekday } },
            update: rule,
            create: { policyId, ...day },
          })
        }
        return {
          policy: await tx.attendancePolicy.findUniqueOrThrow({
            where: { id: policyId },
            include: {
              days: { orderBy: { weekday: "asc" } },
              _count: { select: { assignments: true } },
            },
          }),
        }
      })
    },
    async archivePolicy(userId: string, policyId: string, archived: boolean) {
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const policy = await lockedPolicy(tx, policyId)
        await context(
          tx,
          userId,
          archived
            ? "Archived attendance policy"
            : "Restored attendance policy",
        )
        return {
          policy: await tx.attendancePolicy.update({
            where: { id: policyId },
            data: {
              archivedAt: archived ? (policy.archivedAt ?? clock()) : null,
            },
          }),
        }
      })
    },
    async deletePolicy(userId: string, policyId: string) {
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const policy = await lockedPolicy(tx, policyId)
        if (!policy.archivedAt)
          fail(409, "Archive the policy before permanently deleting it")
        if (policy._count.assignments)
          fail(
            409,
            "This policy has assignments and must be retained for attendance history. You can leave it archived.",
          )
        await context(
          tx,
          userId,
          "Permanently deleted archived attendance policy",
        )
        await tx.attendancePolicyDay.deleteMany({ where: { policyId } })
        await tx.attendancePolicy.delete({ where: { id: policyId } })
        return { deleted: true }
      })
    },
    async policyAssignments(
      userId: string,
      policyId: string,
      query: Record<string, unknown>,
    ) {
      const input = object(query, ["page"])
      const page = parsePage(input.page)
      if (page === null) fail(400, "Invalid assignment page")
      return getPrisma()!.$transaction(
        async (tx) => {
          await managementScope(tx, userId, true)
          const policy = await tx.attendancePolicy.findUnique({
            where: { id: policyId },
          })
          if (!policy) fail(404, "Attendance policy not found")
          const where = { policyId }
          const { rows, ...paging } = await paginate(
            page,
            {
              rows: (db, window) =>
                db.attendancePolicyAssignment.findMany({
                  where,
                  include: {
                    employee: {
                      select: {
                        id: true,
                        fullName: true,
                        employeeId: true,
                        departmentId: true,
                        department: { select: { name: true } },
                      },
                    },
                  },
                  orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
                  ...window,
                }),
              count: (db) => db.attendancePolicyAssignment.count({ where }),
            },
            { tx },
          )
          const asOf = clock()
          const statuses = rows.length
            ? await tx.$queryRaw<
                { id: string; status: PolicyAssignmentStatus }[]
              >`
                SELECT id, ${policyAssignmentStatusAt(asOf, policy.timeZone)} AS status
                FROM "AttendancePolicyAssignment"
                WHERE id IN (${Prisma.join(rows.map(({ id }) => id))})
              `
            : []
          const statusById = new Map(
            statuses.map(({ id, status }) => [id, status]),
          )
          return {
            ...paging,
            assignments: rows.map((assignment) => ({
              ...assignment,
              status: statusById.get(assignment.id)!,
            })),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async unassignPolicy(userId: string, assignmentId: string) {
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        const initial = await tx.attendancePolicyAssignment.findUnique({
          where: { id: assignmentId },
        })
        if (!initial) fail(404, "Policy assignment not found")
        await lockRows(tx, "Employee", initial.employeeId)
        const assignment =
          await tx.attendancePolicyAssignment.findUniqueOrThrow({
            where: { id: assignmentId },
            include: { policy: true },
          })
        if (assignment.cancelledAt) return { unassigned: true }
        const now = clock()
        const [{ status }] = await tx.$queryRaw<
          { status: PolicyAssignmentStatus }[]
        >`
          SELECT ${policyAssignmentStatusAt(now, assignment.policy.timeZone)} AS status
          FROM "AttendancePolicyAssignment"
          WHERE id = ${assignmentId}
        `
        const scheduled = status === "SCHEDULED"
        const today = attendanceWorkDate(now, assignment.policy.timeZone)
        const tomorrow = new Date(today)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        if (
          await tx.leaveRequestDay.findFirst({
            where: {
              assignmentId,
              ...(scheduled ? {} : { workDate: { gte: tomorrow } }),
              request: {
                status: { in: ["SUBMITTED", "VERIFIED", "APPROVED"] },
              },
            },
          })
        )
          fail(
            409,
            "Resolve future leave requests before ending this assignment",
          )
        if (
          status === "ENDED" ||
          (!scheduled &&
            assignment.effectiveUntil &&
            assignment.effectiveUntil <= tomorrow)
        )
          fail(409, "This assignment has already ended or is already ending")
        await context(tx, userId, "Unassigned attendance policy")
        if (scheduled) {
          if (await tx.attendanceWorkday.findFirst({ where: { assignmentId } }))
            fail(
              409,
              "This assignment has recorded attendance and cannot be cancelled",
            )
          const leaveHistory = await tx.leaveRequestDay.findFirst({
            where: { assignmentId },
            select: { id: true },
          })
          if (leaveHistory) {
            await tx.attendancePolicyAssignment.update({
              where: { id: assignmentId },
              data: { cancelledAt: now },
            })
          } else {
            await tx.attendancePolicyAssignment.delete({
              where: { id: assignmentId },
            })
          }
          const next = await tx.attendancePolicyAssignment.findFirst({
            where: {
              employeeId: assignment.employeeId,
              cancelledAt: null,
              effectiveFrom: { gt: assignment.effectiveFrom },
            },
            orderBy: { effectiveFrom: "asc" },
          })
          let restoredId: string | null = null
          let restoredUntil = assignment.replacedUntil
          if (assignment.replacedAssignmentId) {
            if (next && (!restoredUntil || next.effectiveFrom < restoredUntil))
              restoredUntil = next.effectiveFrom
            const restored = await tx.attendancePolicyAssignment.updateMany({
              where: {
                id: assignment.replacedAssignmentId,
                employeeId: assignment.employeeId,
                cancelledAt: null,
                effectiveUntil: assignment.effectiveFrom,
              },
              data: { effectiveUntil: restoredUntil },
            })
            if (restored.count) restoredId = assignment.replacedAssignmentId
          }
          if (next?.replacedAssignmentId === assignment.id) {
            const continues = restoredUntil?.getTime() === next.effectiveFrom.getTime()
              && assignment.replacedUntil?.getTime() !== next.effectiveFrom.getTime()
            await tx.attendancePolicyAssignment.update({
              where: { id: next.id },
              data: {
                replacedAssignmentId: continues ? restoredId : null,
                replacedUntil: continues && restoredId ? assignment.replacedUntil : null,
              },
            })
          }
        } else {
          if (
            await tx.attendanceWorkday.findFirst({
              where: { assignmentId, workDate: { gte: tomorrow } },
            })
          )
            fail(
              409,
              "This assignment has future attendance records and cannot end tomorrow",
            )
          await tx.attendancePolicyAssignment.update({
            where: { id: assignmentId },
            data: { effectiveUntil: tomorrow },
          })
        }
        return { unassigned: true }
      })
    },
    async assignPolicy(userId: string, body: unknown) {
      const input = object(body, ["employeeId", "policyId", "effectiveFrom"])
      const employeeId = id(input.employeeId),
        policyId = id(input.policyId)
      const from = parseAttendanceHistory(
        { from: input.effectiveFrom, to: input.effectiveFrom },
        clock(),
      ).from
      const effectiveDate = from.toISOString().slice(0, 10)
      return getPrisma()!.$transaction(
        async (tx) => {
          await managementScope(tx, userId, true)
          await lockRows(tx, "Employee", employeeId)
          const locked = await lockedPolicy(tx, policyId)
          if (locked.archivedAt)
            fail(409, "Restore the archived policy before assigning it")
          const policy = await tx.attendancePolicy.findUnique({
            where: { id: policyId },
            include: { days: true },
          })
          if (
            !policy ||
            !(await tx.employee.findUnique({ where: { id: employeeId } }))
          )
            fail(404, "Employee or policy not found")
          if (policy.days.length !== 7)
            fail(409, "Configure all seven weekdays before assignment")
          if (effectiveDate < attendanceWorkDate(clock(), policy.timeZone))
            fail(400, "Policy assignments must start today or later")
          const overlapping = await tx.attendancePolicyAssignment.findMany({
            where: {
              employeeId,
              cancelledAt: null,
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: from } }],
            },
          })
          if (
            await tx.leaveRequestDay.findFirst({
              where: {
                employeeId,
                workDate: { gte: from },
                request: { status: "APPROVED" },
              },
            })
          )
            fail(
              409,
              "Reverse future approved leave before changing its policy assignment",
            )
          if (overlapping.some((item) => item.effectiveFrom >= from))
            fail(409, "An assignment already starts on or after that date")
          if (
            await tx.attendanceWorkday.findFirst({
              where: { employeeId, workDate: { gte: from } },
            })
          )
            fail(409, "Choose a date after existing attendance records")
          // The new policy supplies the cutoff even for a period already ending on this date.
          const [{ conflict }] = await tx.$queryRaw<{ conflict: boolean }[]>`
            SELECT EXISTS (
              SELECT 1
              FROM "AttendancePolicyAssignment" previous
              JOIN "AttendancePolicy" outgoing ON outgoing.id = previous."policyId"
              WHERE previous."employeeId" = ${employeeId}
                AND previous."cancelledAt" IS NULL
                AND previous."effectiveFrom" < ${effectiveDate}::date
                AND (previous."effectiveUntil" IS NULL OR previous."effectiveUntil" >= ${effectiveDate}::date)
                AND (previous."effectiveFrom"::timestamp AT TIME ZONE outgoing."timeZone")
                  >= (${effectiveDate}::date::timestamp AT TIME ZONE ${policy.timeZone})
            ) AS conflict
          `
          if (conflict)
            fail(
              409,
              "Choose an effective date whose midnight is after the previous assignment starts",
            )
          await context(tx, userId, "Assigned attendance policy version")
          for (const item of overlapping)
            await tx.attendancePolicyAssignment.update({
              where: { id: item.id },
              data: { effectiveUntil: from },
            })
          return {
            assignment: await tx.attendancePolicyAssignment.create({
              data: {
                employeeId, policyId, effectiveFrom: from,
                replacedAssignmentId: overlapping[0]?.id,
                replacedUntil: overlapping[0]?.effectiveUntil,
              },
            }),
          }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
    async adjustmentDetail(userId:string, adjustmentId:string) {
      return getPrisma()!.$transaction(async tx=>{
        const user=await actor(tx,userId)
        if(user.role==="USER") fail(403,"Workforce access required")
        const employee=await tx.employee.findUnique({where:{userId},select:{id:true}})
        const head=user.role==="STAFF" ? await tx.department.findUnique({where:{headId:userId},select:{id:true}}) : null
        const organization=hasPermission(user.role,Permission.EMPLOYEES_READ)
        const scope: Prisma.AttendanceAdjustmentWhereInput[]=[{requestedById:userId}]
        if(employee) scope.push({employeeId:employee.id})
        if(head) scope.push({employee:{departmentId:head.id}})
        if(user.role==="ADMIN" && organization) scope.push(await hrAdjustmentScope(tx))
        const row=await tx.attendanceAdjustment.findFirst({where:{id:adjustmentId,...(user.role==="SUPERADMIN" && organization?{}:{OR:scope})},include:adjustmentInclude})
        if(!row) fail(404,"Attendance request not found")
        const {approve,verify,reject}=adjustmentReviewAccess(row,userId,employee?.id,organization,organization || head?.id===row.employee.departmentId,user.role==="SUPERADMIN",user.role==="ADMIN" && organization)
        return {adjustment:{...row,capabilities:{approve,verify,reject}}}
      },{isolationLevel:"RepeatableRead"})
    },
    async adjustmentOverview(userId: string, query: Record<string, unknown>) {
      object(query, ["scope"])
      return getPrisma()!.$transaction(
        async (tx) => {
          const where = await adjustmentScope(tx, userId, query.scope)
          const exceptions = await tx.attendanceAdjustment.groupBy({by:["type"],where:{AND:[where, await hrAdjustmentScope(tx)],status:"PENDING"},_count:{_all:true}})
          const rows = await tx.attendanceAdjustment.groupBy({
            by: ["type", "status"],
            where,
            _count: { _all: true },
            _sum: { overtimeMinutes: true },
          })
          return {
            groups: rows.map((row) => ({
              type: row.type,
              status: row.status,
              count: row._count._all,
              overtimeMinutes: row._sum.overtimeMinutes ?? 0,
              awaitingHrPending: row.status === "PENDING" ? exceptions.find(item=>item.type===row.type)?._count._all ?? 0 : 0,
            })),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async adjustments(userId: string, query: Record<string, unknown>) {
      object(query, ["scope", "page", "search", "type", "status"])
      const status = query.status
      if (
        status !== undefined &&
        status !== "" &&
        status !== "PENDING" &&
        status !== "VERIFIED" &&
        status !== "APPROVED" &&
        status !== "REJECTED"
      )
        fail(400, "Invalid request status")
      if (
        query.type !== undefined &&
        query.type !== "" &&
        query.type !== "CORRECTION" &&
        query.type !== "OVERTIME"
      )
        fail(400, "Invalid request type")
      const page = parsePage(query.page)
      const search = parseQueryString(query.search)
      if (
        page === null ||
        search === null ||
        search.length > 100 ||
        (query.scope !== undefined &&
          query.scope !== "mine" &&
          query.scope !== "team")
      )
        fail(400, "Invalid adjustment filters")
      return getPrisma()!.$transaction(
        async (tx) => {
          const scopeWhere = await adjustmentScope(tx, userId, query.scope)
          const user = await actor(tx, userId)
          const ownEmployee = await tx.employee.findUnique({
            where: { userId },
            select: { id: true, userId: true },
          })
          const where: Prisma.AttendanceAdjustmentWhereInput = {
            ...(query.type ? { type: String(query.type) } : {}),
            ...(status ? { status } : {}),
            AND: [scopeWhere],
            ...insensitive<Prisma.AttendanceAdjustmentWhereInput>(search, [
              "reason",
              (filter) => ({ employee: { is: { fullName: filter } } }),
              (filter) => ({ employee: { is: { employeeId: filter } } }),
            ]),
          }
          const { rows, ...paging } = await paginate(
            page,
            {
              rows: (db, window) =>
                db.attendanceAdjustment.findMany({
                  where,
                  include: adjustmentInclude,
                  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                  ...window,
                }),
              count: (db) => db.attendanceAdjustment.count({ where }),
            },
            { tx },
          )
          return {
            adjustments: rows.map((row) => {
              const { approve, verify, reject } = adjustmentReviewAccess(
                row,
                userId,
                ownEmployee?.id,
                hasPermission(user.role, Permission.EMPLOYEES_READ),
                query.scope === "team",
                user.role === "SUPERADMIN",
                user.role === "ADMIN" && query.scope === "team",
              )
              return { ...row, capabilities: { approve, verify, reject } }
            }),
            capabilities: {
              requestCorrection: hasOperationalCapability(
                { ...user, id: userId },
                {
                  capability: OperationalCapability.EMPLOYEE_SELF_SERVICE,
                  employeeUserId: ownEmployee?.userId ?? null,
                },
              ),
            },
            ...paging,
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async requestAdjustment(userId: string, body: unknown) {
      const input = object(body, [
        "type",
        "requestKey",
        "sessionId",
        "startedAt",
        "endedAt",
        "reason",
      ])
      const type = input.type ?? "CORRECTION"
      if (type !== "CORRECTION" && type !== "OVERTIME")
        fail(400, "Invalid request type")
      if (!isUuidV4(input.requestKey)) fail(400, "Provide a UUID request key")
      const requestKey = input.requestKey
      const sessionId =
        input.sessionId === undefined ? undefined : id(input.sessionId)
      const proposedStartedAt = validated(() =>
          attendanceTimestamp(input.startedAt),
        ),
        proposedEndedAt = validated(() => attendanceTimestamp(input.endedAt))
      const reason = text(input.reason, 5)
      return getPrisma()!.$transaction(
        async (tx) => {
          const placement =
            type === "CORRECTION"
              ? await tx.employee.findUnique({
                  where: { userId },
                  select: { id: true, departmentId: true },
                })
              : null
          // Head changes lock the department before changing review authority.
          await lockRows(tx, "Department", placement?.departmentId, "share")
          const employee = await selfEmployee(tx, userId, true)
          if (
            type === "CORRECTION" &&
            (placement?.id !== employee.id ||
              placement.departmentId !== employee.departmentId)
          )
            fail(409, "Employee placement changed; refresh and try again")
          const existing = await tx.attendanceAdjustment.findUnique({
            where: { requestKey },
          })
          if (existing) {
            if (
              existing.requestedById !== userId ||
              existing.reason !== reason ||
              existing.type !== type ||
              (type === "CORRECTION" &&
                existing.sessionId !== (sessionId ?? null)) ||
              existing.proposedStartedAt.getTime() !==
                proposedStartedAt.getTime() ||
              existing.proposedEndedAt.getTime() !== proposedEndedAt.getTime()
            )
              fail(409, "Request key has already been used")
            return { adjustment: existing }
          }
          const overtime =
            type === "OVERTIME"
              ? await validateOvertime(
                  tx,
                  employee.id,
                  proposedStartedAt,
                  proposedEndedAt,
                  clock(),
                )
              : null
          const session =
            overtime?.session ??
            (await validateCorrection(
              tx,
              employee.id,
              proposedStartedAt,
              proposedEndedAt,
              clock(),
              sessionId,
            ))
          if (
            type === "CORRECTION" &&
            sessionId &&
            (await tx.attendanceAdjustment.findFirst({
              where: {
                sessionId,
                status: { in: ["PENDING", "VERIFIED"] },
                type: "CORRECTION",
              },
            }))
          )
            fail(409, "This session already has a pending correction")
          await context(tx, userId, reason)
          const adjustment = await tx.attendanceAdjustment.create({
            data: {
              requestKey,
              type,
              overtimeMinutes: overtime?.minutes ?? 0,
              employeeId: employee.id,
              sessionId: session?.id,
              ...(session ? { originalSession: sessionSnapshot(session) } : {}),
              proposedStartedAt,
              proposedEndedAt,
              reason,
              requestedById: userId,
            },
          })
          if (type === "CORRECTION")
            await notifyPendingCorrection(tx, adjustment.id)
          else await notifyOvertime(tx, adjustment.id, "PENDING")
          return { adjustment }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
    async reviewAdjustment(
      userId: string,
      adjustmentId: string,
      body: unknown,
    ) {
      const input = object(body, ["decision", "note"])
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED")
        fail(400, "Choose approve or reject")
      const decision = input.decision
      const note = text(input.note, 5)
      return getPrisma()!.$transaction(
        async (tx) => {
          const snapshot = await tx.attendanceAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { employee: true },
          })
          if (!snapshot) fail(404, "Adjustment not found")
          const departmentId = await managementScope(tx, userId)
          if (departmentId && departmentId !== snapshot.employee.departmentId)
            fail(404, "Adjustment not found")
          await lockRows(
            tx,
            "Department",
            snapshot.employee.departmentId,
            "share",
          )
          await lockRows(tx, "Employee", snapshot.employeeId)
          await lockRows(tx, "User", userId, "share")
          await lockRows(tx, "AttendanceAdjustment", adjustmentId)
          const currentScope = await managementScope(tx, userId)
          const currentEmployee = await tx.employee.findUniqueOrThrow({
            where: { id: snapshot.employeeId },
          })
          if (currentScope && currentScope !== currentEmployee.departmentId)
            fail(404, "Adjustment not found")
          const request = await tx.attendanceAdjustment.findUniqueOrThrow({
            where: { id: adjustmentId },
          })
          const reviewer = await actor(tx, userId)
          if(currentEmployee.departmentId !== snapshot.employee.departmentId)
            fail(409,"Employee placement changed; refresh and try again")
          const exception = reviewer.role === "ADMIN" && request.status === "PENDING" && Boolean(await tx.attendanceAdjustment.findFirst({
            where:{id:request.id,...await hrAdjustmentScope(tx)},select:{id:true}
          }))
          const access = adjustmentReviewAccess(
            request,
            userId,
            currentEmployee.userId === userId ? currentEmployee.id : undefined,
            !currentScope,
            true,
            reviewer.role === "SUPERADMIN",
            exception,
          )
          if (access.own)
            fail(403, "You cannot review your own attendance request")
          const overtime = request.type === "OVERTIME"
          if (!access.reviewable)
            fail(409, "This request has already been reviewed")
          if (reviewer.role === "ADMIN" && request.status === "PENDING" && !exception)
            fail(
              403,
              "Department Head verification is required before HR review",
            )
          if (currentScope && request.status === "VERIFIED")
            fail(403, "HR must finalize verified requests")
          await context(tx, userId, note)
          if (overtime) {
            if (!currentScope && decision === "APPROVED" && !access.approve)
              fail(
                409,
                "Department Head verification is required before HR approval",
              )
            if (request.status === "VERIFIED" && currentScope)
              fail(403, "HR must finalize verified overtime")
            if (decision === "APPROVED") {
              const checked = await validateOvertime(
                tx,
                request.employeeId,
                request.proposedStartedAt,
                request.proposedEndedAt,
                clock(),
                request.id,
              )
              if (checked.minutes !== request.overtimeMinutes)
                fail(409, "Attendance changed; submit a new overtime request")
              if (currentScope) {
                await notifyOvertime(tx, request.id, "VERIFIED")
                return {
                  adjustment: await tx.attendanceAdjustment.update({
                    where: { id: request.id },
                    data: {
                      status: "VERIFIED",
                      verifiedById: userId,
                      verifiedAt: clock(),
                      verificationNote: note,
                    },
                    include: adjustmentInclude,
                  }),
                }
              }
            }
          }
          if (decision === "APPROVED" && !overtime) {
            const session = await validateCorrection(
              tx,
              request.employeeId,
              request.proposedStartedAt,
              request.proposedEndedAt,
              clock(),
              request.sessionId ?? undefined,
            )
            if (
              session &&
              !isDeepStrictEqual(
                sessionSnapshot(session),
                request.originalSession,
              )
            )
              fail(
                409,
                "Attendance changed after submission; request a new correction",
              )
            if (currentScope) {
              const adjustment = await tx.attendanceAdjustment.update({
                where: { id: request.id },
                data: {
                  status: "VERIFIED",
                  verifiedById: userId,
                  verifiedAt: clock(),
                  verificationNote: note,
                },
                include: adjustmentInclude,
              })
              await notifyOvertime(tx, request.id, "VERIFIED")
              return { adjustment }
            }
            if (session)
              await tx.attendanceWorkSession.update({
                where: { id: session.id },
                data: {
                  startedAt: request.proposedStartedAt,
                  endedAt: request.proposedEndedAt,
                },
              })
            else
              await tx.attendanceWorkSession.create({
                data: {
                  employeeId: request.employeeId,
                  startedAt: request.proposedStartedAt,
                  endedAt: request.proposedEndedAt,
                },
              })
          }
          await notifyOvertime(tx, request.id, decision)
          const adjustment = await tx.attendanceAdjustment.update({
            where: { id: request.id },
            data: {
              status: decision,
              reviewedById: userId,
              reviewedAt: clock(),
              reviewNote: note,
            },
            include: adjustmentInclude,
          })
          if (!overtime && currentEmployee.userId) {
            const policy = request.sessionId
              ? null
              : await policyAt(
                  tx,
                  request.employeeId,
                  request.proposedStartedAt,
                )
            const workday = request.sessionId
              ? { sessions: { some: { id: request.sessionId } } }
              : policy
                ? { workDate: new Date(policy.workDate) }
                : null
            if (workday) {
              const sessions = await tx.attendanceWorkSession.findMany({
                where: { employeeId: request.employeeId, workday },
                select: { id: true },
                orderBy: { startedAt: "asc" },
              })
              for (const item of sessions)
                await submitRecordedOvertime(
                  tx,
                  currentEmployee.userId,
                  request.employeeId,
                  item.id,
                  clock(),
                )
            }
          }
          return { adjustment }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
  }
}
