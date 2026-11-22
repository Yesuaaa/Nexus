/** Observe only effects of the existing Department POST/PUT transactions. */
import type { Department, Prisma } from "../../generated/prisma/client.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { syncEmployeeForUser } from "../employees/employees.service.js"
import {
  userUpdateSelect,
  recordUserSynchronization,
  recordDepartmentLeadership,
} from "../employees/employee-update-history.js"
import { writeEmployeeEffects } from "../users/account-workforce-history.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"

const employeeSelect = {
  id: true,
  userId: true,
  departmentId: true,
  teamId: true,
  position: true,
  status: true,
  employmentType: true,
} as const
const metadataKeys = ["name", "code", "color", "description"] as const

export { userUpdateSelect }

export async function synchronizeDepartmentEmployee(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  userId: string,
  beforeUser?: Prisma.UserGetPayload<{ select: typeof userUpdateSelect }>,
) {
  // Same Employee -> missing-Employee User locking as syncEmployeeForUser.
  // Callers already hold the User lock from assignment or title correction.
  const locked = await lockRowsReturning(
    tx,
    "Employee",
    userId,
    "update",
    "userId",
  )
  if (!locked.length) await lockRows(tx, "User", userId)
  const before = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  const user =
    beforeUser ??
    (await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: userUpdateSelect,
    }))
  await syncEmployeeForUser(tx, userId, operation)
  const after = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  if (after)
    await writeEmployeeEffects(
      tx,
      operation,
      before,
      after,
      "DEPARTMENT_MANAGEMENT",
    )
  const afterUser = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: userUpdateSelect,
  })
  await recordUserSynchronization(
    tx,
    operation,
    user,
    afterUser,
    "DEPARTMENT_MANAGEMENT",
  )
}

export async function recordDepartmentChanges(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: Department | null,
  after: Department,
) {
  const base = {
    origin: "DEPARTMENT_MANAGEMENT",
    subjectType: "DEPARTMENT",
    subjectId: after.id,
  } as const
  if (!before) {
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "CREATED",
      changedFields: [
        ...metadataKeys,
        ...(after.headId ? ["headId" as const] : []),
      ],
      changes: after.headId
        ? { headId: { before: null, after: after.headId } }
        : {},
    })
    return
  }
  const changedFields = metadataKeys.filter((key) => before[key] !== after[key])
  if (changedFields.length)
    await writeWorkforceManagementChange(tx, operation, {
      ...base,
      action: "PROFILE_UPDATED",
      changedFields,
      changes: {},
    })
  await recordDepartmentLeadership(
    tx,
    operation,
    before,
    after,
    "DEPARTMENT_MANAGEMENT",
  )
}
