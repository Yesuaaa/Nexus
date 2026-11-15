/** Scoped login operations observe workforce effects without changing HR rules. */
import type { Prisma } from "../../generated/prisma/client.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { HttpError } from "../../shared/http-error.js"
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
} satisfies Prisma.EmployeeSelect
type EmployeeSnapshot = Prisma.EmployeeGetPayload<{
  select: typeof employeeSelect
}>
type AssignmentChanges = Extract<
  WorkforceManagementChangeInput,
  { action: "ASSIGNMENT_CHANGED" }
>["changes"]
const assignmentKeys = ["departmentId", "teamId", "userId"] as const
type LifecycleOrigin = "ACCOUNT_MANAGEMENT" | "EMPLOYEE_MANAGEMENT"

export async function writeEmployeeEffects(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: EmployeeSnapshot | null,
  after: EmployeeSnapshot,
  origin:
    | LifecycleOrigin
    | "DEPARTMENT_MANAGEMENT"
    | "TEAM_MANAGEMENT" = "ACCOUNT_MANAGEMENT",
) {
  const base = {
    origin,
    subjectType: "EMPLOYEE",
    subjectId: after.id,
  } as const
  if (!before) {
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "CREATED",
      changedFields: [
        "employeeId",
        "fullName",
        "email",
        "contactNumber",
        "position",
        "status",
        "employmentType",
        ...assignmentKeys,
      ],
      changes: {
        status: { before: null, after: after.status },
        employmentType: { before: null, after: after.employmentType },
        departmentId: { before: null, after: after.departmentId },
        teamId: { before: null, after: after.teamId },
        userId: { before: null, after: after.userId },
      },
    })
    return
  }
  const changedFields = assignmentKeys.filter(
    (key) => before[key] !== after[key],
  )
  if (changedFields.length) {
    const changes: AssignmentChanges = {}
    for (const key of changedFields)
      changes[key] = { before: before[key], after: after[key] }
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "ASSIGNMENT_CHANGED",
      changedFields,
      changes,
    })
  }
  if (before.position !== after.position) {
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "PROFILE_UPDATED",
      changedFields: ["position"],
      changes: {},
    })
  }
}

export async function syncAccountWorkforce(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  userId: string,
  syncEmployee: (
    tx: Prisma.TransactionClient,
    userId: string,
  ) => Promise<unknown>,
  createdAccount = false,
) {
  // Role writes acquire Employee -> User before entering this wrapper. New
  // accounts are not visible outside their creating transaction.
  const before = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  const userSelect = {
    id: true,
    departmentId: true,
    teamId: true,
    team: { select: { departmentId: true } },
  } as const
  const beforeUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  })
  await syncEmployee(tx, userId)
  const after = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  if (after) await writeEmployeeEffects(tx, operation, before, after)
  const afterUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  })
  // A newly created login had no membership before this transaction. This
  // also covers Superadmin logins, for which synchronization creates no Employee.
  const priorMembership = createdAccount
    ? { departmentId: null, teamId: null }
    : beforeUser
  const changedFields = (["departmentId", "teamId"] as const).filter(
    (key) => priorMembership[key] !== afterUser[key],
  )
  if (changedFields.length) {
    const subjectId =
      afterUser.departmentId ??
      beforeUser.departmentId ??
      beforeUser.team?.departmentId
    if (!subjectId)
      throw new HttpError(409, "Account assignment changed; refresh and retry")
    const changes: AssignmentChanges = { affectedAccountId: userId }
    for (const key of changedFields)
      changes[key] = { before: priorMembership[key], after: afterUser[key] }
    await writeWorkforceManagementChange(tx, operation, {
      action: "ASSIGNMENT_CHANGED",
      origin: "ACCOUNT_MANAGEMENT",
      subjectType: "DEPARTMENT",
      subjectId,
      changedFields,
      changes,
    })
  }
}

const headSelect = {
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

/** Must be used in the deletion's Serializable transaction, before DELETE. */
export async function readAccountDeletionWorkforce(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const account = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      departmentId: true,
      teamId: true,
      team: { select: { departmentId: true } },
    },
  })
  const departments = await tx.department.findMany({
    where: {
      OR: [
        { headId: userId },
        { temporaryHeadOriginalId: userId },
        { temporaryHeadAssignedId: userId },
      ],
    },
    select: headSelect,
    orderBy: { id: "asc" },
  })
  await lockRows(tx, "Department", [
    ...departments.map((row) => row.id),
    account?.departmentId,
    account?.team?.departmentId,
  ])
  await lockRowsReturning(tx, "Employee", userId, "update", "userId")
  await lockRows(tx, "User", userId)
  const employee = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  const teams = await tx.team.findMany({
    where: { leadId: userId },
    select: { id: true, leadId: true },
    orderBy: { id: "asc" },
  })
  return { account, employee, departments, teams }
}

export async function writeAccountDeletionWorkforce(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: Awaited<ReturnType<typeof readAccountDeletionWorkforce>>,
  origin: LifecycleOrigin = "ACCOUNT_MANAGEMENT",
) {
  if (before.account) {
    const changedFields = (["departmentId", "teamId"] as const).filter(
      (key) => before.account![key] !== null,
    )
    if (changedFields.length) {
      const subjectId =
        before.account.departmentId ?? before.account.team?.departmentId
      if (!subjectId)
        throw new HttpError(
          409,
          "Account assignment changed; refresh and retry",
        )
      const changes: AssignmentChanges = {
        affectedAccountId: before.account.id,
      }
      for (const key of changedFields)
        changes[key] = { before: before.account[key], after: null }
      await writeWorkforceManagementChange(tx, operation, {
        action: "ASSIGNMENT_CHANGED",
        origin,
        subjectType: "DEPARTMENT",
        subjectId,
        changedFields,
        changes,
      })
    }
  }
  if (before.employee) {
    const after = await tx.employee.findUniqueOrThrow({
      where: { id: before.employee.id },
      select: employeeSelect,
    })
    await writeEmployeeEffects(tx, operation, before.employee, after, origin)
  }
  for (const department of before.departments) {
    const after = await tx.department.findUniqueOrThrow({
      where: { id: department.id },
      select: headSelect,
    })
    const changedFields = headKeys.filter(
      (key) => department[key] !== after[key],
    )
    if (!changedFields.length) continue
    const changes: Extract<
      WorkforceManagementChangeInput,
      { action: "TEMPORARY_HEAD_CHANGED" }
    >["changes"] = {}
    for (const key of changedFields)
      changes[key] = { before: department[key], after: after[key] }
    const base = {
      origin,
      subjectType: "DEPARTMENT",
      subjectId: department.id,
      changedFields,
    } as const
    if (changes.headId) {
      await writeWorkforceManagementChange(tx, operation, {
        ...base,
        action: "HEAD_CHANGED",
        changes: { ...changes, headId: changes.headId },
      })
    } else {
      await writeWorkforceManagementChange(tx, operation, {
        ...base,
        action: "TEMPORARY_HEAD_CHANGED",
        changes,
      })
    }
  }
  for (const team of before.teams) {
    const after = await tx.team.findUniqueOrThrow({
      where: { id: team.id },
      select: { leadId: true },
    })
    if (team.leadId !== after.leadId)
      await writeWorkforceManagementChange(tx, operation, {
        action: "LEAD_CHANGED",
        origin,
        subjectType: "TEAM",
        subjectId: team.id,
        changedFields: ["leadId"],
        changes: { leadId: { before: team.leadId, after: after.leadId } },
      })
  }
}
