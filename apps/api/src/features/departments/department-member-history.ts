/** Observe the scoped member operation; never perform synchronization here. */
import type { Prisma } from "../../generated/prisma/client.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import { HttpError } from "../../shared/http-error.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import {
  userUpdateSelect,
  recordEmployeeUpdate,
  recordUserSynchronization,
} from "../employees/employee-update-history.js"
import { writeEmployeeEffects } from "../users/account-workforce-history.js"

const employeeSelect = {
  id: true,
  userId: true,
  departmentId: true,
  teamId: true,
  employeeId: true,
  fullName: true,
  email: true,
  contactNumber: true,
  position: true,
  employmentType: true,
  status: true,
  startDate: true,
} as const
export { employeeSelect as memberEmployeeSelect }
export type MemberState = {
  employee: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }> | null
  user: Prisma.UserGetPayload<{ select: typeof userUpdateSelect }> | null
}

export async function readEmployeeMemberState(
  tx: Prisma.TransactionClient,
  employeeId: string,
): Promise<MemberState> {
  // Match updateEmployee's Employee -> User order, retaining its own reentrant
  // validation/locks. Member inputs never request a status/leadership change.
  await lockRows(tx, "Employee", employeeId)
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: employeeSelect,
  })
  if (!employee) throw new HttpError(404, "Employee not found")
  if (employee.userId) await lockRows(tx, "User", employee.userId)
  const user = employee.userId
    ? await tx.user.findUniqueOrThrow({
        where: { id: employee.userId },
        select: userUpdateSelect,
      })
    : null
  return { employee, user }
}

export async function readUserMemberState(
  tx: Prisma.TransactionClient,
  userId: string,
  userFirst: boolean,
): Promise<MemberState> {
  // Legacy PATCH/DELETE previously wrote User before synchronization; POST
  // begins with syncEmployeeForUser's Employee-by-user lock instead.
  if (!userFirst)
    await lockRowsReturning(tx, "Employee", userId, "update", "userId")
  await lockRows(tx, "User", userId)
  // Recheck after a missing-Employee User fallback, using the existing sync
  // order. This prevents an unlocked before-value if an Employee appeared.
  await lockRowsReturning(tx, "Employee", userId, "update", "userId")
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: userUpdateSelect,
  })
  const employee = await tx.employee.findUnique({
    where: { userId },
    select: employeeSelect,
  })
  return { employee, user }
}

export async function writeDepartmentMemberChanges(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  before: MemberState,
  origin: "DEPARTMENT_MANAGEMENT" | "TEAM_MANAGEMENT" = "DEPARTMENT_MANAGEMENT",
) {
  const employee = before.employee
    ? await tx.employee.findUniqueOrThrow({
        where: { id: before.employee.id },
        select: employeeSelect,
      })
    : before.user
      ? await tx.employee.findUnique({
          where: { userId: before.user.id },
          select: employeeSelect,
        })
      : null
  const user = before.user
    ? await tx.user.findUniqueOrThrow({
        where: { id: before.user.id },
        select: userUpdateSelect,
      })
    : null
  if (employee) {
    if (before.employee) {
      // Position is the only mirrored profile field these operations can write.
      // Include User-only normalization once in the Employee profile event.
      const mirrors: "position"[] =
        before.user && user && before.user.position !== user.position
          ? ["position"]
          : []
      await recordEmployeeUpdate(
        tx,
        operation,
        before.employee,
        employee,
        mirrors,
        false,
        origin,
      )
    } else {
      // Birth uses the final persisted state, without an intermediate null ->
      // department assignment event for a just-created Employee.
      await writeEmployeeEffects(tx, operation, null, employee, origin)
    }
  }
  if (before.user && user)
    await recordUserSynchronization(
      tx,
      operation,
      before.user,
      user,
      origin,
      !employee,
    )
}
