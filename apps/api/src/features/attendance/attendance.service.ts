import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import { paginate } from "../../shared/query/pagination.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import {
  attendanceRepository as repository,
  attendanceWorkdayInclude,
} from "./attendance.repository.js"
import type {
  AttendanceAction,
  AttendanceActionInput,
  AttendanceHistoryQuery,
} from "./attendance.schema.js"
import { summarizeAttendance } from "./attendance.summary.js"
import { attendanceWorkDate } from "./attendance.validation.js"
import { submitRecordedOvertime } from "./attendance.overtime.js"

type Clock = () => Date

export async function actor(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, accountDeletedAt: true },
  })
  if (!user?.isActive || user.accountDeletedAt)
    fail(403, "An active workforce account is required")
  return user
}

export async function selfEmployee(
  tx: Prisma.TransactionClient,
  userId: string,
  write = false,
) {
  // Existing account/HR lock order: Employee before User. Recheck ownership and
  // account state after locking so queued actions cannot use stale assignments.
  if (write) {
    await lockRowsReturning(tx, "Employee", userId, "update", "userId")
    await lockRows(tx, "User", userId, "share")
  }
  const user = await actor(tx, userId)
  if (user.role !== "STAFF" && user.role !== "ADMIN")
    fail(403, "Employee attendance access is required")
  const employee = await tx.employee.findUnique({
    where: { userId },
    select: { id: true, status: true },
  })
  if (!employee)
    fail(409, "Complete your employee profile before using attendance")
  return employee
}

export async function policyAt(
  tx: Prisma.TransactionClient,
  employeeId: string,
  now: Date,
) {
  const assignments = await repository.assignments(tx, employeeId)
  const matches = assignments.flatMap((assignment) => {
    const workDate = attendanceWorkDate(now, assignment.policy.timeZone)
    if (
      workDate < assignment.effectiveFrom.toISOString().slice(0, 10) ||
      (assignment.effectiveUntil &&
        workDate >= assignment.effectiveUntil.toISOString().slice(0, 10))
    )
      return []
    return [{ assignment, workDate }]
  })
  if (matches.length > 1)
    fail(409, "Attendance policy timezone transition is ambiguous; contact HR")
  return matches[0] ?? null
}

function serverTime(clock: Clock): Date {
  const now = clock()
  if (!Number.isFinite(now.getTime()))
    fail(503, "Attendance clock is unavailable")
  return now
}

async function workdayResponse(
  tx: Prisma.TransactionClient,
  employeeId: string,
  workdayId: string,
  now: Date,
) {
  const day = await repository.workday(tx, employeeId, workdayId)
  if (!day) fail(404, "Attendance workday not found")
  return {
    asOf: now,
    employeeId,
    needsPolicy: false,
    workday: summarizeAttendance(day, now),
  }
}

export function createAttendanceService(clock: Clock = () => new Date()) {
  return {
    async act(
      userId: string,
      action: AttendanceAction,
      input: AttendanceActionInput,
    ) {
      return getPrisma()!.$transaction(
        async (tx) => {
          const employee = await selfEmployee(tx, userId, true)
          // Capture once, after serialization. Callers cannot supply/backdate punches.
          const now = serverTime(clock)
          await tx.$executeRaw`SELECT set_config('app.attendance_actor_id', ${userId}, true)`
          await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${`Employee ${action}`}, true)`
          if (action === "clock-in") {
            if (employee.status !== "ACTIVE")
              fail(403, "Only active employees can clock in")
            if (await repository.activeSession(tx, employee.id))
              fail(409, "You already have an active attendance session")
            const latest = await repository.latestSession(tx, employee.id)
            if (input.workdayId) {
              const selected = await repository.workday(
                tx,
                employee.id,
                input.workdayId,
              )
              if (!selected) fail(404, "Attendance workday not found")
              const today = attendanceWorkDate(now, selected.timeZone)
              const previous = new Date(`${today}T00:00:00Z`)
              previous.setUTCDate(previous.getUTCDate() - 1)
              const selectedDate = selected.workDate.toISOString().slice(0, 10)
              const overnightContinuation =
                selectedDate === previous.toISOString().slice(0, 10) &&
                latest?.workdayId === selected.id &&
                latest.endedAt &&
                attendanceWorkDate(latest.endedAt, selected.timeZone) === today
              if (selectedDate !== today && !overnightContinuation)
                fail(
                  409,
                  "Choose today's workday or your latest overnight continuation",
                )
            } else if (!(await policyAt(tx, employee.id, now))) {
              fail(409, "No attendance policy is assigned for this workday")
            }
            if (latest?.endedAt && latest.endedAt > now)
              fail(409, "Clock-in must follow your previous session")
            const session = await tx.attendanceWorkSession.create({
              data: {
                employeeId: employee.id,
                startedAt: now,
                ...(input.workdayId ? { workdayId: input.workdayId } : {}),
              },
            })
            return workdayResponse(tx, employee.id, session.workdayId, now)
          }

          const session = input.sessionId
            ? await repository.session(tx, employee.id, input.sessionId)
            : null
          if (!session) fail(404, "Attendance session not found")
          if (session.endedAt)
            fail(409, "This attendance session has already ended")
          const activeBreak = session.breaks.find(
            (pause) => pause.endedAt === null,
          )
          if (action === "clock-out") {
            if (
              now <= session.startedAt ||
              (activeBreak && now <= activeBreak.startedAt) ||
              session.breaks.some(
                (pause) => pause.endedAt && pause.endedAt > now,
              )
            )
              fail(409, "Clock-out must follow the session and its breaks")
            if (activeBreak) {
              await tx.attendanceBreak.update({
                where: { id: activeBreak.id },
                data: { endedAt: now },
              })
            }
            await tx.attendanceWorkSession.update({
              where: { id: session.id },
              data: { endedAt: now },
            })
            await submitRecordedOvertime(
              tx,
              userId,
              employee.id,
              session.id,
              now,
            )
          } else if (action === "break-start") {
            const workday = await tx.attendanceWorkday.findUniqueOrThrow({
              where: { id: session.workdayId },
              include: { assignment: { include: { policy: true } } },
            })
            if (!workday.unpaidBreaksEnabled)
              fail(
                409,
                "Unpaid breaks are disabled by the assigned attendance policy",
              )
            if (activeBreak) fail(409, "You already have an active break")
            if (
              now < session.startedAt ||
              session.breaks.some(
                (pause) => pause.endedAt && pause.endedAt > now,
              )
            )
              fail(
                409,
                "A break must follow the session start and previous breaks",
              )
            await tx.attendanceBreak.create({
              data: { sessionId: session.id, startedAt: now, isPaid: false },
            })
          } else {
            if (!activeBreak || activeBreak.id !== input.breakId)
              fail(409, "This unpaid break is not active in your session")
            if (activeBreak.isPaid)
              fail(409, "This endpoint only manages unpaid breaks")
            if (now <= activeBreak.startedAt)
              fail(409, "Break end must follow its start")
            await tx.attendanceBreak.update({
              where: { id: activeBreak.id },
              data: { endedAt: now },
            })
          }
          return workdayResponse(tx, employee.id, session.workdayId, now)
        },
        { isolationLevel: "ReadCommitted" },
      )
    },

    async current(userId: string) {
      return getPrisma()!.$transaction(
        async (tx) => {
          const employee = await selfEmployee(tx, userId)
          const now = serverTime(clock)
          const active = await repository.activeSession(tx, employee.id)
          if (active)
            return workdayResponse(tx, employee.id, active.workdayId, now)
          const policy = await policyAt(tx, employee.id, now)
          if (!policy)
            return {
              asOf: now,
              employeeId: employee.id,
              needsPolicy: true,
              workday: null,
            }
          const existing = await tx.attendanceWorkday.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: employee.id,
                workDate: new Date(`${policy.workDate}T00:00:00Z`),
              },
            },
            include: attendanceWorkdayInclude,
          })
          if (existing)
            return workdayResponse(tx, employee.id, existing.id, now)
          const workDate = new Date(`${policy.workDate}T00:00:00Z`)
          const rule = policy.assignment.policy.days.find(
            (day) => day.weekday === workDate.getUTCDay(),
          )
          if (!rule) fail(409, "Attendance policy weekdays are incomplete")
          return {
            asOf: now,
            employeeId: employee.id,
            needsPolicy: false,
            workday: summarizeAttendance(
              {
                id: null,
                employeeId: employee.id,
                assignmentId: policy.assignment.id,
                workDate,
                timeZone: policy.assignment.policy.timeZone,
                isWorkingDay: rule.isWorkingDay,
                requiredMinutes: rule.requiredMinutes,
                policyName: policy.assignment.policy.name,
                unpaidBreaksEnabled:
                  policy.assignment.policy.unpaidBreaksEnabled,
                overnightRequiresReview:
                  policy.assignment.policy.overnightRequiresReview,
                assignment: { policy: policy.assignment.policy },
                sessions: [],
              },
              now,
            ),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },

    async history(
      userId: string,
      query: AttendanceHistoryQuery,
      targetEmployeeId?: string,
    ) {
      return getPrisma()!.$transaction(
        async (tx) => {
          let employeeId: string
          if (targetEmployeeId) {
            const user = await actor(tx, userId)
            const head =
              user.role === "STAFF"
                ? await tx.department.findFirst({ where: { headId: userId } })
                : null
            if (!hasPermission(user.role, Permission.EMPLOYEES_READ) && !head)
              fail(403, "Employee attendance history access is required")
            if (
              !(await tx.employee.findFirst({
                where: { id: targetEmployeeId },
                select: { id: true, departmentId: true },
              }))
            )
              fail(404, "Employee not found")
            if (
              head &&
              !(await tx.employee.findFirst({
                where: { id: targetEmployeeId, departmentId: head.id },
                select: { id: true },
              }))
            )
              fail(404, "Employee not found")
            employeeId = targetEmployeeId
          } else {
            employeeId = (await selfEmployee(tx, userId)).id
          }
          const now = serverTime(clock)
          const where = {
            employeeId,
            workDate: { gte: query.from, lte: query.to },
          }
          const { rows, ...page } = await paginate(
            query.page,
            {
              rows: (db, window) =>
                db.attendanceWorkday.findMany({
                  where,
                  include: attendanceWorkdayInclude,
                  orderBy: [{ workDate: "desc" }, { id: "desc" }],
                  ...window,
                }),
              count: (db) => db.attendanceWorkday.count({ where }),
            },
            { tx },
          )
          return {
            asOf: now,
            employeeId,
            ...page,
            workdays: rows.map((day) => summarizeAttendance(day, now)),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
  }
}
