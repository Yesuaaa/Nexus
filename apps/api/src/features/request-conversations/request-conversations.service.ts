import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { readDatabase, readTransaction } from "../../lib/database-read.js"
import {
  activeAccount,
  activeDepartmentHead,
  activeStaff,
} from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { userImageUrl } from "../services/service-image-storage.js"
import {
  parseMeeting,
  parseMeetingAction,
} from "./conversation-meetings.validation.js"
import { lockRows } from "../../shared/db/locks.js"

const archivedStatuses = ["CLOSED", "CANCELLED"] as const
const MESSAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export type ConversationView = "active" | "archived"

function participantScope(
  userId: string,
): Prisma.RequestConversationWhereInput {
  return {
    OR: [
      { clientId: userId, client: { ...activeAccount, role: "USER" } },
      {
        department: activeDepartmentHead(userId),
      },
    ],
  }
}

function lifecycleScope(
  userId: string,
  view?: ConversationView,
): Prisma.RequestConversationWhereInput {
  const deletionFilter: Prisma.RequestConversationWhereInput = {
    deletions: { none: { userId } },
  }
  if (view === "active") {
    return {
      AND: [
        deletionFilter,
        { bookings: { some: { status: { notIn: [...archivedStatuses] } } } },
      ],
    }
  }
  if (view === "archived") {
    return {
      AND: [
        deletionFilter,
        {
          bookings: {
            some: {},
            every: { status: { in: [...archivedStatuses] } },
          },
        },
      ],
    }
  }
  return deletionFilter
}

function visibleScope(
  userId: string,
  view?: ConversationView,
): Prisma.RequestConversationWhereInput {
  return {
    AND: [participantScope(userId), lifecycleScope(userId, view)],
  }
}

const headSelect = {
  id: true,
  fullName: true,
  role: true,
  isActive: true,
  accountDeletedAt: true,
  profileImagePath: true,
  employee: { select: { id: true, profileImageUrl: true } },
} as const satisfies Prisma.UserSelect

const clientSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  profileImagePath: true,
} as const satisfies Prisma.UserSelect

const bookingSelect = {
  id: true,
  title: true,
  referenceNumber: true,
  status: true,
  packageName: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { name: true } },
  workflow: { select: { state: true, previousState: true } },
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
  request: {
    select: {
      id: true,
      title: true,
      referenceNumber: true,
      service: { select: { name: true } },
    },
  },
} as const satisfies Prisma.ServiceRequestMessageSelect

function serializeMessage<
  T extends {
    request: {
      id: string
      title: string
      referenceNumber: string | null
      service: { name: string }
    } | null
  },
>({ request, ...message }: T) {
  return {
    ...message,
    booking: request
      ? {
          id: request.id,
          title: request.title,
          referenceNumber: request.referenceNumber,
          serviceName: request.service.name,
        }
      : null,
  }
}

type BookingRow = {
  id: string
  title: string
  referenceNumber: string | null
  status: string
  packageName: string | null
  createdAt: Date
  updatedAt: Date
  service: { name: string }
  workflow: { state: string; previousState: string | null } | null
}

function serializeBooking(booking: BookingRow) {
  return {
    id: booking.id,
    title: booking.title,
    referenceNumber: booking.referenceNumber,
    status: booking.status,
    packageName: booking.packageName,
    serviceName: booking.service.name,
    workflowState: booking.workflow?.state ?? "PENDING_REVIEW",
    previousWorkflowState: booking.workflow?.previousState ?? null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }
}

type ConversationDb =
  Prisma.TransactionClient | NonNullable<ReturnType<typeof getPrisma>>

async function resolveConversation(
  db: ConversationDb,
  userId: string,
  id: string,
) {
  const conversation = await db.requestConversation.findFirst({
    where: {
      ...visibleScope(userId),
      OR: [{ id }, { bookings: { some: { id } } }],
    },
    select: {
      id: true,
      clientId: true,
      departmentId: true,
      clientReadAt: true,
      managerReadAt: true,
      department: { select: { headId: true } },
      bookings: { select: { id: true, status: true } },
    },
  })
  if (!conversation)
    throw new ServiceRequestsError(404, "Conversation not found")
  return conversation
}

function isArchived(bookings: readonly { status: string }[]) {
  return (
    bookings.length > 0 &&
    !bookings.some(
      (booking) =>
        !archivedStatuses.includes(
          booking.status as (typeof archivedStatuses)[number],
        ),
    )
  )
}

async function unreadCount(
  conversationId: string,
  userId: string,
  readAt: Date | null,
) {
  return getPrisma()!.serviceRequestMessage.count({
    where: {
      conversationId,
      senderId: { not: userId },
      ...(readAt ? { createdAt: { gt: readAt } } : {}),
    },
  })
}

async function totalActiveUnread(userId: string) {
  const rows = await getPrisma()!.requestConversation.findMany({
    where: { ...visibleScope(userId, "active") },
    select: {
      id: true,
      clientId: true,
      clientReadAt: true,
      managerReadAt: true,
    },
  })
  const counts = await Promise.all(
    rows.map((row) =>
      unreadCount(
        row.id,
        userId,
        row.clientId === userId ? row.clientReadAt : row.managerReadAt,
      ),
    ),
  )
  return counts.reduce((total, count) => total + count, 0)
}

export async function listConversations(
  userId: string,
  before?: string,
  view: ConversationView = "active",
) {
  const db = getPrisma()!
  const scope = visibleScope(userId, view)
  const boundary = before
    ? await db.requestConversation.findFirst({
        where: { ...scope, id: before },
        select: { updatedAt: true, id: true },
      })
    : null
  if (before && !boundary)
    throw new ServiceRequestsError(400, "Invalid conversation cursor")
  const rows = await db.requestConversation.findMany({
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
      clientId: true,
      clientReadAt: true,
      managerReadAt: true,
      updatedAt: true,
      client: { select: clientSelect },
      department: {
        select: {
          id: true,
          name: true,
          headId: true,
          head: { select: headSelect },
        },
      },
      bookings: {
        select: bookingSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  const conversations = await Promise.all(
    rows.slice(0, 30).map(async ({ messages, ...row }) => ({
      id: row.id,
      status: isArchived(row.bookings) ? "ARCHIVED" : "ACTIVE",
      title:
        row.bookings.length === 1
          ? row.bookings[0]!.title
          : `${row.bookings.length} booked services`,
      referenceNumber:
        row.bookings.length === 1 ? row.bookings[0]!.referenceNumber : null,
      service: { name: row.bookings[0]?.service.name ?? "Booked services" },
      updatedAt: row.updatedAt,
      client: {
        id: row.client.id,
        fullName: row.client.fullName,
        imageUrl: userImageUrl(row.client),
      },
      acceptedDepartment: {
        id: row.department.id,
        name: row.department.name,
        headId: row.department.headId,
        head: row.department.head
          ? {
              id: row.department.head.id,
              fullName: row.department.head.fullName,
              imageUrl: userImageUrl(row.department.head),
            }
          : null,
      },
      bookings: row.bookings.map(serializeBooking),
      lastMessage: messages[0] ? serializeMessage(messages[0]) : null,
      unreadCount: await unreadCount(
        row.id,
        userId,
        row.clientId === userId ? row.clientReadAt : row.managerReadAt,
      ),
    })),
  )
  return {
    conversations,
    nextCursor: rows.length > 30 ? conversations.at(-1)!.id : null,
    unreadCount: await totalActiveUnread(userId),
  }
}

export async function markConversationRead(
  userId: string,
  id: string,
  role: "USER" | "STAFF",
) {
  const conversation = await resolveConversation(getPrisma()!, userId, id)
  const now = new Date()
  await getPrisma()!.requestConversation.update({
    where: { id: conversation.id },
    data: role === "USER" ? { clientReadAt: now } : { managerReadAt: now },
  })
  return {
    ok: true,
    unreadCount: await totalActiveUnread(userId),
    conversationUnreadCount: 0,
    conversationId: conversation.id,
  }
}

// Stream checks only need membership, not the full booking list and profiles.
export function getConversationStreamAccess(userId: string, id: string) {
  return readDatabase(async () => {
    const conversation = await getPrisma()!.requestConversation.findFirst({
      where: {
        ...visibleScope(userId),
        OR: [{ id }, { bookings: { some: { id } } }],
      },
      select: { id: true },
    })
    if (!conversation)
      throw new ServiceRequestsError(404, "Conversation not found")
    return conversation
  })
}

export async function getConversationAccess(
  userId: string,
  id: string,
  requestedBookingId?: string,
) {
  const resolved = await resolveConversation(getPrisma()!, userId, id)
  const record = await getPrisma()!.requestConversation.findUniqueOrThrow({
    where: { id: resolved.id },
    select: {
      id: true,
      client: { select: clientSelect },
      department: {
        select: {
          id: true,
          name: true,
          headId: true,
          head: { select: headSelect },
        },
      },
      bookings: {
        select: bookingSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  })
  const head = record.department.head
  const activeHead =
    head?.role === "STAFF" && head.isActive && !head.accountDeletedAt
  const archived = isArchived(record.bookings)
  const aliasBooking = record.bookings.find((booking) => booking.id === id)?.id
  const selectedBookingId =
    record.bookings.find((booking) => booking.id === requestedBookingId)?.id ??
    aliasBooking ??
    record.bookings.find(
      (booking) =>
        !archivedStatuses.includes(
          booking.status as (typeof archivedStatuses)[number],
        ),
    )?.id ??
    record.bookings[0]?.id ??
    null
  return {
    archived,
    selectedBookingId,
    conversation: {
      id: record.id,
      status: archived ? "ARCHIVED" : "ACTIVE",
      department: { id: record.department.id, name: record.department.name },
      head: activeHead
        ? {
            id: head.id,
            fullName: head.fullName,
            specialistId: head.employee?.id || null,
            imageUrl: userImageUrl(head),
          }
        : null,
      bookings: record.bookings.map(serializeBooking),
      bookingCount: record.bookings.length,
      ...(userId === record.client.id
        ? {}
        : {
            client: {
              id: record.client.id,
              fullName: record.client.fullName,
              email: record.client.email,
              contactNumber: record.client.contactNumber,
              imageUrl: userImageUrl(record.client),
            },
          }),
    },
    canSend: Boolean(activeHead) && !archived,
  }
}

export async function listConversationMessages(
  userId: string,
  id: string,
  before?: string,
) {
  return readTransaction(async (tx) => {
    const conversation = await resolveConversation(tx, userId, id)
    const boundary = before
      ? await tx.serviceRequestMessage.findFirst({
          where: { id: before, conversationId: conversation.id },
          select: { createdAt: true, id: true },
        })
      : null
    if (before && !boundary)
      throw new ServiceRequestsError(400, "Invalid message cursor")
    const rows = await tx.serviceRequestMessage.findMany({
      where: {
        conversationId: conversation.id,
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
    const messages = rows.slice(0, 50).reverse().map(serializeMessage)
    const meetings = await tx.conversationMeeting.findMany({
      where: { conversationId: conversation.id },
      include: meetingInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })
    return {
      messages,
      meetings,
      nextCursor: rows.length > 50 ? messages[0]!.id : null,
    }
  })
}

async function lockWritableConversation(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
) {
  const conversation = await resolveConversation(tx, userId, id)
  await lockRows(tx, "RequestConversation", conversation.id)
  const writable = await tx.requestConversation.findFirst({
    where: {
      id: conversation.id,
      ...participantScope(userId),
      department: { head: activeStaff },
    },
    select: {
      id: true,
      bookings: { select: { status: true } },
    },
  })
  if (!writable)
    throw new ServiceRequestsError(
      409,
      "Messaging is unavailable without an active department manager.",
    )
  if (isArchived(writable.bookings))
    throw new ServiceRequestsError(
      409,
      "This conversation is archived and read-only.",
    )
  return conversation.id
}

const meetingInclude = {
  bookings: {
    select: {
      booking: {
        select: {
          id: true,
          referenceNumber: true,
          service: { select: { name: true } },
        },
      },
    },
    orderBy: { bookingId: "asc" },
  },
} as const satisfies Prisma.ConversationMeetingInclude

export async function scheduleConversationMeeting(
  userId: string,
  id: string,
  input: unknown,
) {
  const { bookingIds, ...data } = parseMeeting(input)
  return getPrisma()!.$transaction(async (tx) => {
    const conversation = await resolveConversation(tx, userId, id)
    if (conversation.department.headId !== userId)
      throw new ServiceRequestsError(
        403,
        "Only the department head can schedule meetings",
      )
    if (
      bookingIds.some(
        (bookingId) =>
          !conversation.bookings.some(
            (booking) =>
              booking.id === bookingId &&
              !archivedStatuses.includes(
                booking.status as (typeof archivedStatuses)[number],
              ),
          ),
      )
    )
      throw new ServiceRequestsError(
        400,
        "Choose services from this conversation",
      )
    // Match workflow writes' booking-before-conversation lock order. This also
    // prevents a booking from being moved while its meeting link is created.
    for (const bookingId of bookingIds)
      await lockRows(tx, "ServiceRequest", bookingId)
    const conversationId = await lockWritableConversation(
      tx,
      userId,
      conversation.id,
    )
    const existing = await tx.conversationMeeting.findUnique({
      where: {
        conversationId_clientActionId: {
          conversationId,
          clientActionId: data.clientActionId,
        },
      },
      include: meetingInclude,
    })
    if (existing) {
      // An invitation retry must never create a second meeting or change its scope.
      if (
        existing.notes !== data.notes ||
        existing.location !== data.location ||
        existing.startsAt.getTime() !== data.startsAt.getTime() ||
        existing.endsAt.getTime() !== data.endsAt.getTime() ||
        JSON.stringify(existing.bookings.map((link) => link.booking.id)) !==
          JSON.stringify(bookingIds)
      )
        throw new ServiceRequestsError(
          409,
          "This invitation ID has already been used",
        )
      return existing
    }
    const meeting = await tx.conversationMeeting.create({
      data: {
        ...data,
        conversationId,
        bookings: { create: bookingIds.map((bookingId) => ({ bookingId })) },
      },
      include: meetingInclude,
    })
    await tx.requestConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    return meeting
  })
}

export async function updateConversationMeeting(
  userId: string,
  id: string,
  meetingId: string,
  input: unknown,
) {
  const command = parseMeetingAction(input)
  return getPrisma()!.$transaction(async (tx) => {
    const conversationId = await lockWritableConversation(tx, userId, id)
    const conversation = await resolveConversation(tx, userId, conversationId)
    const meeting = await tx.conversationMeeting.findFirst({
      where: { id: meetingId, conversationId },
      include: meetingInclude,
    })
    if (!meeting) throw new ServiceRequestsError(404, "Meeting not found")
    if (
      meeting.status !== "SCHEDULED" ||
      meeting.version !== command.expectedVersion
    )
      throw new ServiceRequestsError(
        409,
        "This meeting has changed. Refresh and try again.",
      )
    const isHead = conversation.department.headId === userId
    if (
      command.type === "REQUEST_RESCHEDULE"
        ? userId !== conversation.clientId
        : !isHead
    )
      throw new ServiceRequestsError(
        403,
        "You cannot perform this meeting action",
      )
    const changes: Prisma.ConversationMeetingUpdateInput = {
      version: { increment: 1 },
    }
    switch (command.type) {
      case "REQUEST_RESCHEDULE":
        if (meeting.proposedStartsAt)
          throw new ServiceRequestsError(
            409,
            "A reschedule request is already pending",
          )
        changes.proposedStartsAt = command.startsAt
        changes.rescheduleNote = command.note
        break
      case "RESCHEDULE":
        changes.startsAt = command.startsAt
        changes.endsAt = command.endsAt
        changes.location = command.location
        changes.proposedStartsAt = null
        changes.rescheduleNote = null
        break
      case "KEEP_SCHEDULE":
        if (!meeting.proposedStartsAt)
          throw new ServiceRequestsError(
            409,
            "No reschedule request is pending",
          )
        changes.proposedStartsAt = null
        changes.rescheduleNote = null
        break
      case "COMPLETE":
        if (meeting.startsAt > new Date())
          throw new ServiceRequestsError(
            409,
            "A future meeting cannot be marked complete",
          )
        changes.status = "COMPLETED"
        changes.proposedStartsAt = null
        changes.rescheduleNote = null
        break
      case "CANCEL":
        changes.status = "CANCELLED"
        changes.proposedStartsAt = null
        changes.rescheduleNote = null
        break
    }
    const updated = await tx.conversationMeeting.update({
      where: { id: meeting.id },
      data: changes,
      include: meetingInclude,
    })
    await tx.requestConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    return updated
  })
}

export async function deleteArchivedConversation(userId: string, id: string) {
  return getPrisma()!.$transaction(async (tx) => {
    const conversation = await resolveConversation(tx, userId, id)
    await lockRows(tx, "RequestConversation", conversation.id)
    if (!isArchived(conversation.bookings))
      throw new ServiceRequestsError(
        409,
        "Only conversations whose bookings are all closed or cancelled can be deleted.",
      )
    await tx.requestConversationDeletion.upsert({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId },
      },
      create: { conversationId: conversation.id, userId },
      update: {},
    })
    return { ok: true, conversationId: conversation.id }
  })
}

export async function sendConversationMessage(
  userId: string,
  id: string,
  body: string,
  clientMessageId: string,
  bookingId?: string | null,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const conversationId = await lockWritableConversation(tx, userId, id)
    if (bookingId) {
      const attached = await tx.serviceRequest.count({
        where: {
          id: bookingId,
          conversationId,
          status: { notIn: [...archivedStatuses] },
        },
      })
      if (!attached)
        throw new ServiceRequestsError(
          400,
          "Select a booking in this conversation",
        )
    }
    const existing = await tx.serviceRequestMessage.findUnique({
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
      if (
        existing.body !== body ||
        (existing.request?.id ?? null) !== (bookingId ?? null)
      )
        throw new ServiceRequestsError(
          409,
          "This message was already sent with different content. Refresh the conversation.",
        )
      return serializeMessage(existing)
    }
    const message = await tx.serviceRequestMessage.create({
      data: {
        conversationId,
        requestId: bookingId ?? null,
        senderId: userId,
        body,
        clientMessageId,
      },
      select: messageSelect,
    })
    await tx.requestConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    return serializeMessage(message)
  })
}

export async function editConversationMessage(
  userId: string,
  id: string,
  messageId: string,
  body: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const conversationId = await lockWritableConversation(tx, userId, id)
    const existing = await tx.serviceRequestMessage.findFirst({
      where: { id: messageId, conversationId, senderId: userId },
      select: { id: true, body: true, deletedAt: true },
    })
    if (!existing) throw new ServiceRequestsError(404, "Message not found")
    if (existing.deletedAt)
      throw new ServiceRequestsError(409, "Deleted messages cannot be edited")
    const message = await tx.serviceRequestMessage.update({
      where: { id: existing.id },
      data: { body, editedAt: existing.body === body ? undefined : new Date() },
      select: messageSelect,
    })
    return serializeMessage(message)
  })
}

export async function deleteConversationMessage(
  userId: string,
  id: string,
  messageId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const conversationId = await lockWritableConversation(tx, userId, id)
    const existing = await tx.serviceRequestMessage.findFirst({
      where: { id: messageId, conversationId, senderId: userId },
      select: { id: true, deletedAt: true },
    })
    if (!existing) throw new ServiceRequestsError(404, "Message not found")
    if (existing.deletedAt) {
      const message = await tx.serviceRequestMessage.findUniqueOrThrow({
        where: { id: existing.id },
        select: messageSelect,
      })
      return serializeMessage(message)
    }
    const now = new Date()
    const message = await tx.serviceRequestMessage.update({
      where: { id: existing.id },
      data: {
        body: null,
        deletedAt: now,
        purgeAt: new Date(now.getTime() + MESSAGE_RETENTION_MS),
      },
      select: messageSelect,
    })
    return serializeMessage(message)
  })
}

export async function purgeExpiredConversationMessages(now = new Date()) {
  return getPrisma()!.serviceRequestMessage.deleteMany({
    where: { purgeAt: { lte: now } },
  })
}
