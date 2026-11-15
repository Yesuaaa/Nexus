/** Attribution wrapper for the two explicit Employee creation entry points. */
import type { Prisma } from "../../generated/prisma/client.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { writeAccountManagementChange } from "../users/account-management-history.js"
import {
  createEmployee,
  EmployeeError,
  type EmployeeWriteInput,
} from "./employees.service.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "./workforce-management-history.js"

export async function createEmployeeWithAttribution(
  tx: Prisma.TransactionClient,
  input: EmployeeWriteInput & { userId: string },
  operation: ManagementOperation,
  mode: "NEW_STAFF_ACCOUNT" | "EXISTING_ACCOUNT_PROFILE",
) {
  // Account birth is known by the calling backend flow, never request fields.
  // Existing-account snapshots and business writes share its existing transaction.
  const before = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: {
      departmentId: true,
      teamId: true,
      team: { select: { departmentId: true } },
    },
  })
  const employee = await createEmployee(tx, input)
  const after = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { role: true, isActive: true, departmentId: true, teamId: true },
  })
  if (mode === "NEW_STAFF_ACCOUNT") {
    await writeAccountManagementChange(tx, operation, {
      origin: "EMPLOYEE_MANAGEMENT",
      action: "CREATED",
      subjectAccountId: input.userId,
      changedFields: ["role", "isActive", "fullName", "email", "contactNumber"],
      changes: {
        role: { before: null, after: after.role },
        isActive: { before: null, after: after.isActive },
      },
    })
  }
  // One creation record covers initial HR fields, link and assignments, including
  // personal fields mirrored to User. Their contents never enter history.
  await writeWorkforceManagementChange(tx, operation, {
    origin: "EMPLOYEE_MANAGEMENT",
    action: "CREATED",
    subjectType: "EMPLOYEE",
    subjectId: employee.id,
    changedFields: [
      "employeeId",
      "fullName",
      "email",
      "contactNumber",
      "position",
      "startDate",
      "employmentType",
      "status",
      "userId",
      "departmentId",
      "teamId",
    ],
    changes: {
      userId: { before: null, after: employee.userId },
      departmentId: { before: null, after: employee.departmentId },
      teamId: { before: null, after: employee.teamId },
      status: { before: null, after: employee.status },
      employmentType: { before: null, after: employee.employmentType },
    },
  })
  const prior =
    mode === "NEW_STAFF_ACCOUNT" ? { departmentId: null, teamId: null } : before
  const changedFields = (["departmentId", "teamId"] as const).filter(
    (key) => prior[key] !== after[key],
  )
  if (changedFields.length) {
    const subjectId =
      after.departmentId ?? before.departmentId ?? before.team?.departmentId
    if (!subjectId)
      throw new EmployeeError(409, "Employee changed; refresh and retry")
    const changes: Extract<
      WorkforceManagementChangeInput,
      { action: "ASSIGNMENT_CHANGED" }
    >["changes"] = { affectedAccountId: input.userId }
    for (const key of changedFields)
      changes[key] = { before: prior[key], after: after[key] }
    await writeWorkforceManagementChange(tx, operation, {
      origin: "EMPLOYEE_MANAGEMENT",
      action: "ASSIGNMENT_CHANGED",
      subjectType: "DEPARTMENT",
      subjectId,
      changedFields,
      changes,
    })
  }
  return employee
}
