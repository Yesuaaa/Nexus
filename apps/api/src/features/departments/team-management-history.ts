/** Team-local history; business assignment and synchronization stay in services. */
import type { Prisma } from "../../generated/prisma/client.js"
import { lockRows } from "../../shared/db/locks.js"
import { HttpError } from "../../shared/http-error.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { userUpdateSelect } from "../employees/employee-update-history.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"
import {
  memberEmployeeSelect,
  type MemberState,
} from "./department-member-history.js"

export const teamHistorySelect = {
  id: true,
  departmentId: true,
  leadId: true,
  name: true,
  description: true,
} as const
type TeamState = Prisma.TeamGetPayload<{ select: typeof teamHistorySelect }>

export function rememberTeamMember(
  states: Map<string, MemberState>,
  state: MemberState,
) {
  const key = state.user
    ? `user:${state.user.id}`
    : `employee:${state.employee!.id}`
  if (!states.has(key)) states.set(key, state)
}

export async function recordTeamChanges(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: TeamState | null,
  after: TeamState | null,
) {
  const subjectId = after?.id ?? before?.id
  if (!subjectId) throw new Error("Team history requires an actual subject")
  const base = {
    origin: "TEAM_MANAGEMENT",
    subjectType: "TEAM",
    subjectId,
  } as const
  if (!before && after) {
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "CREATED",
      changedFields: [
        "name",
        "description",
        "departmentId",
        ...(after.leadId ? ["leadId" as const] : []),
      ],
      changes: {
        departmentId: { before: null, after: after.departmentId },
        ...(after.leadId
          ? { leadId: { before: null, after: after.leadId } }
          : {}),
      },
    })
  } else if (before && !after) {
    if (await tx.team.count({ where: { id: before.id } }))
      throw new HttpError(409, "Team changed; refresh and retry")
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "DELETED",
      changedFields: [
        "departmentId",
        ...(before.leadId ? ["leadId" as const] : []),
      ],
      changes: {
        departmentId: { before: before.departmentId, after: null },
        ...(before.leadId
          ? { leadId: { before: before.leadId, after: null } }
          : {}),
      },
    })
  } else if (before && after) {
    const changedFields = (["name", "description"] as const).filter(
      (key) => before[key] !== after[key],
    )
    if (changedFields.length)
      await writeWorkforceManagementChange(tx, operation, {
        ...base,
        action: "PROFILE_UPDATED",
        changedFields,
        changes: {},
      })
    if (before.leadId !== after.leadId)
      await writeWorkforceManagementChange(tx, operation, {
        ...base,
        action: "LEAD_CHANGED",
        changedFields: ["leadId"],
        changes: { leadId: { before: before.leadId, after: after.leadId } },
      })
  }
}

function assertCaptured(
  rows: readonly { id: string }[],
  locked: readonly { id: string }[],
) {
  const ids = new Set(locked.map((row) => row.id))
  if (rows.some((row) => !ids.has(row.id)))
    throw new HttpError(409, "Team changed; refresh and retry")
}

export async function readTeamDeletionState(
  tx: Prisma.TransactionClient,
  departmentId: string,
  teamId: string,
) {
  // Retain deletion's User -> Employee -> Team acquisition order. Capture
  // employees linked to syncing Users even when their old assignment differs.
  const userIds = await tx.user.findMany({
    where: { teamId },
    select: { id: true },
  })
  await lockRows(
    tx,
    "User",
    userIds.map((row) => row.id),
  )
  const linkedUsers = await tx.user.findMany({
    where: { teamId },
    select: { id: true },
  })
  const employeeIds = await tx.employee.findMany({
    where: {
      OR: [{ teamId }, { userId: { in: linkedUsers.map((row) => row.id) } }],
    },
    select: { id: true },
  })
  await lockRows(
    tx,
    "Employee",
    employeeIds.map((row) => row.id),
  )
  await lockRows(tx, "Team", teamId)
  const team = await tx.team.findFirstOrThrow({
    where: { id: teamId, departmentId },
    select: teamHistorySelect,
  })
  const users = await tx.user.findMany({
    where: { teamId },
    select: userUpdateSelect,
    orderBy: { id: "asc" },
  })
  const employees = await tx.employee.findMany({
    where: { OR: [{ teamId }, { userId: { in: users.map((row) => row.id) } }] },
    select: memberEmployeeSelect,
    orderBy: { id: "asc" },
  })
  // The protected Team blocks later FK entries. An arrival before its lock
  // requires a retry rather than new out-of-order locks or speculative history.
  assertCaptured(users, userIds)
  assertCaptured(employees, employeeIds)
  const states = new Map<string, MemberState>()
  const userIdsWithWrites = new Set(users.map((user) => user.id))
  const employeeByUser = new Map(
    employees
      .filter((employee) => employee.userId)
      .map((employee) => [employee.userId, employee]),
  )
  for (const user of users)
    rememberTeamMember(states, {
      user,
      employee: employeeByUser.get(user.id) ?? null,
    })
  for (const employee of employees)
    if (!employee.userId || !userIdsWithWrites.has(employee.userId)) {
      // This Employee loses its Team through UPDATE/FK cleanup, but its User is
      // outside the syncing set. Do not invent a User write or acquire extra locks.
      rememberTeamMember(states, { employee, user: null })
    }
  return { team, states, syncUserIds: users.map((user) => user.id) }
}
