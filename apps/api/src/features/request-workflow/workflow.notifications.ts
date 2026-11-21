import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  activeAccount,
  activeDepartmentHead,
} from "../../shared/query/accounts.js"
import { fail } from "./workflow.validation.js"
import { submittedLeaveFallbackScope } from "../leave/leave.repository.js"

import { hrAdjustmentScope } from "../attendance/attendance.overtime.js"

async function notificationScope(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.WorkflowNotificationWhereInput> {
  return {
    userId,
    OR: [
      {
        leaveRequest: {
          requestedById: userId,
          requestedBy: activeAccount,
        },
      },
      {
        leaveRequest: {
          employee: { department: activeDepartmentHead(userId) },
        },
      },
      {
        leaveRequestId: { not: null },
        user: { ...activeAccount, role: "ADMIN" },
        OR: [
          {
            type: "LEAVE_SUBMITTED",
            leaveRequest: await submittedLeaveFallbackScope(tx, userId),
          },
          {
            type: { not: "LEAVE_SUBMITTED" },
            leaveRequest: { status: { not: "SUBMITTED" } },
          },
        ],
      },
      {
        leaveRequestId: { not: null },
        user: { ...activeAccount, role: "SUPERADMIN" },
      },
      {attendanceAdjustment:{requestedById:userId},user:activeAccount},
      {
        attendanceAdjustment: {
          employee: { department: activeDepartmentHead(userId) },
        },
      },
      {
        attendanceAdjustmentId: { not: null },
        user: { ...activeAccount, role: "ADMIN" },
        attendanceAdjustment: await hrAdjustmentScope(tx),
      },
      {
        attendanceAdjustmentId: { not: null },
        user: { ...activeAccount, role: "SUPERADMIN" },
      },
      {
        workflow: {
          request: {
            clientId: userId,
            client: { ...activeAccount, role: "USER" },
          },
        },
        event: { internal: false },
      },
      {
        workflow: {
          request: {
            acceptedDepartment: activeDepartmentHead(userId),
          },
        },
      },
      {
        user: { ...activeAccount, role: { in: ["ADMIN", "SUPERADMIN"] } },
        workflow: { quotationApproverId: userId },
        event: {
          OR: [
            { type: { startsWith: "QUOTATION_" } },
            { type: "APPROVERS_ASSIGNED" },
          ],
        },
      },
      {
        user: { ...activeAccount, role: { in: ["ADMIN", "SUPERADMIN"] } },
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
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { settings: true },
      })
      const settings = user.settings
      if (
        settings &&
        typeof settings === "object" &&
        !Array.isArray(settings) &&
        settings.workflowNotifications === false
      )
        return { notifications: [], unreadCount: 0 }
      const where = await notificationScope(tx,userId)
      const [notifications, unreadCount] = await Promise.all([
        tx.workflowNotification.findMany({
          where,
          select: {
            id: true,
            requestId: true,
            createdAt: true,
            readAt: true,
            attendanceAdjustmentId: true,
            leaveRequestId: true,
            summary: true,
            type: true,
            event: { select: { summary: true, type: true, entityId: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 40,
        }),
        tx.workflowNotification.count({ where: { ...where, readAt: null } }),
      ])
      return {
        notifications: notifications.map(({ event, ...record }) => ({
          ...record,
          summary: event?.summary ?? record.summary!,
          type: event?.type ?? record.type!,
          entityId:
            event?.entityId ??
            record.attendanceAdjustmentId ??
            record.leaveRequestId,
        })),
        unreadCount,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function readWorkflowNotification(userId: string, id: string) {
  const result = await getPrisma()!.$transaction(async tx=>tx.workflowNotification.updateMany({
    where: { ...await notificationScope(tx,userId), id },
    data: { readAt: new Date() },
  }))
  if (!result.count) fail("Notification not found", 404)
  return { ok: true }
}

export async function readAllWorkflowNotifications(userId: string) {
  await getPrisma()!.$transaction(async tx=>tx.workflowNotification.updateMany({
    where: { ...await notificationScope(tx,userId), readAt: null },
    data: { readAt: new Date() },
  }))
  return { ok: true }
}

export async function listWorkflowApprovals(userId: string) {
  const rows = await getPrisma()!.requestWorkflow.findMany({
    where: {
      OR: [
        {
          quotationApproverId: userId,
          quotationApprover: {
            ...activeAccount,
            role: { in: ["ADMIN", "SUPERADMIN"] },
          },
        },
        {
          paymentVerifierId: userId,
          paymentVerifier: {
            ...activeAccount,
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
