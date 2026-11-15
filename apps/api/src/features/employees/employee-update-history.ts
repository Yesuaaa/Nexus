/** Transaction-local records reused by authenticated Employee/Department writes. */
import type {
  Department,
  Employee,
  Prisma,
  User,
} from "../../generated/prisma/client.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { HttpError } from "../../shared/http-error.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "./workforce-management-history.js"

export const employeeAssignmentSelect = {
  id: true,
  userId: true,
  departmentId: true,
  teamId: true,
} as const
export const userUpdateSelect = {
  id: true,
  departmentId: true,
  teamId: true,
  position: true,
  fullName: true,
  email: true,
  contactNumber: true,
  team: { select: { departmentId: true } },
} as const
const profileKeys = [
  "employeeId",
  "fullName",
  "email",
  "contactNumber",
  "position",
  "employmentType",
  "startDate",
] as const
const assignmentKeys = ["userId", "departmentId", "teamId"] as const
const mirrorKeys = ["fullName", "email", "contactNumber", "position"] as const
const headKeys = [
  "headId",
  "temporaryHeadOriginalId",
  "temporaryHeadAssignedId",
] as const
type AssignmentChanges = Extract<
  WorkforceManagementChangeInput,
  { action: "ASSIGNMENT_CHANGED" }
>["changes"]
type EmployeeAssignment = Pick<
  Employee,
  "id" | "userId" | "departmentId" | "teamId"
>
type EmployeeState = EmployeeAssignment &
  Pick<Employee, (typeof profileKeys)[number] | "status">
type DepartmentState = Pick<Department, "id" | (typeof headKeys)[number]>
type UserState = Pick<
  User,
  "id" | "departmentId" | "teamId" | (typeof mirrorKeys)[number]
> & { team: { departmentId: string } | null }
type EmployeeChangeOrigin =
  "EMPLOYEE_MANAGEMENT" | "DEPARTMENT_MANAGEMENT" | "TEAM_MANAGEMENT"

export async function recordEmployeeAssignments(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: EmployeeAssignment,
  after: EmployeeAssignment,
  origin: EmployeeChangeOrigin = "EMPLOYEE_MANAGEMENT",
) {
  const changedFields = assignmentKeys.filter(
    (key) => before[key] !== after[key],
  )
  if (!changedFields.length) return
  const changes: AssignmentChanges = {}
  for (const key of changedFields)
    changes[key] = { before: before[key], after: after[key] }
  await writeWorkforceManagementChange(tx, operation, {
    origin,
    action: "ASSIGNMENT_CHANGED",
    subjectType: "EMPLOYEE",
    subjectId: after.id,
    changedFields,
    changes,
  })
}

export async function recordUserSynchronization(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: UserState,
  after: UserState,
  origin: EmployeeChangeOrigin = "EMPLOYEE_MANAGEMENT",
  includeUnlinkedPosition = false,
) {
  const assignmentFields = (["departmentId", "teamId"] as const).filter(
    (key) => before[key] !== after[key],
  )
  const changedFields = [
    ...assignmentFields,
    ...(includeUnlinkedPosition && before.position !== after.position
      ? ["position" as const]
      : []),
  ]
  if (changedFields.length) {
    const subjectId =
      after.departmentId ?? before.departmentId ?? before.team?.departmentId
    if (!subjectId)
      throw new HttpError(409, "Employee changed; refresh and retry")
    const changes: AssignmentChanges = { affectedAccountId: before.id }
    for (const key of assignmentFields)
      changes[key] = { before: before[key], after: after[key] }
    await writeWorkforceManagementChange(tx, operation, {
      origin,
      action: "ASSIGNMENT_CHANGED",
      subjectType: "DEPARTMENT",
      subjectId,
      changedFields,
      changes,
    })
  }
  // Return field names only; merge mirrored profile effects into the target
  // Employee event instead of duplicating them as account profile history.
  return mirrorKeys.filter((key) => before[key] !== after[key])
}

export async function recordEmployeeUpdate(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: EmployeeState,
  after: EmployeeState,
  mirrors: readonly (typeof mirrorKeys)[number][],
  ownTitleCleared: boolean,
  origin: EmployeeChangeOrigin = "EMPLOYEE_MANAGEMENT",
) {
  const changedFields = profileKeys.filter((key) => {
    if (key === "position" && ownTitleCleared) return false
    const previous =
      before[key] instanceof Date ? before[key].getTime() : before[key]
    const next = after[key] instanceof Date ? after[key].getTime() : after[key]
    return previous !== next || mirrors.some((field) => field === key)
  })
  const base = {
    origin,
    subjectType: "EMPLOYEE",
    subjectId: after.id,
  } as const
  if (changedFields.length)
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "PROFILE_UPDATED",
      changedFields,
      changes: {
        ...(before.employmentType !== after.employmentType
          ? {
              employmentType: {
                before: before.employmentType,
                after: after.employmentType,
              },
            }
          : {}),
      },
    })
  if (before.status !== after.status)
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "STATUS_CHANGED",
      changedFields: ["status"],
      changes: { status: { before: before.status, after: after.status } },
    })
  await recordEmployeeAssignments(tx, operation, before, after, origin)
}

export async function recordDepartmentLeadership(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: DepartmentState,
  after: DepartmentState,
  origin:
    "EMPLOYEE_MANAGEMENT" | "DEPARTMENT_MANAGEMENT" = "EMPLOYEE_MANAGEMENT",
) {
  const changedFields = headKeys.filter((key) => before[key] !== after[key])
  if (!changedFields.length) return
  const changes: Extract<
    WorkforceManagementChangeInput,
    { action: "TEMPORARY_HEAD_CHANGED" }
  >["changes"] = {}
  for (const key of changedFields)
    changes[key] = { before: before[key], after: after[key] }
  const base = {
    origin,
    subjectType: "DEPARTMENT",
    subjectId: after.id,
    changedFields,
  } as const
  if (changes.headId)
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "HEAD_CHANGED",
      changes: { ...changes, headId: changes.headId },
    })
  else
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "TEMPORARY_HEAD_CHANGED",
      changes,
    })
}
