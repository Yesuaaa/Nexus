import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import {
  insensitive,
  paginate,
  parsePage,
} from "../../shared/query/pagination.js"
import { activeAccount } from "../../shared/query/accounts.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import { selfEmployee } from "../attendance/attendance.service.js"
import {
  isLeaveSubject,
  leaveDayOverlapsInterval,
  leaveReviewHead,
  leaveReviewHeadSelect,
  notifySubmittedLeave,
  submittedLeaveFallbackScope,
} from "./leave.repository.js"
import { workforceLogContext } from "../workforce-compliance-logs/write-context.js"
import {
  expectedLeaveVersion,
  leaveObject,
  leaveRange,
  leaveStatus,
  leaveText,
  leaveType,
  leaveUuid,
  type LeaveStatusInput,
} from "./leave.schema.js"

type Tx = Prisma.TransactionClient
type Clock = () => Date
type LeaveActionInput = "VERIFY" | "APPROVE" | "REJECT" | "CANCEL" | "REVERSE"

const activeStatuses = ["SUBMITTED", "VERIFIED", "APPROVED"] as const

const requestInclude = {
  employee: {
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      departmentId: true,
      status: true,
      userId: true,
      department: {
        select: {
          id: true,
          name: true,
          headId: true,
          head: { select: leaveReviewHeadSelect },
        },
      },
    },
  },
  days: { orderBy: { workDate: "asc" as const } },
  decisions: {
    select: {
      id: true,
      requestId: true,
      actorId: true,
      actionId: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      version: true,
      createdAt: true,
      actor: { select: { id: true, fullName: true } },
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.LeaveRequestInclude

async function actor(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      accountDeletedAt: true,
      employee: { select: { id: true } },
      headOf: { select: { id: true } },
    },
  })
  if (!user?.isActive || user.accountDeletedAt)
    fail(403, "An active workforce account is required")
  if (user.role === "USER") fail(403, "Workforce leave access is required")
  return user
}

function datesBetween(startDate: Date, endDate: Date) {
  const dates: Date[] = []
  for (const cursor = new Date(startDate); cursor <= endDate;) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

async function calculateDays(
  tx: Tx,
  employeeId: string,
  startDate: Date,
  endDate: Date,
) {
  let assignments = await tx.attendancePolicyAssignment.findMany({
    where: {
      employeeId,
      cancelledAt: null,
      effectiveFrom: { lte: endDate },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: startDate } }],
    },
    include: { policy: { include: { days: true } } },
    orderBy: { effectiveFrom: "asc" },
  })
  for (const policyId of [
    ...new Set(assignments.map((assignment) => assignment.policyId)),
  ].sort())
    await tx.$queryRaw`SELECT id FROM "AttendancePolicy" WHERE id = ${policyId} FOR SHARE`
  assignments = await tx.attendancePolicyAssignment.findMany({
    where: {
      id: { in: assignments.map((assignment) => assignment.id) },
      cancelledAt: null,
    },
    include: { policy: { include: { days: true } } },
    orderBy: { effectiveFrom: "asc" },
  })
  const days = datesBetween(startDate, endDate).map((workDate) => {
    const matching = assignments.filter(
      (item) =>
        item.effectiveFrom <= workDate &&
        (!item.effectiveUntil || workDate < item.effectiveUntil),
    )
    const label = workDate.toISOString().slice(0, 10)
    if (matching.length !== 1)
      fail(
        409,
        matching.length
          ? `Attendance policy coverage is ambiguous on ${label}`
          : `Assign an attendance policy covering ${label}`,
      )
    const assignment = matching[0]
    const rule = assignment.policy.days.find(
      (item) => item.weekday === workDate.getUTCDay(),
    )
    if (!rule) fail(409, `Attendance policy is incomplete on ${label}`)
    return {
      employeeId,
      assignmentId: assignment.id,
      workDate,
      timeZone: assignment.policy.timeZone,
      policyName: assignment.policy.name,
      baseRequiredMinutes: rule.requiredMinutes,
      leaveMinutes: rule.requiredMinutes,
    }
  })
  if (!days.some((day) => day.leaveMinutes > 0))
    fail(400, "The selected range contains no required working time")
  return days
}

function capabilities(
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
  user: Awaited<ReturnType<typeof actor>>,
) {
  const own = isLeaveSubject(request, user.id)
  const head = leaveReviewHead(request)
  const fallback = !head
  const departmentHead = user.role === "STAFF" && head?.id === user.id
  const organization = user.role === "ADMIN" || user.role === "SUPERADMIN"
  const reviewer = organization && !own
  const requiresReverification =
    request.status === "VERIFIED" &&
    request.routeDepartmentId !== request.employee.departmentId
  return {
    cancel:
      request.requestedById === user.id &&
      (request.status === "SUBMITTED" || request.status === "VERIFIED"),
    verify:
      departmentHead &&
      (request.status === "SUBMITTED" || requiresReverification),
    approve:
      reviewer &&
      !requiresReverification &&
      (request.status === "VERIFIED" ||
        (request.status === "SUBMITTED" &&
          (user.role === "SUPERADMIN" || fallback))),
    reject:
      (departmentHead && request.status === "SUBMITTED") ||
      (reviewer &&
        (user.role === "SUPERADMIN"
          ? request.status === "SUBMITTED" || request.status === "VERIFIED"
          : (request.status === "VERIFIED" && !requiresReverification) ||
            (request.status === "SUBMITTED" && fallback))),
    reverse: reviewer && request.status === "APPROVED",
    fallback,
    requiresReverification,
  }
}

function serialize(
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
  user: Awaited<ReturnType<typeof actor>>,
) {
  const employee = {
    id: request.employee.id,
    employeeId: request.employee.employeeId,
    fullName: request.employee.fullName,
    departmentId: request.employee.departmentId,
    department: request.employee.department,
  }
  return { ...request, employee, capabilities: capabilities(request, user) }
}

async function scopeWhere(
  tx: Tx,
  user: Awaited<ReturnType<typeof actor>>,
  scope: unknown,
) {
  if (scope !== "mine" && scope !== "team")
    fail(400, "Choose a valid leave request scope")
  if (scope === "mine") {
    if (!user.employee) fail(403, "Employee leave access is required")
    return {
      user,
      where: {
        employeeId: user.employee.id,
      } satisfies Prisma.LeaveRequestWhereInput,
    }
  }
  if (user.role === "STAFF") {
    if (!user.headOf) fail(403, "Leave review access is required")
    return {
      user,
      where: {
        employee: { departmentId: user.headOf.id },
      } satisfies Prisma.LeaveRequestWhereInput,
    }
  }
  if (!hasPermission(user.role, Permission.EMPLOYEES_READ))
    fail(403, "Leave management access is required")
  return {
    user,
    where:
      user.role === "ADMIN"
        ? ({
            OR: [
              { status: { not: "SUBMITTED" } },
              await submittedLeaveFallbackScope(tx, user.id),
            ],
          } satisfies Prisma.LeaveRequestWhereInput)
        : ({} satisfies Prisma.LeaveRequestWhereInput),
  }
}

async function requestReadWhere(
  tx: Tx,
  user: Awaited<ReturnType<typeof actor>>,
  requestId: string,
): Promise<Prisma.LeaveRequestWhereInput> {
  const { where } = await scopeWhere(
    tx,
    user,
    user.role === "STAFF" && !user.headOf ? "mine" : "team",
  )
  if (user.role === "SUPERADMIN") return { id: requestId }
  return {
    id: requestId,
    OR: [where, { requestedById: user.id }],
  }
}

async function notify(
  tx: Tx,
  request: { id: string; requestedById: string; version: number },
  stage: Exclude<LeaveStatusInput, "SUBMITTED">,
) {
  const recipients =
    stage === "VERIFIED"
      ? await tx.user.findMany({
          where: {
            ...activeAccount,
            OR: [
              { id: request.requestedById },
              { role: { in: ["ADMIN", "SUPERADMIN"] } },
            ],
          },
          select: { id: true },
        })
      : [{ id: request.requestedById }]
  const message =
    stage === "VERIFIED"
      ? "A leave request was verified and awaits HR approval."
      : `Your leave request was ${stage.toLowerCase()}.`
  await tx.workflowNotification.createMany({
    data: recipients.map(({ id }) => ({
      userId: id,
      leaveRequestId: request.id,
      leaveVersion: stage === "VERIFIED" ? request.version : 0,
      type: `LEAVE_${stage}`,
      summary: message,
    })),
    skipDuplicates: true,
  })
}

async function assertApprovalConflicts(
  tx: Tx,
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
  asOf: Date,
) {
  if (request.employee.status === "INACTIVE")
    fail(409, "Leave approval is blocked because the employee is inactive.")

  const requester = await tx.user.findUnique({
    where: {
      id: request.requestedById,
      ...activeAccount,
      role: { in: ["STAFF", "ADMIN"] },
      employee: { id: request.employeeId },
    },
    select: { id: true },
  })
  if (!requester)
    fail(
      409,
      "Leave approval requires an active linked Staff or Admin account for the requester.",
    )

  const recalculated = await calculateDays(
    tx,
    request.employeeId,
    request.startDate,
    request.endDate,
  )
  const snapshots = request.days
  if (
    recalculated.length !== snapshots.length ||
    recalculated.some((day, index) => {
      const snapshot = snapshots[index]
      return (
        day.assignmentId !== snapshot.assignmentId ||
        day.workDate.getTime() !== snapshot.workDate.getTime() ||
        day.timeZone !== snapshot.timeZone ||
        day.baseRequiredMinutes !== snapshot.baseRequiredMinutes
      )
    })
  )
    fail(409, "Attendance policy changed; cancel and submit the request again")

  const coveredDays = snapshots.filter((day) => day.leaveMinutes > 0)
  const coveredWorkDates = new Set(
    coveredDays.map((day) => day.workDate.getTime()),
  )
  const overlapsCoveredDay = (start: Date, end: Date) =>
    coveredDays.some((day) => leaveDayOverlapsInterval(day, start, end))

  const sessions = await tx.attendanceWorkSession.findMany({
    where: { employeeId: request.employeeId },
    select: {
      startedAt: true,
      endedAt: true,
      suspendedAt: true,
      workday: { select: { workDate: true } },
    },
  })
  if (
    sessions.some(({ startedAt, endedAt, suspendedAt, workday }) => {
      const end =
        endedAt ?? (suspendedAt && suspendedAt < asOf ? suspendedAt : asOf)
      return (
        coveredWorkDates.has(workday.workDate.getTime()) ||
        (startedAt < end && overlapsCoveredDay(startedAt, end))
      )
    })
  )
    fail(409, "Resolve recorded attendance before approving this leave request")

  const adjustments = await tx.attendanceAdjustment.findMany({
    where: {
      employeeId: request.employeeId,
      status: { in: ["PENDING", "VERIFIED"] },
    },
    select: { proposedStartedAt: true, proposedEndedAt: true },
  })
  if (
    adjustments.some(({ proposedStartedAt, proposedEndedAt }) =>
      overlapsCoveredDay(proposedStartedAt, proposedEndedAt),
    )
  )
    fail(409, "Resolve attendance requests before approving this leave request")
}

export function createLeaveService(clock: Clock = () => new Date()) {
  return {
    async preview(userId: string, body: unknown) {
      const input = leaveObject(body, ["startDate", "endDate"])
      const range = leaveRange(input.startDate, input.endDate)
      return getPrisma()!.$transaction(
        async (tx) => {
          const employee = await selfEmployee(tx, userId)
          const days = await calculateDays(
            tx,
            employee.id,
            range.startDate,
            range.endDate,
          )
          return {
            days,
            totalMinutes: days.reduce((sum, day) => sum + day.leaveMinutes, 0),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },

    async submit(userId: string, body: unknown) {
      const input = leaveObject(body, [
        "requestKey",
        "type",
        "reason",
        "startDate",
        "endDate",
      ])
      const requestKey = leaveUuid(input.requestKey, "request key")
      const type = leaveType(input.type)
      const reason = leaveText(input.reason, "leave reason")
      const range = leaveRange(input.startDate, input.endDate)
      return getPrisma()!.$transaction(
        async (tx) => {
          const placement = await tx.employee.findUnique({
            where: { userId },
            select: { departmentId: true },
          })
          await lockRows(tx, "Department", placement?.departmentId, "share")
          const employee = await selfEmployee(tx, userId, true)
          if (employee.status === "INACTIVE")
            fail(403, "Inactive employees cannot submit leave requests")
          const existing = await tx.leaveRequest.findUnique({
            where: {
              requestedById_requestKey: { requestedById: userId, requestKey },
            },
            include: requestInclude,
          })
          const currentUser = await actor(tx, userId)
          if (existing) {
            if (
              existing.type !== type ||
              existing.reason !== reason ||
              existing.startDate.getTime() !== range.startDate.getTime() ||
              existing.endDate.getTime() !== range.endDate.getTime()
            )
              fail(409, "Request key has already been used")
            return { request: serialize(existing, currentUser) }
          }
          const active = await tx.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              status: { in: [...activeStatuses] },
            },
            select: { startDate: true, endDate: true },
          })
          if (
            active.some(
              (request) =>
                request.startDate <= range.endDate &&
                request.endDate >= range.startDate,
            )
          )
            fail(409, "These dates overlap another active leave request")
          const days = await calculateDays(
            tx,
            employee.id,
            range.startDate,
            range.endDate,
          )
          const identity = await tx.employee.findUniqueOrThrow({
            where: { id: employee.id },
            include: {
              department: {
                include: { head: { select: leaveReviewHeadSelect } },
              },
            },
          })
          if (identity.departmentId !== (placement?.departmentId ?? null))
            fail(409, "Employee placement changed; refresh and try again")
          const head = leaveReviewHead({
            employee: identity,
            requestedById: userId,
          })
          const routeDepartmentId = head ? identity.departmentId : null
          const created = await tx.leaveRequest.create({
            data: {
              requestKey,
              employeeId: employee.id,
              requestedById: userId,
              routeDepartmentId,
              type,
              reason,
              startDate: range.startDate,
              endDate: range.endDate,
              days: { create: days },
              decisions: {
                create: {
                  ...workforceLogContext(userId),
                  actorId: userId,
                  actionId: requestKey,
                  action: "SUBMITTED",
                  toStatus: "SUBMITTED",
                  version: 1,
                },
              },
            },
            include: requestInclude,
          })
          await notifySubmittedLeave(tx, [created], true)
          return { request: serialize(created, currentUser) }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },

    async list(userId: string, query: Record<string, unknown>) {
      const input = leaveObject(query, [
        "scope",
        "page",
        "search",
        "type",
        "status",
        "from",
        "to",
      ])
      const range =
        input.from || input.to ? leaveRange(input.from, input.to) : null
      const page = parsePage(input.page)
      const search = parseQueryString(input.search)
      const status = leaveStatus(input.status)
      const type =
        input.type === undefined || input.type === ""
          ? undefined
          : leaveType(input.type)
      if (page === null || search === null || search.length > 100)
        fail(400, "Invalid leave request filters")
      return getPrisma()!.$transaction(
        async (tx) => {
          const scoped = await scopeWhere(
            tx,
            await actor(tx, userId),
            input.scope,
          )
          const where: Prisma.LeaveRequestWhereInput = {
            AND: [scoped.where],
            ...(range
              ? {
                  startDate: { lte: range.endDate },
                  endDate: { gte: range.startDate },
                }
              : {}),
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
            ...insensitive<Prisma.LeaveRequestWhereInput>(search, [
              "reason",
              (filter) => ({ employee: { is: { fullName: filter } } }),
              (filter) => ({ employee: { is: { employeeId: filter } } }),
            ]),
          }
          const { rows, ...paging } = await paginate(
            page,
            {
              rows: (db, window) =>
                db.leaveRequest.findMany({
                  where,
                  include: requestInclude,
                  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                  ...window,
                }),
              count: (db) => db.leaveRequest.count({ where }),
            },
            { tx },
          )
          return {
            requests: rows.map((request) => serialize(request, scoped.user)),
            capabilities: { submit: Boolean(scoped.user.employee) },
            ...paging,
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },

    async detail(userId: string, requestId: string) {
      return getPrisma()!.$transaction(
        async (tx) => {
          const user = await actor(tx, userId)
          const request = await tx.leaveRequest.findFirst({
            where: await requestReadWhere(tx, user, requestId),
            include: requestInclude,
          })
          if (!request) fail(404, "Leave request not found")
          return { request: serialize(request, user) }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },

    async overview(userId: string, query: Record<string, unknown>) {
      const input = leaveObject(query, ["scope"])
      return getPrisma()!.$transaction(
        async (tx) => {
          const scoped = await scopeWhere(
            tx,
            await actor(tx, userId),
            input.scope,
          )
          const groups = await tx.leaveRequest.groupBy({
            by: ["status", "type"],
            where: scoped.where,
            _count: { _all: true },
          })
          return {
            groups: groups.map((group) => ({
              status: group.status,
              type: group.type,
              count: group._count._all,
            })),
          }
        },
        { isolationLevel: "RepeatableRead" },
      )
    },

    async act(
      userId: string,
      requestId: string,
      action: LeaveActionInput,
      body: unknown,
    ) {
      const input = leaveObject(body, ["actionId", "expectedVersion", "note"])
      const actionId = leaveUuid(input.actionId, "action ID")
      const expectedVersion = expectedLeaveVersion(input.expectedVersion)
      const note =
        action === "CANCEL"
          ? input.note === undefined
            ? null
            : leaveText(input.note, "cancellation note")
          : leaveText(input.note, "decision note")
      const nextStatus =
        action === "VERIFY"
          ? "VERIFIED"
          : action === "APPROVE"
            ? "APPROVED"
            : action === "REJECT"
              ? "REJECTED"
              : action === "CANCEL"
                ? "CANCELLED"
                : "REVERSED"
      return getPrisma()!.$transaction(
        async (tx) => {
          const snapshot = await tx.leaveRequest.findUnique({
            where: { id: requestId },
            include: requestInclude,
          })
          if (!snapshot) fail(404, "Leave request not found")
          await lockRows(
            tx,
            "Department",
            snapshot.employee.departmentId,
            "share",
          )
          await lockRows(tx, "Employee", snapshot.employeeId)
          await lockRows(
            tx,
            "User",
            action === "APPROVE" ? [userId, snapshot.requestedById] : userId,
            "share",
          )
          await lockRows(tx, "LeaveRequest", requestId)
          const replay = await tx.leaveDecision.findUnique({
            where: {
              requestId_actorId_actionId: {
                requestId,
                actorId: userId,
                actionId,
              },
            },
          })
          const user = await actor(tx, userId)
          if (replay) {
            const current = await tx.leaveRequest.findFirst({
              where: await requestReadWhere(tx, user, requestId),
              include: requestInclude,
            })
            if (!current) fail(404, "Leave request not found")
            if (
              current.employee.departmentId !== snapshot.employee.departmentId
            )
              fail(409, "Employee placement changed; refresh and try again")
            // The receipt stores the version after the decision increment.
            if (
              replay.action !== nextStatus ||
              expectedVersion !== replay.version - 1 ||
              replay.note !== note
            )
              fail(409, "Action ID has already been used")
            return { request: serialize(current, user) }
          }
          const current = await tx.leaveRequest.findUniqueOrThrow({
            where: { id: requestId },
            include: requestInclude,
          })
          if (current.version !== expectedVersion)
            fail(409, "Leave request changed; refresh and try again")
          const access = capabilities(current, user)
          const allowed =
            action === "VERIFY"
              ? access.verify
              : action === "APPROVE"
                ? access.approve
                : action === "REJECT"
                  ? access.reject
                  : action === "CANCEL"
                    ? access.cancel
                    : access.reverse
          if (action === "APPROVE" && access.requiresReverification)
            fail(
              409,
              "Employee changed departments; obtain current department verification or cancel and resubmit",
            )
          if (!allowed) fail(403, "You cannot perform this leave action")
          if (current.employee.departmentId !== snapshot.employee.departmentId)
            fail(409, "Employee placement changed; refresh and try again")
          if (action === "APPROVE")
            await assertApprovalConflicts(tx, current, clock())
          const nextVersion = current.version + 1
          await tx.leaveDecision.create({
            data: {
              ...workforceLogContext(userId),
              requestId,
              actorId: userId,
              actionId,
              action: nextStatus,
              fromStatus: current.status,
              toStatus: nextStatus,
              note,
              version: nextVersion,
            },
          })
          const updated = await tx.leaveRequest.update({
            where: { id: requestId, version: expectedVersion },
            data: {
              status: nextStatus,
              version: { increment: 1 },
              ...(nextStatus === "VERIFIED"
                ? {
                    verifiedById: userId,
                    verifiedAt: clock(),
                    routeDepartmentId: current.employee.departmentId,
                  }
                : {}),
            },
            include: requestInclude,
          })
          await notify(tx, updated, nextStatus)
          return { request: serialize(updated, user) }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
  }
}
