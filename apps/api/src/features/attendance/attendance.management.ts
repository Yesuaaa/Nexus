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
  attendancePolicyDays,
  attendanceTimestamp,
  attendanceTimeZone,
  attendanceWorkDate,
} from "./attendance.validation.js"
import {
  attendanceRepository,
  attendanceWorkdayInclude,
} from "./attendance.repository.js"
import { summarizeAttendance } from "./attendance.summary.js"
import {
  notifyOvertime,
  submitRecordedOvertime,
} from "./attendance.overtime.js"
import { parseAttendanceHistory } from "./attendance.schema.js"

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
async function context(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: string,
) {
  await tx.$executeRaw`SELECT set_config('app.attendance_actor_id', ${userId}, true)`
  await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${reason}, true)`
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
  const session = sessionId
    ? await attendanceRepository.session(tx, employeeId, sessionId)
    : null
  if (sessionId && !session) fail(404, "Attendance session not found")
  if (session) {
    if (
      await tx.attendanceAdjustment.findFirst({
        where: {
          type: "OVERTIME",
          status: { in: ["PENDING", "VERIFIED", "APPROVED"] },
          session: { workdayId: session.workdayId },
        },
      })
    )
      fail(
        409,
        "Resolve overtime requests for this workday before correcting attendance",
      )
    const day = await tx.attendanceWorkday.findUniqueOrThrow({
      where: { id: session.workdayId },
    })
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
  } else if (!(await policyAt(tx, employeeId, start)))
    fail(409, "No policy is assigned for the missing session's starting date")
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
  if (
    await tx.attendanceAdjustment.findFirst({
      where: {
        employeeId,
        type: "CORRECTION",
        status: "PENDING",
        session: { workdayId: day.id! },
      },
    })
  )
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
      ])
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
              ...(employeeId || departmentId
                ? { employee: { is: employee } }
                : {}),
            }
            const { rows, ...paging } = await paginate(
              range.page,
              {
                rows: (db, window) =>
                  db.attendanceAudit.findMany({
                    where,
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
            return { asOf: now, ...paging, events: rows }
          }
          const where: Prisma.AttendanceWorkdayWhereInput = {
            workDate: { gte: range.from, lte: range.to },
            employee: { is: employee },
          }
          const { rows, ...paging } = await paginate(
            range.page,
            {
              rows: (db, window) =>
                db.attendanceWorkday.findMany({
                  where,
                  include: {
                    ...attendanceWorkdayInclude,
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
                  orderBy: [{ workDate: "desc" }, { id: "desc" }],
                  ...window,
                }),
              count: (db) => db.attendanceWorkday.count({ where }),
            },
            { tx },
          )
          return {
            asOf: now,
            ...paging,
            workdays: rows.map((day) => ({
              ...summarizeAttendance(day, now),
              employee: day.employee,
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
                  },
                  orderBy: [{ fullName: "asc" }, { id: "asc" }],
                  ...window,
                }),
              count: (db) => db.employee.count({ where }),
            },
            { tx },
          )
          return { employees: rows, ...paging }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async overview(userId: string, query: Record<string, unknown>) {
      const input = object(query, ["from", "to", "departmentId"])
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
          const now = clock()
          const rows = await tx.attendanceWorkday.findMany({
            where: {
              workDate: { gte: range.from, lte: range.to },
              ...(departmentId ? { employee: { departmentId } } : {}),
            },
            include: attendanceWorkdayInclude,
            take: 10001,
          })
          if (rows.length > 10000)
            fail(
              400,
              "Narrow the overview date range to at most 10,000 records",
            )
          const days = rows.map((day) => summarizeAttendance(day, now))
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
          return {
            asOf: now,
            scope: departmentId ? "DEPARTMENT" : "ORGANIZATION",
            recordedDays: days.length,
            employees: new Set(days.map((day) => day.employeeId)).size,
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
    async policies(userId: string) {
      return getPrisma()!.$transaction(async (tx) => {
        await managementScope(tx, userId, true)
        return {
          policies: await tx.attendancePolicy.findMany({
            include: {
              days: { orderBy: { weekday: "asc" } },
              _count: { select: { assignments: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 200,
          }),
        }
      })
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
          const today = attendanceWorkDate(clock(), policy.timeZone)
          return {
            ...paging,
            assignments: rows.map((assignment) => ({
              ...assignment,
              status:
                assignment.effectiveFrom.toISOString().slice(0, 10) > today
                  ? "SCHEDULED"
                  : assignment.effectiveUntil &&
                      assignment.effectiveUntil.toISOString().slice(0, 10) <=
                        today
                    ? "ENDED"
                    : "CURRENT",
            })),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
    async assignPolicy(userId: string, body: unknown) {
      const input = object(body, ["employeeId", "policyId", "effectiveFrom"])
      const employeeId = id(input.employeeId),
        policyId = id(input.policyId)
      const from = parseAttendanceHistory(
        { from: input.effectiveFrom, to: input.effectiveFrom },
        clock(),
      ).from
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
          if (
            from.toISOString().slice(0, 10) <
            attendanceWorkDate(clock(), policy.timeZone)
          )
            fail(400, "Policy assignments must start today or later")
          const overlapping = await tx.attendancePolicyAssignment.findMany({
            where: {
              employeeId,
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: from } }],
            },
          })
          if (overlapping.some((item) => item.effectiveFrom >= from))
            fail(409, "An assignment already starts on or after that date")
          if (
            await tx.attendanceWorkday.findFirst({
              where: { employeeId, workDate: { gte: from } },
            })
          )
            fail(409, "Choose a date after existing attendance records")
          await context(tx, userId, "Assigned attendance policy version")
          for (const item of overlapping)
            await tx.attendancePolicyAssignment.update({
              where: { id: item.id },
              data: { effectiveUntil: from },
            })
          return {
            assignment: await tx.attendancePolicyAssignment.create({
              data: { employeeId, policyId, effectiveFrom: from },
            }),
          }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
    async adjustments(userId: string, query: Record<string, unknown>) {
      object(query, ["scope", "page", "search", "type"])
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
          const scopeWhere: Prisma.AttendanceAdjustmentWhereInput =
            query.scope === "team"
              ? {
                  employee: { departmentId: await managementScope(tx, userId) },
                }
              : { employeeId: (await selfEmployee(tx, userId)).id }
          const where: Prisma.AttendanceAdjustmentWhereInput = {
            ...(query.type ? { type: String(query.type) } : {}),
            ...scopeWhere,
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
          return { adjustments: rows, ...paging }
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
          const employee = await selfEmployee(tx, userId, true)
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
              where: { sessionId, status: "PENDING", type: "CORRECTION" },
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
          if (type === "OVERTIME")
            await notifyOvertime(tx, adjustment.id, "PENDING")
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
          if (
            request.requestedById === userId ||
            currentEmployee.userId === userId
          )
            fail(403, "You cannot review your own attendance request")
          const overtime = request.type === "OVERTIME"
          if (
            request.status !== "PENDING" &&
            !(overtime && request.status === "VERIFIED")
          )
            fail(409, "This request has already been reviewed")
          await context(tx, userId, note)
          if (overtime) {
            if (
              !currentScope &&
              decision === "APPROVED" &&
              request.status !== "VERIFIED"
            )
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
          if (overtime) await notifyOvertime(tx, request.id, decision)
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
            const session = await tx.attendanceWorkSession.findFirst({
              where: {
                employeeId: request.employeeId,
                ...(request.sessionId
                  ? { id: request.sessionId }
                  : {
                      startedAt: request.proposedStartedAt,
                      endedAt: request.proposedEndedAt,
                    }),
              },
            })
            if (session) {
              const sessions = await tx.attendanceWorkSession.findMany({
                where: { workdayId: session.workdayId },
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
