import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
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
import { attendanceReportPage } from "./attendance.reporting.js"
import { attendanceWorkDate } from "./attendance.validation.js"
import { submitRecordedOvertime } from "./attendance.overtime.js"
import { setAttendanceAuditContext } from "../workforce-compliance-logs/write-context.js"
import {
  approvedLeaveForDate,
  approvedLeaveOverlappingInterval,
} from "../leave/leave.repository.js"

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
  const [selected] = await tx.$queryRaw<
    { assignmentId: string; workDate: Date }[]
  >`SELECT * FROM attendance_policy_at(${employeeId}, ${now.toISOString()}::timestamptz)`
  if (!selected) return null
  const assignment = await tx.attendancePolicyAssignment.findUniqueOrThrow({
    where: { id: selected.assignmentId },
    include: { policy: { include: { days: true } } },
  })
  return { assignment, workDate: selected.workDate.toISOString().slice(0, 10) }
}

function serverTime(clock: Clock): Date {
  const now = clock()
  if (!Number.isFinite(now.getTime()))
    fail(503, "Attendance clock is unavailable")
  return now
}

type LatestSession = Awaited<ReturnType<typeof repository.latestSession>>
async function overnightContinuation(
  tx: Prisma.TransactionClient,
  latest: LatestSession,
  now: Date,
) {
  if (!latest?.endedAt) return null
  const day = latest.workday
  const today = attendanceWorkDate(now, day.timeZone)
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (
    day.workDate.getTime() !== yesterday.getTime() ||
    attendanceWorkDate(latest.endedAt, day.timeZone) !== today
  )
    return null
  const workDate = day.workDate.toISOString().slice(0, 10)
  // A handoff can attribute punches made wholly after midnight to yesterday.
  // Preserve continuation after later split sessions if an earlier one crossed midnight.
  const sessions = await tx.attendanceWorkSession.findMany({
    where: { workdayId: day.id },
    select: { startedAt: true, endedAt: true },
  })
  const crossedMidnight = sessions.some(
    ({ startedAt, endedAt }) =>
      endedAt &&
      attendanceWorkDate(startedAt, day.timeZone) === workDate &&
      attendanceWorkDate(endedAt, day.timeZone) === today,
  )
  return crossedMidnight ? { id: day.id, workDate } : null
}

async function clockInBlock(tx: Prisma.TransactionClient, employee: { id: string; status: string }, latest: LatestSession, now: Date, workDate: string | undefined) {
  if (employee.status !== "ACTIVE") return { status: 403, reason: "Only active employees can clock in" }
  if (latest && !latest.endedAt) return { status: 409, reason: "You already have an active attendance session" }
  if (!workDate) return { status: 409, reason: "No attendance policy is assigned for this workday" }
  if (latest?.endedAt && latest.endedAt > now) return { status: 409, reason: "Clock-in must follow your previous session" }
  if (await approvedLeaveForDate(tx, employee.id, workDate)) return { status: 409, reason: "Approved leave covers this workday" }
  if ((await approvedLeaveOverlappingInterval(tx, employee.id, now, new Date(now.getTime() + 1))).length) return { status: 409, reason: "Approved leave covers the current local date" }
  return null
}

async function workdayResponse(
  tx: Prisma.TransactionClient,
  employeeId: string,
  workdayId: string,
  now: Date,
) {
  const day = await repository.workday(tx, employeeId, workdayId)
  if (!day) fail(404, "Attendance workday not found")
  const approvedLeave = await approvedLeaveForDate(
    tx,
    employeeId,
    day.workDate.toISOString().slice(0, 10),
  )
  const leaveConflicts = (
    await Promise.all(
      day.sessions.map((session) =>
        approvedLeaveOverlappingInterval(
          tx,
          employeeId,
          session.startedAt,
          session.endedAt ?? now,
        ),
      ),
    )
  ).flat()
  return {
    asOf: now,
    employeeId,
    needsPolicy: false,
    leaveConflict: leaveConflicts.length > 0,
    workday: summarizeAttendance(
      { ...day, approvedLeaveMinutes: approvedLeave?.leaveMinutes ?? 0 },
      now,
    ),
  }
}

async function closeRecordedSession(tx:Prisma.TransactionClient,employeeId:string,requesterId:string|null,session:NonNullable<Awaited<ReturnType<typeof repository.session>>>,now:Date){
 const activeBreak=session.breaks.find(pause=>pause.endedAt===null)
            const conflicts = await approvedLeaveOverlappingInterval(
              tx,
              employeeId,
              session.startedAt,
              now,
            )
            if (conflicts.length) {
              await tx.$executeRaw`SELECT set_config('app.attendance_reason', concat_ws(' ? ',nullif(current_setting('app.attendance_reason',true),''),'Clock-out recovery crossed approved leave; HR reconciliation required'), true)`
              const reviewers = await tx.user.findMany({
                where: {
                  isActive: true,
                  accountDeletedAt: null,
                  role: { in: ["ADMIN", "SUPERADMIN"] },
                },
                select: { id: true },
              })
              await tx.workflowNotification.createMany({
                data: [
                  ...new Set(conflicts.map((day) => day.requestId)),
                ].flatMap((leaveRequestId) =>
                  reviewers.map(({ id }) => ({
                    userId: id,
                    leaveRequestId,
                    type: "LEAVE_ATTENDANCE_CONFLICT",
                    summary:
                      "Recorded attendance crosses approved leave. HR reconciliation is required.",
                  })),
                ),
                skipDuplicates: true,
              })
            }
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
            if(requesterId) await submitRecordedOvertime(
              tx,
              requesterId,
              employeeId,
              session.id,
              now,
            )
}

export function createAttendanceService(clock: Clock = () => new Date()) {
  return {
    async reconcile(userId:string,employeeId:string,sessionId:string,endedAt:Date,note:string){
      return getPrisma()!.$transaction(async tx=>{
        await lockRows(tx,"Employee",employeeId)
        await lockRows(tx,"User",userId,"share")
        const reviewer=await actor(tx,userId)
        if(!hasPermission(reviewer.role,Permission.EMPLOYEES_MANAGE)) fail(403,"Attendance management access is required")
        const employee=await tx.employee.findUnique({where:{id:employeeId},select:{userId:true}})
        if(!employee)fail(404,"Employee not found")
        if(employee.userId===userId)fail(403,"You cannot reconcile your own shift")
        const session=await repository.session(tx,employeeId,sessionId)
        if(!session)fail(404,"Session not found")
        if(session.endedAt || !session.suspendedAt)fail(409,"Only an open suspended shift can be reconciled")
        if(endedAt>serverTime(clock))fail(400,"Clock-out cannot be in the future")
        await setAttendanceAuditContext(tx,userId,note)
        await closeRecordedSession(tx,employeeId,employee.userId,session,endedAt)
        return {closed:true}
      })
    },
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
          await setAttendanceAuditContext(tx, userId, `Employee ${action}`)
          if (action === "clock-in") {
            const latest = await repository.latestSession(tx, employee.id)
            const policy = await policyAt(tx, employee.id, now)
            let selectedWorkDate = policy?.workDate
            if (input.workdayId) {
              const selected = await repository.workday(
                tx,
                employee.id,
                input.workdayId,
              )
              if (!selected) fail(404, "Attendance workday not found")
              selectedWorkDate = selected.workDate.toISOString().slice(0, 10)
              const isEffectiveWorkday =
                selectedWorkDate === policy?.workDate &&
                selected.assignmentId === policy?.assignment.id
              if (
                !isEffectiveWorkday &&
                (await overnightContinuation(tx, latest, now))?.id !==
                  selected.id
              )
                fail(
                  409,
                  "Choose today's workday or your latest overnight continuation",
                )
            }
            const blocked = await clockInBlock(tx, employee, latest, now, selectedWorkDate)
            if (blocked) fail(blocked.status, blocked.reason)
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
          if(session.suspendedAt)fail(409,"HR must reconcile this suspended shift in Time Logs")
          const activeBreak = session.breaks.find(
            (pause) => pause.endedAt === null,
          )
          if (action === "clock-out") {
            await closeRecordedSession(tx,employee.id,userId,session,now)
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
          const latest = await repository.latestSession(tx, employee.id)
          if (latest && !latest.endedAt)
            return { ...await workdayResponse(tx, employee.id, latest.workdayId, now), clockInBlockedReason: "You already have an active attendance session", continuation: null }
          const policy = await policyAt(tx, employee.id, now)
          const blocked = await clockInBlock(tx, employee, latest, now, policy?.workDate)
          const previous = await overnightContinuation(tx, latest, now)
          const continuation = previous && previous.workDate !== policy?.workDate && !await clockInBlock(tx, employee, latest, now, previous.workDate) ? previous : null
          const eligibility = { clockInBlockedReason: blocked?.reason ?? null, continuation }
          if (!policy)
            return {
              ...eligibility,
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
            return { ...await workdayResponse(tx, employee.id, existing.id, now), ...eligibility }
          const workDate = new Date(`${policy.workDate}T00:00:00Z`)
          const rule = policy.assignment.policy.days.find(
            (day) => day.weekday === workDate.getUTCDay(),
          )
          if (!rule) fail(409, "Attendance policy weekdays are incomplete")
          const approvedLeave = await approvedLeaveForDate(
            tx,
            employee.id,
            policy.workDate,
          )
          return {
            ...eligibility,
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
                approvedLeaveMinutes: approvedLeave?.leaveMinutes ?? 0,
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
          const { rows, ...page } = await attendanceReportPage(
            tx,
            query,
            { employeeId },
            now,
          )
          return {
            asOf: now,
            employeeId,
            ...page,
            workdays: rows.map(({ day }) => day),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },
  }
}
