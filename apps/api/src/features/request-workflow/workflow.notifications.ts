import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  activeAccount,
  activeDepartmentHead,
  activeStaff,
} from "../../shared/query/accounts.js"
import { fail } from "./workflow.validation.js"
import { submittedLeaveFallbackScope } from "../leave/leave.repository.js"

import { hrAdjustmentScope } from "../attendance/attendance.overtime.js"

const inboxViewerSelect = {
  settings: true,
  role: true,
  headOf: { select: { id: true } },
} satisfies Prisma.UserSelect

type InboxViewer = Prisma.UserGetPayload<{ select: typeof inboxViewerSelect }>

async function notificationScope(
  tx: Prisma.TransactionClient,
  userId: string,
  viewer?: InboxViewer,
): Promise<Prisma.WorkflowNotificationWhereInput> {
  const visibility: Prisma.WorkflowNotificationWhereInput[] = [
    {
      leaveRequest: {
        requestedById: userId,
        requestedBy: activeAccount,
      },
    },
    { attendanceAdjustment: { requestedById: userId }, user: activeAccount },
  ]

  // Only the inbox's Repeatable Read snapshot can rule out branches up front.
  // Read-state writes evaluate the full predicate at the UPDATE statement.
  if (!viewer || (viewer.role === activeStaff.role && viewer.headOf)) {
    const department = activeDepartmentHead(userId)
    visibility.push(
      {
        leaveRequest: { employee: { department } },
      },
      {
        attendanceAdjustment: { employee: { department } },
      },
      { workflow: { request: { acceptedDepartment: department } } },
    )
  }

  if (!viewer || viewer.role === "ADMIN") {
    const admin = { ...activeAccount, role: "ADMIN" } as const
    visibility.push(
      {
        leaveRequestId: { not: null },
        user: admin,
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
        attendanceAdjustmentId: { not: null },
        user: admin,
        attendanceAdjustment: await hrAdjustmentScope(tx),
      },
    )
  }

  if (!viewer || viewer.role === "SUPERADMIN") {
    const superadmin = { ...activeAccount, role: "SUPERADMIN" } as const
    visibility.push(
      { leaveRequestId: { not: null }, user: superadmin },
      { attendanceAdjustmentId: { not: null }, user: superadmin },
    )
  }

  if (!viewer || viewer.role === "USER") {
    visibility.push({
      workflow: {
        request: {
          clientId: userId,
          client: { ...activeAccount, role: "USER" },
        },
      },
      event: { internal: false },
    })
  }

  if (!viewer || viewer.role === "ADMIN" || viewer.role === "SUPERADMIN") {
    const approver = {
      ...activeAccount,
      role: { in: ["ADMIN", "SUPERADMIN"] },
    } satisfies Prisma.UserWhereInput
    visibility.push(
      {
        user: approver,
        workflow: { quotationApproverId: userId },
        event: {
          OR: [
            { type: { startsWith: "QUOTATION_" } },
            { type: "APPROVERS_ASSIGNED" },
          ],
        },
      },
      {
        user: approver,
        workflow: { paymentVerifierId: userId },
        event: {
          OR: [
            { type: { startsWith: "PAYMENT_" } },
            { type: { startsWith: "AGREEMENT_" } },
            { type: "APPROVERS_ASSIGNED" },
          ],
        },
      },
    )
  }

  return { userId, OR: visibility }
}

export async function listWorkflowNotifications(userId: string) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const viewer = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: inboxViewerSelect,
      })
      const settings = viewer.settings
      if (
        settings &&
        typeof settings === "object" &&
        !Array.isArray(settings) &&
        settings.workflowNotifications === false
      )
        return { notifications: [], unreadCount: 0 }
      const where = await notificationScope(tx, userId, viewer)
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
  const result = await getPrisma()!.$transaction(async (tx) =>
    tx.workflowNotification.updateMany({
      where: { ...(await notificationScope(tx, userId)), id },
      data: { readAt: new Date() },
    }),
  )
  if (!result.count) fail("Notification not found", 404)
  return { ok: true }
}

export async function readAllWorkflowNotifications(userId: string) {
  await getPrisma()!.$transaction(async (tx) =>
    tx.workflowNotification.updateMany({
      where: { ...(await notificationScope(tx, userId)), readAt: null },
      data: { readAt: new Date() },
    }),
  )
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
