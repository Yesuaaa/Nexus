/** Transaction-local snapshots of the existing Department deletion effects. */
import type { Prisma } from "../../generated/prisma/client.js"
import { lockRows } from "../../shared/db/locks.js"
import { HttpError } from "../../shared/http-error.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import {
  userUpdateSelect,
  recordUserSynchronization,
} from "../employees/employee-update-history.js"
import { writeEmployeeEffects } from "../users/account-workforce-history.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "../employees/workforce-management-history.js"

const employeeSelect = {
  id: true,
  userId: true,
  departmentId: true,
  teamId: true,
  position: true,
  status: true,
  employmentType: true,
} as const
const teamSelect = { id: true, departmentId: true, leadId: true } as const
const departmentSelect = {
  id: true,
  headId: true,
  temporaryHeadOriginalId: true,
  temporaryHeadAssignedId: true,
} as const
const headKeys = [
  "headId",
  "temporaryHeadOriginalId",
  "temporaryHeadAssignedId",
] as const
type DeletedChanges = Extract<
  WorkforceManagementChangeInput,
  { action: "DELETED" }
>["changes"]

function assertCaptured(
  rows: readonly { id: string }[],
  locked: readonly { id: string }[],
) {
  const ids = new Set(locked.map((row) => row.id))
  if (rows.some((row) => !ids.has(row.id)))
    throw new HttpError(409, "Department changed; refresh and retry")
}

export async function readDepartmentDeletionWorkforce(
  tx: Prisma.TransactionClient,
  id: string,
) {
  await lockRows(tx, "Department", id)
  const department = await tx.department.findUniqueOrThrow({
    where: { id },
    select: departmentSelect,
  })
  // Same guards, messages and precedence as the existing DELETE service, now
  // checked under its parent lock so a late service link cannot escape history.
  if (await tx.service.count({ where: { departments: { some: { id } } } }))
    throw new HttpError(
      409,
      "Reassign or remove this department's services before deleting the department",
    )
  const accepted = await tx.serviceRequest.count({
    where: { acceptedDepartmentId: id },
  })
  const conversations = await tx.requestConversation.count({
    where: { departmentId: id },
  })
  if (accepted + conversations > 0)
    throw new HttpError(
      409,
      "This department has client request history and can't be deleted",
    )

  const candidates = await tx.team.findMany({
    where: { departmentId: id },
    select: { id: true },
    orderBy: { id: "asc" },
  })
  const teamIds = candidates.map((row) => row.id)
  const membershipWhere = {
    OR: [{ departmentId: id }, { teamId: { in: teamIds } }],
  }
  const userIds = await tx.user.findMany({
    where: membershipWhere,
    select: { id: true },
  })
  // Retain DELETE's existing User -> Employee -> cascaded Team acquisition
  // order, with sorted row locks before reading values used by history.
  await lockRows(
    tx,
    "User",
    userIds.map((row) => row.id),
  )
  const linkedUsers = await tx.user.findMany({
    where: { departmentId: id },
    select: { id: true },
  })
  const syncUserIds = linkedUsers.map((row) => row.id)
  const employeeWhere = {
    OR: [...membershipWhere.OR, { userId: { in: syncUserIds } }],
  }
  const employeeIds = await tx.employee.findMany({
    where: employeeWhere,
    select: { id: true },
  })
  await lockRows(
    tx,
    "Employee",
    employeeIds.map((row) => row.id),
  )
  await lockRows(tx, "Team", teamIds)

  const teams = await tx.team.findMany({
    where: { departmentId: id },
    select: teamSelect,
    orderBy: { id: "asc" },
  })
  const actualMembership = {
    OR: [{ departmentId: id }, { teamId: { in: teams.map((row) => row.id) } }],
  }
  const users = await tx.user.findMany({
    where: actualMembership,
    select: userUpdateSelect,
    orderBy: { id: "asc" },
  })
  const employees = await tx.employee.findMany({
    where: { OR: [...actualMembership.OR, { userId: { in: syncUserIds } }] },
    select: employeeSelect,
    orderBy: { id: "asc" },
  })
  // Parent locks prevent new FK references. A team-only membership that joined
  // before its Team lock was acquired must cause a retry, not speculative history
  // or a new round of User locks after Employee/Team locks.
  assertCaptured(teams, candidates)
  assertCaptured(users, userIds)
  assertCaptured(employees, employeeIds)
  return { department, teams, users, employees, syncUserIds }
}

export async function writeDepartmentDeletionWorkforce(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: Awaited<ReturnType<typeof readDepartmentDeletionWorkforce>>,
) {
  const id = before.department.id
  if (
    (await tx.department.findUnique({ where: { id }, select: { id: true } })) ||
    (await tx.team.count({
      where: { id: { in: before.teams.map((row) => row.id) } },
    }))
  )
    throw new HttpError(409, "Department changed; refresh and retry")
  const users = await tx.user.findMany({
    where: { id: { in: before.users.map((row) => row.id) } },
    select: userUpdateSelect,
    orderBy: { id: "asc" },
  })
  const employees = await tx.employee.findMany({
    where: {
      OR: [
        { id: { in: before.employees.map((row) => row.id) } },
        { userId: { in: before.syncUserIds } },
      ],
    },
    select: employeeSelect,
    orderBy: { id: "asc" },
  })
  assertCaptured(before.users, users)
  assertCaptured(before.employees, employees)
  const employeeBefore = new Map(before.employees.map((row) => [row.id, row]))
  for (const employee of employees)
    await writeEmployeeEffects(
      tx,
      operation,
      employeeBefore.get(employee.id) ?? null,
      employee,
      "DEPARTMENT_MANAGEMENT",
    )
  const userBefore = new Map(before.users.map((row) => [row.id, row]))
  for (const user of users)
    await recordUserSynchronization(
      tx,
      operation,
      userBefore.get(user.id)!,
      user,
      "DEPARTMENT_MANAGEMENT",
    )

  for (const team of before.teams) {
    await writeWorkforceManagementChange(tx, operation, {
      origin: "DEPARTMENT_MANAGEMENT",
      subjectType: "TEAM",
      subjectId: team.id,
      action: "DELETED",
      changedFields: [
        "departmentId",
        ...(team.leadId ? ["leadId" as const] : []),
      ],
      changes: {
        departmentId: { before: team.departmentId, after: null },
        ...(team.leadId
          ? { leadId: { before: team.leadId, after: null } }
          : {}),
      },
    })
  }
  const changedFields = headKeys.filter(
    (key) => before.department[key] !== null,
  )
  const changes: DeletedChanges = {}
  for (const key of changedFields)
    changes[key] = { before: before.department[key], after: null }
  await writeWorkforceManagementChange(tx, operation, {
    origin: "DEPARTMENT_MANAGEMENT",
    subjectType: "DEPARTMENT",
    subjectId: id,
    action: "DELETED",
    changedFields,
    changes,
  })
}
