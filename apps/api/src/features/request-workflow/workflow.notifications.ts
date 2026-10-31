import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeUser } from "./workflow.access.js"
import { fail } from "./workflow.validation.js"

export function notificationScope(
  userId: string,
): Prisma.WorkflowNotificationWhereInput {
  return {
    userId,
    OR: [
      {
        workflow: {
          request: {
            clientId: userId,
            client: { ...activeUser, role: "USER" },
          },
        },
        event: { internal: false },
      },
      {
        workflow: {
          request: {
            acceptedDepartment: {
              headId: userId,
              head: { ...activeUser, role: "STAFF" },
            },
          },
        },
      },
      {
        user: { ...activeUser, role: { in: ["ADMIN", "SUPERADMIN"] } },
        workflow: { quotationApproverId: userId },
        event: {
          OR: [
            { type: { startsWith: "QUOTATION_" } },
            { type: "APPROVERS_ASSIGNED" },
          ],
        },
      },
      {
        user: { ...activeUser, role: { in: ["ADMIN", "SUPERADMIN"] } },
        workflow: { paymentVerifierId: userId },
        event: {
          OR: [
            { type: { startsWith: "PAYMENT_" } },
            { type: { startsWith: "AGREEMENT_" } },
            { type: "APPROVERS_ASSIGNED" },
          ],
        },
      },
    ],
  }
}

export async function listWorkflowNotifications(userId: string) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const where = notificationScope(userId)
      const [notifications, unreadCount] = await Promise.all([
        tx.workflowNotification.findMany({
          where,
          select: {
            id: true,
            requestId: true,
            createdAt: true,
            readAt: true,
            event: { select: { summary: true, type: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 40,
        }),
        tx.workflowNotification.count({ where: { ...where, readAt: null } }),
      ])
      return {
        notifications: notifications.map(({ event, ...record }) => ({
          ...record,
          ...event,
        })),
        unreadCount,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function readWorkflowNotification(userId: string, id: string) {
  const result = await getPrisma()!.workflowNotification.updateMany({
    where: { ...notificationScope(userId), id },
    data: { readAt: new Date() },
  })
  if (!result.count) fail("Notification not found", 404)
  return { ok: true }
}

export async function listWorkflowApprovals(userId: string) {
  const rows = await getPrisma()!.requestWorkflow.findMany({
    where: {
      OR: [
        {
          quotationApproverId: userId,
          quotationApprover: {
            ...activeUser,
            role: { in: ["ADMIN", "SUPERADMIN"] },
          },
        },
        {
          paymentVerifierId: userId,
          paymentVerifier: {
            ...activeUser,
            role: { in: ["ADMIN", "SUPERADMIN"] },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      state: true,
      quotationApproverId: true,
      paymentVerifierId: true,
      quotations: {
        orderBy: { version: "desc" },
        take: 1,
        select: { status: true },
      },
      payment: { select: { status: true } },
      request: {
        select: {
          id: true,
          title: true,
          referenceNumber: true,
          service: { select: { name: true } },
        },
      },
    },
  })
  return {
    requests: rows.map((row) => ({
      id: row.request.id,
      title: row.request.title,
      referenceNumber: row.request.referenceNumber,
      serviceName: row.request.service.name,
      state: row.state,
      awaitingQuotation:
        row.quotationApproverId === userId &&
        row.state === "QUOTATION_PENDING" &&
        row.quotations[0]?.status === "PENDING_INTERNAL",
      awaitingPayment:
        row.paymentVerifierId === userId &&
        row.state === "AGREEMENT_PAYMENT_PENDING" &&
        row.payment?.status === "SUBMITTED",
    })),
  }
}
