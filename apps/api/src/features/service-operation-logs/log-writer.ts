import { randomUUID } from "node:crypto"
import type { Prisma } from "../../generated/prisma/client.js"
import { isRecordId } from "../../shared/validation.js"
import {
  prepareServiceLogDetails,
  type ServiceLogDetails,
} from "./audit-context.js"
import { logContext, serviceLogEndpoint } from "./log-context.js"
import { ServiceOperationLogWriteError } from "./log-write-error.js"

export const serviceLogEvents = {
  SERVICE_CREATED: "catalog",
  SERVICE_UPDATED: "catalog",
  SERVICE_STATUS_CHANGED: "catalog",
  SERVICE_DELETED: "catalog",
  PRICING_UPDATED: "catalog",
  PRICING_DELETED: "catalog",
  REQUEST_SUBMITTED: "requests",
  REQUEST_ACCEPTED: "requests",
  REQUEST_CANCELLED: "requests",
  REQUEST_CONCLUDED: "requests",
  WORKFLOW_ACTION_COMPLETED: "workflow",
  FILE_UPLOADED: "workflow",
  CAPACITY_UPDATED: "workload",
  STAFF_ALLOCATED: "workload",
  STAFF_REMOVED: "workload",
} as const
export type ServiceLogEvent = keyof typeof serviceLogEvents
export const loggedWorkflowActions = [
  "RESPOND_CONSULTATION_RESCHEDULE",
  "REQUEST_CONSULTATION_RESCHEDULE",
  "REQUEST_REQUIREMENT",
  "SUBMIT_REQUIREMENT",
  "REVIEW_REQUIREMENT",
  "SCHEDULE_CONSULTATION",
  "COMPLETE_CONSULTATION",
  "CANCEL_CONSULTATION",
  "PREPARE_QUOTATION",
  "FIXED_QUOTATION",
  "ACTIVATE_PROJECT",
  "CREATE_QUOTATION",
  "APPROVE_QUOTATION",
  "RESPOND_QUOTATION",
  "ATTACH_AGREEMENT",
  "SIGN_AGREEMENT",
  "REVIEW_AGREEMENT",
  "VERIFY_PAYMENT",
  "SUBMIT_PAYMENT",
  "COMPLETE_SANDBOX_PAYMENT",
  "ASSIGN_APPROVERS",
  "STAFF_PROJECT",
  "HOLD",
  "RESUME",
  "CANCEL",
  "INTERNAL_NOTE",
] as const

/** Only known event codes and identity scalars; business writes supply their transaction. */
export async function writeServiceLog(
  tx: Prisma.TransactionClient,
  event: ServiceLogEvent,
  subjectId: string,
  requestId?: string,
  actorId?: string,
  action?: string,
  details?: ServiceLogDetails,
) {
  if (
    action !== undefined &&
    (!loggedWorkflowActions.some((value) => value === action) ||
      event !== "WORKFLOW_ACTION_COMPLETED")
  )
    throw new Error("Invalid service log action")
  if (
    !Object.hasOwn(serviceLogEvents, event) ||
    !isRecordId(subjectId) ||
    (requestId !== undefined && !isRecordId(requestId))
  )
    throw new Error("Invalid service log event")
  const context = logContext.getStore()
  const id = actorId ?? context?.request.auth?.user.id
  if (id !== undefined && !isRecordId(id))
    throw new Error("Invalid service log actor")
  const actor = id
    ? await tx.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, fullName: true, role: true },
      })
    : null
  const audit = prepareServiceLogDetails(event, details)
  try {
    await tx.serviceOperationLog.create({
      data: {
        event,
        endpoint: context ? serviceLogEndpoint(context.request) : undefined,
        action,
        source: serviceLogEvents[event],
        outcome: "SUCCESS",
        subjectId,
        ...audit,
        requestId,
        actorId: actor?.id,
        actorName: actor?.fullName?.trim() || undefined,
        actorRole: actor?.role,
        correlationId: context?.correlationId ?? randomUUID(),
      },
    })
  } catch (error) {
    throw new ServiceOperationLogWriteError(error)
  }
}
