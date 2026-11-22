import type { Prisma } from "../../generated/prisma/client.js"
import {
  assertManagementOperation,
  type ManagementOperation,
} from "../../shared/management-history.js"
import {
  setAttendanceAuditContext,
  workforceLogContext,
} from "../workforce-compliance-logs/write-context.js"

export async function beginAttendancePlacement(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
) {
  assertManagementOperation(operation)
  const actorId = operation.actorAccountId
  const context = {
    ...workforceLogContext(actorId, operation.operationId),
    actorRoleAtTime: operation.actorRoleAtTime,
  }
  await setAttendanceAuditContext(
    tx,
    actorId,
    "Employee department placement changed",
    context,
  )
}
