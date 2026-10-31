import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

const activeUser = { isActive: true, accountDeletedAt: null } as const

function participantScope(userId: string): Prisma.ServiceRequestWhereInput {
  return {
    OR: [
      { clientId: userId, client: { ...activeUser, role: "USER" } },
      {
        acceptedDepartment: {
          headId: userId,
          head: { ...activeUser, role: "STAFF" },
        },
      },
    ],
  }
}

const conversationSelect = {
  id: true,
  status: true,
  acceptedAt: true,
  acceptedDepartmentId: true,
  client: {
    select: {
      id: true,
      fullName: true,
      email: true,
      contactNumber: true,
    },
  },
  acceptedDepartment: {
    select: {
      id: true,
      name: true,
      headId: true,
      head: {
        select: {
          id: true,
          fullName: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      },
    },
  },
} as const satisfies Prisma.ServiceRequestSelect

const messageSelect = {
  id: true,
  body: true,
  clientMessageId: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  purgeAt: true,
  sender: { select: { id: true, fullName: true } },
} as const satisfies Prisma.ServiceRequestMessageSelect

const MESSAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

async function lockWritableConversation(
  tx: Prisma.TransactionClient,
  userId: string,
  requestId: string,
) {
  const writable = await tx.serviceRequest.updateMany({
    where: {
      id: requestId,
      ...participantScope(userId),
      acceptedAt: { not: null },
      status: { notIn: ["CLOSED", "CANCELLED"] },
      acceptedDepartment: { head: { ...activeUser, role: "STAFF" } },
    },
    data: { updatedAt: new Date() },
  })
  if (writable.count) return
  const visible = await tx.serviceRequest.count({
    where: { id: requestId, ...participantScope(userId) },
  })
  throw new ServiceRequestsError(
    visible ? 409 : 404,
    visible
      ? "Messaging is unavailable until this request is accepted by an active department head, or after it is closed."
      : "Conversation not found",
  )
}

type UnreadConversationRow = {
  requestId: string
  unreadCount: number
}

async function getUnreadConversationCounts(
  userId: string,
  role: "USER" | "STAFF",
) {
  const rows =
    role === "USER"
      ? await getPrisma()!.$queryRaw<UnreadConversationRow[]>`
          SELECT service_request."id" AS "requestId",
            COUNT(message."id")::integer AS "unreadCount"
          FROM "ServiceRequest" AS service_request
          INNER JOIN "ServiceRequestMessage" AS message
            ON message."requestId" = service_request."id"
            AND message."senderId" <> ${userId}
            AND (
              service_request."clientReadAt" IS NULL
              OR message."createdAt" > service_request."clientReadAt"
            )
          WHERE service_request."clientId" = ${userId}
            AND service_request."acceptedAt" IS NOT NULL
            AND service_request."acceptedDepartmentId" IS NOT NULL
          GROUP BY service_request."id"
        `
      : await getPrisma()!.$queryRaw<UnreadConversationRow[]>`
          SELECT service_request."id" AS "requestId",
            COUNT(message."id")::integer AS "unreadCount"
          FROM "ServiceRequest" AS service_request
          INNER JOIN "Department" AS department
            ON department."id" = service_request."acceptedDepartmentId"
            AND department."headId" = ${userId}
          INNER JOIN "ServiceRequestMessage" AS message
            ON message."requestId" = service_request."id"
            AND message."senderId" <> ${userId}
            AND (
              service_request."staffReadAt" IS NULL
              OR message."createdAt" > service_request."staffReadAt"
            )
          WHERE service_request."acceptedAt" IS NOT NULL
            AND service_request."acceptedDepartmentId" IS NOT NULL
          GROUP BY service_request."id"
        `
  return new Map(rows.map((row) => [row.requestId, row.unreadCount]))
}

function totalUnreadMessages(unreadCounts: Map<string, number>) {
  return [...unreadCounts.values()].reduce((total, count) => total + count, 0)
}

export async function listConversations(userId: string, before?: string) {
  const db = getPrisma()!
  const scope: Prisma.ServiceRequestWhereInput = {
    ...participantScope(userId),
    acceptedAt: { not: null },
    acceptedDepartmentId: { not: null },
  }
  const boundary = before
    ? await db.serviceRequest.findFirst({
        where: { ...scope, id: before },
        select: { updatedAt: true, id: true },
      })
    : null
  if (before && !boundary)
    throw new ServiceRequestsError(400, "Invalid conversation cursor")
  const rows = await db.serviceRequest.findMany({
    where: {
      ...scope,
      ...(boundary
        ? {
            AND: [
              {
                OR: [
                  { updatedAt: { lt: boundary.updatedAt } },
                  { updatedAt: boundary.updatedAt, id: { lt: boundary.id } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      referenceNumber: true,
      updatedAt: true,
      service: { select: { name: true } },
      client: { select: { id: true, fullName: true } },
      acceptedDepartment: {
        select: { id: true, name: true, headId: true },
      },
      messages: {
        select: messageSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 31,
  })
  const participantRole = rows.some((row) => row.client.id === userId)
    ? "USER"
    : rows.some((row) => row.acceptedDepartment?.headId === userId)
      ? "STAFF"
      : null
  const unreadCounts = participantRole
    ? await getUnreadConversationCounts(userId, participantRole)
    : new Map<string, number>()
  const conversations = rows.slice(0, 30).map(({ messages, ...row }) => {
    const unreadCount = unreadCounts.get(row.id) ?? 0
    return {
      ...row,
      lastMessage: messages[0] ?? null,
      ...(participantRole ? { unreadCount } : {}),
    }
  })
  const unreadCount = totalUnreadMessages(unreadCounts)
  return {
    conversations,
    nextCursor: rows.length > 30 ? conversations.at(-1)!.id : null,
    ...(participantRole ? { unreadCount } : {}),
  }
}

export async function markConversationRead(
  userId: string,
  requestId: string,
  role: "USER" | "STAFF",
) {
  const now = new Date()
  const updated = await getPrisma()!.serviceRequest.updateMany({
    where:
      role === "USER"
        ? {
            id: requestId,
            clientId: userId,
            client: { ...activeUser, role: "USER" },
            acceptedAt: { not: null },
            acceptedDepartmentId: { not: null },
          }
        : {
            id: requestId,
            acceptedAt: { not: null },
            acceptedDepartment: {
              headId: userId,
              head: { ...activeUser, role: "STAFF" },
            },
          },
    data: role === "USER" ? { clientReadAt: now } : { staffReadAt: now },
  })
  if (!updated.count)
    throw new ServiceRequestsError(404, "Conversation not found")
  const unreadCounts = await getUnreadConversationCounts(userId, role)
  return {
    ok: true,
    unreadCount: totalUnreadMessages(unreadCounts),
    conversationUnreadCount: unreadCounts.get(requestId) ?? 0,
  }
}

export async function getConversationAccess(userId: string, requestId: string) {
  const record = await getPrisma()!.serviceRequest.findFirst({
    where: { id: requestId, ...participantScope(userId) },
    select: conversationSelect,
  })
  if (!record) throw new ServiceRequestsError(404, "Conversation not found")
  const department = record.acceptedDepartment
  const head = department?.head
  const activeHead =
    head?.role === "STAFF" && head.isActive && !head.accountDeletedAt
  return {
    conversation:
      department && record.acceptedAt
        ? {
            department: { id: department.id, name: department.name },
            head: activeHead ? { id: head.id, fullName: head.fullName } : null,
            ...(userId === record.client.id
              ? {}
              : {
                  client: {
                    id: record.client.id,
                    fullName: record.client.fullName,
                    email: record.client.email,
                    contactNumber: record.client.contactNumber,
                  },
                }),
          }
        : null,
    canSend: Boolean(
      department &&
      record.acceptedAt &&
      activeHead &&
      record.status !== "CLOSED" &&
      record.status !== "CANCELLED",
    ),
  }
}

export async function listConversationMessages(
  userId: string,
  requestId: string,
  before?: string,
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      // Authorization and history share one snapshot, including department handoffs.
      const request = await tx.serviceRequest.findFirst({
        where: { id: requestId, ...participantScope(userId) },
        select: { id: true },
      })
      if (!request)
        throw new ServiceRequestsError(404, "Conversation not found")
      let boundary: { createdAt: Date; id: string } | null = null
      if (before) {
        boundary = await tx.serviceRequestMessage.findFirst({
          where: { id: before, requestId },
          select: { createdAt: true, id: true },
        })
        if (!boundary)
          throw new ServiceRequestsError(400, "Invalid message cursor")
      }
      const rows = await tx.serviceRequestMessage.findMany({
        where: {
          requestId,
          ...(boundary
            ? {
                OR: [
                  { createdAt: { lt: boundary.createdAt } },
                  { createdAt: boundary.createdAt, id: { lt: boundary.id } },
                ],
              }
            : {}),
        },
        select: messageSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      })
      const hasMore = rows.length > 50
      const messages = rows.slice(0, 50).reverse()
      return { messages, nextCursor: hasMore ? messages[0]!.id : null }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function sendConversationMessage(
  userId: string,
  requestId: string,
  body: string,
  clientMessageId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    // This conditional write rechecks the participants and locks the request.
    // Retries with the same client ID serialize and return the original message.
    await lockWritableConversation(tx, userId, requestId)
    const existing = await tx.serviceRequestMessage.findUnique({
      where: {
        requestId_senderId_clientMessageId: {
          requestId,
          senderId: userId,
          clientMessageId,
        },
      },
      select: messageSelect,
    })
    if (existing) {
      if (existing.body !== body)
        throw new ServiceRequestsError(
          409,
          "This message was already sent with different text. Refresh the conversation.",
        )
      return existing
    }
    return tx.serviceRequestMessage.create({
      data: { requestId, senderId: userId, body, clientMessageId },
      select: messageSelect,
    })
  })
}

export async function editConversationMessage(
  userId: string,
  requestId: string,
  messageId: string,
  body: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await lockWritableConversation(tx, userId, requestId)
    const existing = await tx.serviceRequestMessage.findFirst({
      where: { id: messageId, requestId, senderId: userId },
      select: { id: true, deletedAt: true },
    })
    if (!existing) throw new ServiceRequestsError(404, "Message not found")
    if (existing.deletedAt)
      throw new ServiceRequestsError(
        409,
        "This message was deleted and can no longer be edited.",
      )
    return tx.serviceRequestMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      select: messageSelect,
    })
  })
}

export async function deleteConversationMessage(
  userId: string,
  requestId: string,
  messageId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await lockWritableConversation(tx, userId, requestId)
    const existing = await tx.serviceRequestMessage.findFirst({
      where: { id: messageId, requestId, senderId: userId },
      select: { id: true, deletedAt: true },
    })
    if (!existing) throw new ServiceRequestsError(404, "Message not found")
    if (existing.deletedAt)
      throw new ServiceRequestsError(409, "This message was already deleted.")
    const deletedAt = new Date()
    return tx.serviceRequestMessage.update({
      where: { id: messageId },
      data: {
        body: null,
        deletedAt,
        purgeAt: new Date(deletedAt.getTime() + MESSAGE_RETENTION_MS),
      },
      select: messageSelect,
    })
  })
}

export async function purgeExpiredConversationMessages(now = new Date()) {
  const result = await getPrisma()!.serviceRequestMessage.deleteMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: now } },
  })
  return result.count
}
