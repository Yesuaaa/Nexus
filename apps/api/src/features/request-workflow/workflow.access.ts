import type { Prisma } from "../../generated/prisma/client.js"
import { lockServiceRequest } from "../../shared/db/locks.js"
import { activeAccount } from "../../shared/query/accounts.js"
import { fail } from "./workflow.validation.js"

export type WorkflowTx = Prisma.TransactionClient

export async function workflowAccess(
  tx: WorkflowTx,
  userId: string,
  requestId: string,
) {
  const user = await tx.user.findFirst({
    where: { id: userId, ...activeAccount },
    select: { id: true, role: true },
  })
  const request = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      service: true,
      client: {
        select: {
          id: true,
          fullName: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      },
      acceptedDepartment: {
        select: {
          id: true,
          name: true,
          headId: true,
          head: {
            select: { role: true, isActive: true, accountDeletedAt: true },
          },
        },
      },
      workflow: true,
    },
  })
  if (!user || !request) fail("Workflow not found", 404)
  const isClient = user.role === "USER" && request.clientId === userId
  const manage =
    user.role === "STAFF" && request.acceptedDepartment?.headId === userId
  const financialRole = user.role === "ADMIN" || user.role === "SUPERADMIN"
  const approveQuotation =
    financialRole && request.workflow?.quotationApproverId === userId
  const verifyPayment =
    financialRole && request.workflow?.paymentVerifierId === userId
  if (!isClient && !manage && !approveQuotation && !verifyPayment)
    fail("Workflow not found", 404)
  return {
    request,
    user,
    permissions: { isClient, manage, approveQuotation, verifyPayment },
  }
}

export async function lockRequest(tx: WorkflowTx, requestId: string) {
  // Serialize all structured actions (including uploads) for one service request.
  await lockServiceRequest(tx, requestId)
}

export async function appendEvent(
  tx: WorkflowTx,
  requestId: string,
  actorId: string | null,
  type: string,
  summary: string,
  entityId: string | null = null,
  internal = false,
) {
  const event = await tx.workflowEvent.create({
    data: { requestId, actorId, type, summary, entityId, internal },
  })
  const request = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      clientId: true,
      conversationId: true,
      acceptedDepartment: { select: { headId: true } },
      workflow: {
        select: { quotationApproverId: true, paymentVerifierId: true },
      },
    },
  })
  const candidates = [
    !internal ? request.clientId : null,
    request.acceptedDepartment?.headId,
    /^(QUOTATION|APPROVERS)_/.test(type)
      ? request.workflow?.quotationApproverId
      : null,
    /^(PAYMENT|AGREEMENT|APPROVERS)_/.test(type)
      ? request.workflow?.paymentVerifierId
      : null,
  ].filter((id): id is string => Boolean(id) && id !== actorId)
  const userIds = [...new Set(candidates)]
  if (request.conversationId)
    await tx.requestConversation.update({
      where: { id: request.conversationId },
      data: { updatedAt: new Date() },
    })
  if (userIds.length)
    await tx.workflowNotification.createMany({
      data: userIds.map((userId) => ({ requestId, userId, eventId: event.id })),
    })
  return event
}

export async function initializeWorkflow(
  tx: WorkflowTx,
  requestId: string,
  actorId: string | null,
) {
  const existing = await tx.requestWorkflow.findUnique({ where: { requestId } })
  if (existing) return existing
  const request = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { service: true },
  })
  if (!request.acceptedAt || !request.acceptedDepartmentId)
    fail("Accept this request for consultation first", 409)
  const workflow = await tx.requestWorkflow.create({
    data: {
      requestId,
      state:
        request.status === "CANCELLED"
          ? "CANCELLED"
          : request.status === "CLOSED"
            ? "ON_HOLD"
            : "CONSULTATION",
      consultationRequired: request.service.requiresConsultation,
      agreementRequired: request.service.requiresAgreement,
      paymentRequired: request.service.requiresPayment,
      quotationApprovalRequired: request.service.requiresQuotationApproval,
    },
  })
  await appendEvent(
    tx,
    requestId,
    actorId,
    "CONSULTATION_OPENED",
    "Request accepted for consultation. Service delivery starts only after quotation approval and commencement requirements are completed.",
  )
  return workflow
}
