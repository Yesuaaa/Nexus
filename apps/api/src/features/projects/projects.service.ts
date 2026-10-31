import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

const active = { isActive: true, accountDeletedAt: null } as const

function contributorScope(
  userId: string,
  projectId: string,
): Prisma.ProjectWhereInput {
  return {
    OR: [
      {
        request: {
          acceptedDepartment: {
            headId: userId,
            head: { ...active, role: "STAFF" },
          },
        },
      },
      {
        staff: {
          some: {
            employee: {
              userId,
              status: "ACTIVE",
              user: { ...active, role: "STAFF" },
              department: {
                acceptedServiceRequests: {
                  some: { project: { id: projectId } },
                },
              },
            },
          },
        },
      },
    ],
  }
}

function visibleScope(
  userId: string,
  projectId: string,
): Prisma.ProjectWhereInput {
  return {
    OR: [
      {
        clientId: userId,
        client: { ...active, role: "USER" },
        OR: [
          { requestId: null, status: { not: "PLANNED" } },
          { requestId: { not: null }, startDate: { not: null } },
        ],
      },
      contributorScope(userId, projectId),
    ],
  }
}

export async function getProject(userId: string, id: string) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const project = await tx.project.findFirst({
        where: { id, ...visibleScope(userId, id) },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          createdAt: true,
          request: {
            select: {
              id: true,
              referenceNumber: true,
              service: { select: { name: true } },
            },
          },
          milestones: {
            select: { id: true, title: true, completedAt: true },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          },
        },
      })
      if (!project) throw new ServiceRequestsError(404, "Project not found")
      const canManage = Boolean(
        await tx.project.count({
          where: { id, ...contributorScope(userId, id) },
        }),
      )
      return {
        ...project,
        canManage: canManage && project.status === "IN_PROGRESS",
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function setMilestoneCompletion(
  userId: string,
  projectId: string,
  milestoneId: string,
  completed: boolean,
) {
  await getPrisma()!.$transaction(async (tx) => {
    // Serialize with activation/hold and recheck assignments at the write.
    const editable = await tx.project.updateMany({
      where: {
        id: projectId,
        status: "IN_PROGRESS",
        ...contributorScope(userId, projectId),
      },
      data: { updatedAt: new Date() },
    })
    if (!editable.count)
      throw new ServiceRequestsError(
        404,
        "Active project not found or you cannot update its milestones",
      )
    const milestone = await tx.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    })
    if (!milestone) throw new ServiceRequestsError(404, "Milestone not found")
    if (Boolean(milestone.completedAt) === completed) return
    await tx.projectMilestone.update({
      where: { id: milestoneId },
      data: { completedAt: completed ? new Date() : null },
    })
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        requestId: true,
        clientId: true,
        request: {
          select: { acceptedDepartment: { select: { headId: true } } },
        },
      },
    })
    if (project.requestId) {
      const event = await tx.workflowEvent.create({
        data: {
          requestId: project.requestId,
          actorId: userId,
          type: "PROJECT_MILESTONE_UPDATED",
          summary: `${completed ? "Completed" : "Reopened"} milestone: ${milestone.title}`,
          entityId: projectId,
        },
      })
      const recipients = new Set(
        [project.clientId, project.request?.acceptedDepartment?.headId].filter(
          (value): value is string => Boolean(value) && value !== userId,
        ),
      )
      await tx.workflowNotification.createMany({
        data: [...recipients].map((recipient) => ({
          userId: recipient,
          requestId: project.requestId!,
          eventId: event.id,
        })),
      })
    }
  })
  return getProject(userId, projectId)
}
