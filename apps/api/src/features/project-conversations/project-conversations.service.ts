import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeAccount, activeStaff } from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readDeliverableCard } from "./deliverable-messages.js"
import { lockRows } from "../../shared/db/locks.js"

const archivedStatuses = ["COMPLETED", "CANCELLED"] as const
const messageSelect = {
  id: true,
  body: true,
  clientMessageId: true,
  createdAt: true,
  deliverable: true,
  sender: { select: { id: true, fullName: true } },
} satisfies Prisma.ProjectMessageSelect
function messageDto(
  message: Prisma.ProjectMessageGetPayload<{ select: typeof messageSelect }>,
) {
  return {
    ...message,
    deliverable: readDeliverableCard(message.deliverable),
    editedAt: null,
    deletedAt: null,
    purgeAt: null,
  }
}

function visibleMessages(userId: string): Prisma.ProjectMessageWhereInput {
  return {
    OR: [{ clientVisible: true }, { project: { clientId: { not: userId } } }],
  }
}

// Current assignments determine membership, including for archived history.
function conversationScope(userId: string): Prisma.ProjectWhereInput {
  return {
    startDate: { not: null },
    OR: [
      { clientId: userId, client: { role: "USER", ...activeAccount } },
      {
        staff: {
          some: {
            employee: {
              userId,
              status: "ACTIVE",
              user: activeStaff,
            },
          },
        },
      },
    ],
  }
}

const conversationSelect = {
  id: true,
  name: true,
  status: true,
  description: true,
  startDate: true,
  workspaceGroupId: true,
  requestId: true,
  request: {
    select: {
      referenceNumber: true,
      service: { select: { name: true } },
      acceptedDepartment: { select: { headId: true } },
      workflow: { select: { state: true } },
    },
  },
  client: { select: { id: true, fullName: true } },
  staff: {
    where: {
      employee: {
        status: "ACTIVE",
        user: activeStaff,
      },
    },
    select: {
      employee: { select: { user: { select: { id: true, fullName: true } } } },
    },
  },
} satisfies Prisma.ProjectSelect

type ChatProject = Prisma.ProjectGetPayload<{
  select: typeof conversationSelect
}>

function summary(project: ChatProject) {
  const participants = [
    project.client,
    ...project.staff.flatMap(({ employee }) =>
      employee.user ? [employee.user] : [],
    ),
  ]
  return {
    id: project.id,
    name: project.name,
    archived: (archivedStatuses as readonly string[]).includes(project.status),
    isGroup: participants.length > 2,
    participants,
  }
}

async function access(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
) {
  const project = await tx.project.findFirst({
    where: { id: projectId, ...conversationScope(userId) },
    select: conversationSelect,
  })
  if (!project)
    throw new ServiceRequestsError(404, "Project conversation not found")
  return project
}

async function unreadCounts(tx: Prisma.TransactionClient, userId: string) {
  const projects = await tx.project.findMany({
    where: {
      AND: [
        conversationScope(userId),
        { status: { notIn: [...archivedStatuses] } },
      ],
    },
    select: {
      id: true,
      conversationReads: { where: { userId }, select: { readAt: true } },
    },
  })
  if (!projects.length) return new Map<string, number>()
  const counts = await tx.projectMessage.groupBy({
    by: ["projectId"],
    where: {
      senderId: { not: userId },
      AND: [visibleMessages(userId)],
      OR: projects.map((project) => ({
        projectId: project.id,
        ...(project.conversationReads[0]
          ? { createdAt: { gt: project.conversationReads[0].readAt } }
          : {}),
      })),
    },
    _count: { _all: true },
  })
  return new Map(counts.map((row) => [row.projectId, row._count._all]))
}

export async function listProjectConversations(
  userId: string,
  archived: boolean,
  before?: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const scope: Prisma.ProjectWhereInput = {
      AND: [
        conversationScope(userId),
        {
          status: archived
            ? { in: [...archivedStatuses] }
            : { notIn: [...archivedStatuses] },
        },
      ],
    }
    const boundary = before
      ? await tx.project.findFirst({
          where: { AND: [scope, { id: before }] },
          select: { id: true, updatedAt: true },
        })
      : null
    if (before && !boundary)
      throw new ServiceRequestsError(400, "Invalid project conversation cursor")
    const projects = await tx.project.findMany({
      where: {
        AND: [
          scope,
          ...(boundary
            ? [
                {
                  OR: [
                    { updatedAt: { lt: boundary.updatedAt } },
                    { updatedAt: boundary.updatedAt, id: { lt: boundary.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        ...conversationSelect,
        updatedAt: true,
        messages: {
          where: visibleMessages(userId),
          select: messageSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 31,
    })
    const counts = await unreadCounts(tx, userId)
    return {
      conversations: projects.slice(0, 30).map((project) => ({
        ...summary(project),
        updatedAt: project.updatedAt,
        lastMessage: project.messages[0]
          ? messageDto(project.messages[0])
          : null,
        unreadCount: counts.get(project.id) ?? 0,
      })),
      nextCursor: projects.length > 30 ? projects[29].id : null,
      unreadCount: [...counts.values()].reduce(
        (total, count) => total + count,
        0,
      ),
    }
  })
}

export async function getProjectConversation(
  userId: string,
  projectId: string,
  before?: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const project = await access(tx, userId, projectId)
    const chat = summary(project)
    const boundary = before
      ? await tx.projectMessage.findFirst({
          where: { id: before, projectId, AND: [visibleMessages(userId)] },
          select: { id: true, createdAt: true },
        })
      : null
    if (before && !boundary)
      throw new ServiceRequestsError(400, "Invalid project message cursor")
    const rows = await tx.projectMessage.findMany({
      where: {
        projectId,
        AND: [visibleMessages(userId)],
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
    const messages = rows.slice(0, 50).reverse()
    const isClient = project.client.id === userId
    const canSubmitDeliverables =
      !isClient &&
      !chat.archived &&
      ["IN_PROGRESS", "ON_HOLD"].includes(project.status) &&
      Boolean(project.request?.workflow) &&
      project.request?.acceptedDepartment?.headId !== userId
    const deliverables = isClient
      ? []
      : await tx.projectMilestone.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            description: true,
            expectedFileType: true,
            deliveryStatus: true,
          },
          orderBy: { displayOrder: "asc" },
        })
    return {
      conversation: {
        fullName: chat.name,
        imageUrl: null,
        position: chat.isGroup ? "Project group chat" : "Project chat",
        department: null,
      },
      participants: chat.participants,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        workspaceId: project.workspaceGroupId ?? project.id,
        serviceName: project.request?.service.name ?? null,
        referenceNumber: project.request?.referenceNumber ?? null,
      },
      archived: chat.archived,
      canSubmitDeliverables,
      deliverables,
      canSend: !chat.archived && chat.participants.length > 1,
      messages: messages.map(messageDto),
      nextCursor: rows.length > 50 ? messages[0].id : null,
    }
  })
}

export async function markProjectConversationRead(
  userId: string,
  projectId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await access(tx, userId, projectId)
    // Use the latest persisted message time so a concurrent future message remains unread.
    const latest = await tx.projectMessage.findFirst({
      where: { projectId, AND: [visibleMessages(userId)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true },
    })
    if (latest)
      await tx.projectConversationRead.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: { projectId, userId, readAt: latest.createdAt },
        update: { readAt: latest.createdAt },
      })
    const counts = await unreadCounts(tx, userId)
    return {
      ok: true,
      unreadCount: [...counts.values()].reduce(
        (total, count) => total + count,
        0,
      ),
      conversationUnreadCount: counts.get(projectId) ?? 0,
    }
  })
}

export async function sendProjectMessage(
  userId: string,
  projectId: string,
  body: string,
  clientMessageId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    // Staffing uses the request lock; completion uses the project lock.
    const initial = await access(tx, userId, projectId)
    if (initial.requestId)
      await lockRows(tx, "ServiceRequest", initial.requestId, "share")
    await lockRows(tx, "Project", projectId)
    const chat = summary(await access(tx, userId, projectId))
    if (chat.archived)
      throw new ServiceRequestsError(
        409,
        "This project chat is archived and read-only.",
      )
    if (chat.participants.length < 2)
      throw new ServiceRequestsError(
        409,
        "No assigned staff are available to message.",
      )
    const existing = await tx.projectMessage.findUnique({
      where: {
        projectId_senderId_clientMessageId: {
          projectId,
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
          "This message ID was already used with different text.",
        )
      return messageDto(existing)
    }
    const message = await tx.projectMessage.create({
      data: { projectId, senderId: userId, body, clientMessageId },
      select: messageSelect,
    })
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: message.createdAt },
    })
    return messageDto(message)
  })
}
