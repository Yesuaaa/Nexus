import { randomUUID } from "node:crypto"
import type { Prisma } from "../../generated/prisma/client.js"
import { logContext } from "../service-operation-logs/log-context.js"

export function workforceLogContext(
  actorId: string,
  operationId: string = randomUUID(),
) {
  const request = logContext.getStore()
  const actor = request?.request.auth?.user
  return {
    operationId,
    correlationId: request?.correlationId ?? null,
    actorRoleAtTime: actor?.id === actorId ? actor.role : null,
  }
}

export async function setAttendanceAuditContext(
  tx: Prisma.TransactionClient,
  actorId: string,
  reason: string,
  context = workforceLogContext(actorId),
) {
  const { operationId, correlationId, actorRoleAtTime } = context
  await tx.$queryRaw`
    SELECT set_config('app.attendance_actor_id', ${actorId}, true),
      set_config('app.attendance_reason', ${reason}, true),
      set_config('app.attendance_operation_id', ${operationId}, true),
      set_config('app.attendance_correlation_id', ${correlationId ?? ""}, true),
      set_config('app.attendance_actor_role', ${actorRoleAtTime ?? ""}, true)
  `
}
