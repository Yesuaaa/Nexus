import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

const internalRoles = ["STAFF", "ADMIN", "SUPERADMIN"] as const
type InternalRole = (typeof internalRoles)[number]

const messageSelect = {
  id: true,
  body: true,
  clientMessageId: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  purgeAt: true,
  sender: { select: { id: true, fullName: true } },
} as const satisfies Prisma.InternalMessageSelect

type InternalUser = {
  id: string
  fullName: string | null
  email: string
  role: string
  position: string | null
  department: { id: string; name: string } | null
  isActive: boolean
  accountDeletedAt: Date | null
}

function isInternalRole(role: string): role is InternalRole {
  return (internalRoles as readonly string[]).includes(role)
}

async function getInternalUser(userId: string) {
  const user = await getPrisma()!.user.findFirst({
    where: {
      id: userId,
      role: { in: [...internalRoles] },
      isActive: true,
      accountDeletedAt: null,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      position: true,
      isActive: true,
      accountDeletedAt: true,
      department: { select: { id: true, name: true } },
    },
  })
  if (!user || !isInternalRole(user.role))
    throw new ServiceRequestsError(
      403,
      "Only staff and administrators can use internal chat.",
    )
  return user
}

function participantKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(":")
}

function participantWhere(
  userId: string,
): Prisma.InternalConversationWhereInput {
  return {
    OR: [{ participantOneId: userId }, { participantTwoId: userId }],
  }
}

function otherParticipant(
  conversation: {
    participantOne: InternalUser
    participantTwo: InternalUser
  },
  userId: string,
) {
  return conversation.participantOne.id === userId
    ? conversation.participantTwo
    : conversation.participantOne
}

async function unreadCounts(userId: string) {
  const rows = await getPrisma()!.$queryRaw<
    { conversationId: string; unreadCount: number }[]
  >`
    SELECT message."conversationId" AS "conversationId",
      COUNT(message."id")::integer AS "unreadCount"
    FROM "InternalMessage" AS message
    INNER JOIN "InternalConversationParticipant" AS participant
      ON participant."conversationId" = message."conversationId"
      AND participant."userId" = ${userId}
    WHERE message."senderId" <> ${userId}
      AND (participant."readAt" IS NULL OR message."createdAt" > participant."readAt")
    GROUP BY message."conversationId"
  `
  return new Map(rows.map((row) => [row.conversationId, row.unreadCount]))
}

function totalUnread(counts: Map<string, number>) {
  return [...counts.values()].reduce((total, count) => total + count, 0)
}

const participantSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  position: true,
  isActive: true,
  accountDeletedAt: true,
  department: { select: { id: true, name: true } },
} as const

export async function listInternalContacts(userId: string) {
  await getInternalUser(userId)
  return getPrisma()!.user.findMany({
    where: {
      id: { not: userId },
      role: { in: [...internalRoles] },
      isActive: true,
      accountDeletedAt: null,
    },
    select: participantSelect,
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
  })
}

export async function createInternalConversation(
  userId: string,
  recipientId: string,
) {
  await getInternalUser(userId)
  if (recipientId === userId)
    throw new ServiceRequestsError(
      400,
      "You cannot start an internal chat with yourself.",
    )
  const recipient = await getPrisma()!.user.findFirst({
    where: {
      id: recipientId,
      role: { in: [...internalRoles] },
      isActive: true,
      accountDeletedAt: null,
    },
    select: participantSelect,
  })
  if (!recipient)
    throw new ServiceRequestsError(
      404,
      "That staff or administrator account is unavailable.",
    )
  const key = participantKey(userId, recipientId)
  const [firstId, secondId] = [userId, recipientId].sort()
  const conversation = await getPrisma()!.internalConversation.upsert({
    where: { participantKey: key },
    update: {},
    create: {
      participantKey: key,
      participantOneId: firstId!,
      participantTwoId: secondId!,
      participants: {
        create: [{ userId, readAt: new Date() }, { userId: recipientId }],
      },
    },
    select: { id: true },
  })
  const access = await getInternalConversationAccess(userId, conversation.id)
  return {
    ...conversation,
    ...access,
    messages: [],
    nextCursor: null,
  }
}

export async function listInternalConversations(
  userId: string,
  before?: string,
) {
  await getInternalUser(userId)
  const db = getPrisma()!
  const scope = participantWhere(userId)
  const boundary = before
    ? await db.internalConversation.findFirst({
        where: { ...scope, id: before },
        select: { updatedAt: true, id: true },
      })
    : null
  if (before && !boundary)
    throw new ServiceRequestsError(400, "Invalid internal conversation cursor")
  const rows = await db.internalConversation.findMany({
    where: {
      ...scope,
      ...(boundary
        ? {
            AND: [
              scope,
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
      updatedAt: true,
      participantOne: { select: participantSelect },
      participantTwo: { select: participantSelect },
      messages: {
        select: messageSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 31,
  })
  const counts = await unreadCounts(userId)
  const conversations = rows.slice(0, 30).map(({ messages, ...row }) => ({
    id: row.id,
    updatedAt: row.updatedAt,
    participant: otherParticipant(row, userId),
    lastMessage: messages[0] ?? null,
    unreadCount: counts.get(row.id) ?? 0,
  }))
  return {
    conversations,
    nextCursor: rows.length > 30 ? conversations.at(-1)!.id : null,
    unreadCount: totalUnread(counts),
  }
}

export async function getInternalConversationAccess(
  userId: string,
  conversationId: string,
) {
  await getInternalUser(userId)
  const record = await getPrisma()!.internalConversation.findFirst({
    where: { id: conversationId, ...participantWhere(userId) },
    select: {
      id: true,
      participantOne: { select: participantSelect },
      participantTwo: { select: participantSelect },
    },
  })
  if (!record)
    throw new ServiceRequestsError(404, "Internal conversation not found")
  const participant = otherParticipant(record, userId)
  return {
    conversation: participant,
    canSend: participant.isActive && participant.accountDeletedAt === null,
  }
}

export async function listInternalMessages(
  userId: string,
  conversationId: string,
  before?: string,
) {
  await getInternalConversationAccess(userId, conversationId)
  const db = getPrisma()!
  const boundary = before
    ? await db.internalMessage.findFirst({
        where: { id: before, conversationId },
        select: { createdAt: true, id: true },
      })
    : null
  if (before && !boundary)
    throw new ServiceRequestsError(400, "Invalid internal message cursor")
  const rows = await db.internalMessage.findMany({
    where: {
      conversationId,
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
}

export async function getInternalConversation(
  userId: string,
  conversationId: string,
  before?: string,
) {
  const [access, history] = await Promise.all([
    getInternalConversationAccess(userId, conversationId),
    listInternalMessages(userId, conversationId, before),
  ])
  return { ...access, ...history }
}

export async function markInternalConversationRead(
  userId: string,
  conversationId: string,
) {
  await getInternalConversationAccess(userId, conversationId)
  await getPrisma()!.internalConversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { readAt: new Date() },
  })
  const counts = await unreadCounts(userId)
  return {
    ok: true,
    unreadCount: totalUnread(counts),
    conversationUnreadCount: counts.get(conversationId) ?? 0,
  }
}

export async function sendInternalMessage(
  userId: string,
  conversationId: string,
  body: string,
  clientMessageId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const access = await tx.internalConversation.findFirst({
      where: { id: conversationId, ...participantWhere(userId) },
      select: {
        id: true,
        participantOne: {
          select: {
            id: true,
            isActive: true,
            accountDeletedAt: true,
            role: true,
          },
        },
        participantTwo: {
          select: {
            id: true,
            isActive: true,
            accountDeletedAt: true,
            role: true,
          },
        },
      },
    })
    if (!access)
      throw new ServiceRequestsError(404, "Internal conversation not found")
    const participant =
      access.participantOne.id === userId
        ? access.participantTwo
        : access.participantOne
    if (
      !participant.isActive ||
      participant.accountDeletedAt !== null ||
      !isInternalRole(participant.role)
    )
      throw new ServiceRequestsError(
        409,
        "Messaging is unavailable for this account.",
      )
    const existing = await tx.internalMessage.findUnique({
      where: {
        conversationId_senderId_clientMessageId: {
          conversationId,
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
    await tx.internalConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    return tx.internalMessage.create({
      data: { conversationId, senderId: userId, body, clientMessageId },
      select: messageSelect,
    })
  })
}
