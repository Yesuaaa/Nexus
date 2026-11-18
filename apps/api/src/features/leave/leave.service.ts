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
import { attendanceWorkDate } from "../attendance/attendance.validation.js"
import { leaveAdminVisibility } from "./leave.repository.js"
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
          head: {
            select: {
              id: true,
              role: true,
              isActive: true,
              accountDeletedAt: true,
            },
          },
        },
      },
    },
  },
  days: { orderBy: { workDate: "asc" as const } },
  decisions: {
    include: { actor: { select: { id: true, fullName: true } } },
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
    where: { id: { in: assignments.map((assignment) => assignment.id) } },
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

function eligibleHead(
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
) {
  const head = request.employee.department?.head
  return head?.role === "STAFF" && head.isActive && !head.accountDeletedAt
    ? head
    : null
}

function capabilities(
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
  user: Awaited<ReturnType<typeof actor>>,
) {
  const own =
    request.requestedById === user.id || request.employee.userId === user.id
  const head = eligibleHead(request)
  const fallback = !head || head.id === request.employee.userId
  const departmentHead = user.role === "STAFF" && head?.id === user.id && !own
  const organization = user.role === "ADMIN" || user.role === "SUPERADMIN"
  const reviewer = organization && !own
  const transferred =
    request.routeDepartmentId !== request.employee.departmentId
  return {
    cancel:
      request.requestedById === user.id &&
      (request.status === "SUBMITTED" || request.status === "VERIFIED"),
    verify:
      departmentHead &&
      (request.status === "SUBMITTED" ||
        (request.status === "VERIFIED" && transferred)),
    approve:
      reviewer &&
      (user.role === "SUPERADMIN"
        ? request.status === "SUBMITTED" || request.status === "VERIFIED"
        : request.status === "VERIFIED" ||
          (request.status === "SUBMITTED" && fallback)),
    reject:
      (departmentHead && request.status === "SUBMITTED") ||
      (reviewer &&
        (user.role === "SUPERADMIN"
          ? request.status === "SUBMITTED" || request.status === "VERIFIED"
          : (request.status === "VERIFIED" && !transferred) ||
            (request.status === "SUBMITTED" && fallback))),
    reverse: reviewer && request.status === "APPROVED",
    fallback,
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

async function scopeWhere(tx: Tx, userId: string, scope: unknown) {
  const user = await actor(tx, userId)
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
        ? leaveAdminVisibility
        : ({} satisfies Prisma.LeaveRequestWhereInput),
  }
}

async function notify(tx: Tx, requestId: string, stage: LeaveStatusInput) {
  const request = await tx.leaveRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      employee: {
        include: {
          department: {
            include: {
              head: {
                select: {
                  id: true,
                  role: true,
                  isActive: true,
                  accountDeletedAt: true,
                },
              },
            },
          },
        },
      },
    },
  })
  const head = request.employee.department?.head
  const headEligible =
    head?.role === "STAFF" &&
    head.isActive &&
    !head.accountDeletedAt &&
    head.id !== request.requestedById
  const recipients =
    stage === "SUBMITTED"
      ? await tx.user.findMany({
          where: {
            ...activeAccount,
            OR: [
              ...(headEligible
                ? [{ id: head.id }]
                : [{ role: "ADMIN" as const }]),
              { role: "SUPERADMIN" },
            ],
          },
          select: { id: true },
        })
      : stage === "VERIFIED"
        ? await tx.user.findMany({
            where: { ...activeAccount, role: { in: ["ADMIN", "SUPERADMIN"] } },
            select: { id: true },
          })
        : [{ id: request.requestedById }]
  const message =
    stage === "SUBMITTED"
      ? "A leave request is awaiting review."
      : stage === "VERIFIED"
        ? "A leave request was verified and awaits HR approval."
        : `Your leave request was ${stage.toLowerCase()}.`
  await tx.workflowNotification.createMany({
    data: recipients.map(({ id }) => ({
      userId: id,
      leaveRequestId: request.id,
      type: `LEAVE_${stage}`,
      summary: message,
    })),
    skipDuplicates: true,
  })
}

async function assertApprovalConflicts(
  tx: Tx,
  request: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
  clock: Clock,
) {
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

  const sessions = await tx.attendanceWorkSession.findMany({
    where: { employeeId: request.employeeId },
    select: { startedAt: true, endedAt: true },
  })
  if (sessions.some((session) => !session.endedAt))
    fail(409, "Close active attendance sessions before approving leave")
  if (
    sessions.some((session) =>
      snapshots.some((day) => {
        const label = day.workDate.toISOString().slice(0, 10)
        const start = attendanceWorkDate(session.startedAt, day.timeZone)
        const end = attendanceWorkDate(session.endedAt ?? clock(), day.timeZone)
        return start <= label && end >= label
      }),
    )
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
    adjustments.some((adjustment) =>
      snapshots.some((day) => {
        const label = day.workDate.toISOString().slice(0, 10)
        return (
          attendanceWorkDate(adjustment.proposedStartedAt, day.timeZone) <=
            label &&
          attendanceWorkDate(adjustment.proposedEndedAt, day.timeZone) >= label
        )
      }),
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
            include: { department: { include: { head: true } } },
          })
          const head = identity.department?.head
          const routeDepartmentId =
            head?.role === "STAFF" &&
            head.isActive &&
            !head.accountDeletedAt &&
            head.id !== userId
              ? identity.departmentId
              : null
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
          await notify(tx, created.id, "SUBMITTED")
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
          const scoped = await scopeWhere(tx, userId, input.scope)
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
      return getPrisma()!.$transaction(async (tx) => {
        const user = await actor(tx, userId)
        const scope = await scopeWhere(
          tx,
          userId,
          user.role === "STAFF" && !user.headOf ? "mine" : "team",
        )
        const request = await tx.leaveRequest.findFirst({
          where: {
            id: requestId,
            OR: [scope.where, { requestedById: userId }],
          },
          include: requestInclude,
        })
        if (!request) fail(404, "Leave request not found")
        return { request: serialize(request, user) }
      })
    },

    async overview(userId: string, query: Record<string, unknown>) {
      const input = leaveObject(query, ["scope"])
      return getPrisma()!.$transaction(
        async (tx) => {
          const scoped = await scopeWhere(tx, userId, input.scope)
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
          await lockRows(tx, "User", userId, "share")
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
            const replayAction =
              action === "VERIFY"
                ? "VERIFIED"
                : action === "APPROVE"
                  ? "APPROVED"
                  : action === "REJECT"
                    ? "REJECTED"
                    : action === "CANCEL"
                      ? "CANCELLED"
                      : "REVERSED"
            if (replay.action !== replayAction)
              fail(409, "Action ID has already been used")
            const current = await tx.leaveRequest.findUniqueOrThrow({
              where: { id: requestId },
              include: requestInclude,
            })
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
          if (
            action === "APPROVE" &&
            current.status === "VERIFIED" &&
            current.routeDepartmentId !== current.employee.departmentId
          )
            fail(
              409,
              "Employee changed departments; obtain current department verification or cancel and resubmit",
            )
          if (!allowed) fail(403, "You cannot perform this leave action")
          if (current.employee.departmentId !== snapshot.employee.departmentId)
            fail(409, "Employee placement changed; refresh and try again")
          if (action === "APPROVE")
            await assertApprovalConflicts(tx, current, clock)
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
          const nextVersion = current.version + 1
          await tx.leaveDecision.create({
            data: {
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
          await notify(tx, requestId, nextStatus)
          return { request: serialize(updated, user) }
        },
        { isolationLevel: "ReadCommitted" },
      )
    },
  }
}
