import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  activeAccount,
  activeDepartmentHead,
  activeStaff,
} from "../../shared/query/accounts.js"
import { appendEvent } from "../request-workflow/workflow.access.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { lockRows } from "../../shared/db/locks.js"

const clientProjectScope = (userId: string): Prisma.ProjectWhereInput => ({
  clientId: userId,
  client: { ...activeAccount, role: "USER" },
  OR: [
    { requestId: { not: null }, startDate: { not: null } },
    { requestId: null, startDate: { not: null } },
    { requestId: null, status: { notIn: ["PLANNED", "CANCELLED"] } },
  ],
})

function contributorScope(
  userId: string,
  projectId: string,
): Prisma.ProjectWhereInput {
  return {
    OR: [
      {
        request: {
          acceptedDepartment: activeDepartmentHead(userId),
        },
      },
      {
        staff: {
          some: {
            employee: {
              userId,
              status: "ACTIVE",
              user: activeStaff,
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
    OR: [clientProjectScope(userId), contributorScope(userId, projectId)],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function projectTaskProgress(workPlan: unknown) {
  const phases =
    isRecord(workPlan) && Array.isArray(workPlan.phases) ? workPlan.phases : []
  const tasks = phases.flatMap((phase) =>
    isRecord(phase) && Array.isArray(phase.tasks)
      ? phase.tasks.filter(isRecord)
      : [],
  )
  return {
    completed: tasks.filter((task) => task.status === "DONE").length,
    total: tasks.length,
  }
}

export async function getProject(userId: string, id: string) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const project = await tx.project.findFirst({
        where: { id, ...visibleScope(userId, id) },
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          createdAt: true,
          workPlan: true,
          templateKey: true,
          workspaceGroupId: true,
          request: {
            select: {
              id: true,
              referenceNumber: true,
              service: { select: { name: true } },
            },
          },
          milestones: {
            select: {
              id: true,
              title: true,
              completedAt: true,
              deliveryStatus: true,
              sentToClientAt: true,
            },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          },
        },
      })
      if (!project) throw new ServiceRequestsError(404, "Project not found")
      const isClient = project.clientId === userId
      const canManage = Boolean(
        await tx.project.count({
          where: { id, ...contributorScope(userId, id) },
        }),
      )
      const canReviewChanges = Boolean(
        await tx.project.count({
          where: {
            id,
            request: {
              acceptedDepartment: activeDepartmentHead(userId),
            },
          },
        }),
      )
      const deliverables = isClient
        ? await tx.projectMilestone.findMany({
            where: {
              projectId: id,
              deliveryStatus: "SENT_TO_CLIENT",
              workflowFile: { clientVisible: true },
            },
            select: {
              id: true,
              title: true,
              description: true,
              expectedFileType: true,
              sentToClientAt: true,
              workflowFile: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                },
              },
              clientReviews: {
                where: { clientId: userId },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  status: true,
                  note: true,
                  workflowFileId: true,
                  createdAt: true,
                },
              },
            },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          })
        : []
      const changeRequests =
        isClient || canReviewChanges
          ? await tx.projectChangeRequest.findMany({
              where: { projectId: id },
              select: {
                id: true,
                kind: true,
                details: true,
                status: true,
                responseNote: true,
                createdAt: true,
                reviewedAt: true,
                requestedBy: { select: { fullName: true } },
              },
              orderBy: { createdAt: "desc" },
            })
          : []
      const isWorkspaceManaged = Boolean(
        project.templateKey || project.workspaceGroupId,
      )
      const {
        clientId: _clientId,
        workPlan,
        templateKey: _templateKey,
        workspaceGroupId: _workspaceGroupId,
        ...safeProject
      } = project
      void _clientId
      void _templateKey
      void _workspaceGroupId
      const progress = projectTaskProgress(workPlan)
      return {
        ...safeProject,
        workspaceManaged: isWorkspaceManaged,
        milestones: isClient ? [] : project.milestones,
        progress,
        canManage:
          !isWorkspaceManaged && canManage && project.status === "IN_PROGRESS",
        canReviewChanges,
        deliverables,
        changeRequests,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function listClientProjects(userId: string) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const account = await tx.user.findFirst({
        where: { id: userId, ...activeAccount, role: "USER" },
        select: { id: true },
      })
      if (!account)
        throw new ServiceRequestsError(403, "Client project access required")
      const projects = await tx.project.findMany({
        where: clientProjectScope(userId),
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          updatedAt: true,
          workPlan: true,
          request: {
            select: {
              id: true,
              referenceNumber: true,
              service: { select: { name: true } },
            },
          },
          _count: {
            select: {
              milestones: {
                where: {
                  deliveryStatus: "SENT_TO_CLIENT",
                  workflowFile: { clientVisible: true },
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      })
      return projects.map(({ workPlan, _count, ...project }) => {
        const progress = projectTaskProgress(workPlan)
        return {
          ...project,
          completedTasks: progress.completed,
          taskCount: progress.total,
          deliverableCount: _count.milestones,
        }
      })
    },
    { isolationLevel: "RepeatableRead" },
  )
}

function projectBriefInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Enter project brief details")
  const value = input as Record<string, unknown>
  if (typeof value.name !== "string")
    throw new ServiceRequestsError(400, "Enter a project name")
  const name = value.name.trim()
  if (name.length < 2 || name.length > 160)
    throw new ServiceRequestsError(
      400,
      "Project name must be between 2 and 160 characters",
    )
  if (typeof value.description !== "string" || value.description.length > 6000)
    throw new ServiceRequestsError(
      400,
      "Project brief must be 6,000 characters or fewer",
    )
  return { name, description: value.description.trim() || null }
}

export async function updateClientProjectBrief(
  userId: string,
  projectId: string,
  input: unknown,
) {
  const brief = projectBriefInput(input)
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const current = await tx.project.findFirst({
      where: { id: projectId, ...clientProjectScope(userId) },
      select: { id: true, status: true },
    })
    if (!current)
      throw new ServiceRequestsError(404, "Active project not found")
    const cancellationPending = await tx.projectChangeRequest.count({
      where: {
        projectId,
        requestedById: userId,
        kind: "CANCELLATION",
        status: "PENDING",
      },
    })
    if (cancellationPending)
      throw new ServiceRequestsError(
        409,
        "Brief updates are paused while the cancellation request is under review",
      )
    if (!["IN_PROGRESS", "ON_HOLD"].includes(current.status))
      throw new ServiceRequestsError(
        409,
        "The brief can no longer be edited for this project",
      )
    await tx.project.update({ where: { id: projectId }, data: brief })
  })
  return getProject(userId, projectId)
}

export async function createProjectChangeRequest(
  userId: string,
  projectId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Describe the change you need")
  const rawDetails = (input as Record<string, unknown>).details
  if (typeof rawDetails !== "string")
    throw new ServiceRequestsError(400, "Describe the change you need")
  const details = rawDetails.trim()
  if (details.length < 10 || details.length > 4000)
    throw new ServiceRequestsError(
      400,
      "Describe the change in 10 to 4,000 characters",
    )
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const project = await tx.project.findFirst({
      where: { id: projectId, ...clientProjectScope(userId) },
      select: { id: true, status: true },
    })
    if (!project)
      throw new ServiceRequestsError(404, "Active project not found")
    if (!["IN_PROGRESS", "ON_HOLD"].includes(project.status))
      throw new ServiceRequestsError(
        409,
        "Change requests are unavailable for this project",
      )
    const cancellationPending = await tx.projectChangeRequest.count({
      where: {
        projectId,
        requestedById: userId,
        kind: "CANCELLATION",
        status: "PENDING",
      },
    })
    if (cancellationPending)
      throw new ServiceRequestsError(
        409,
        "Change requests are paused while the cancellation request is under review",
      )
    const pending = await tx.projectChangeRequest.count({
      where: {
        projectId,
        requestedById: userId,
        kind: "CHANGE",
        status: "PENDING",
      },
    })
    if (pending)
      throw new ServiceRequestsError(
        409,
        "You already have a change request under review",
      )
    await tx.projectChangeRequest.create({
      data: { projectId, requestedById: userId, kind: "CHANGE", details },
    })
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })
  })
  return getProject(userId, projectId)
}

export async function createProjectCancellationRequest(
  userId: string,
  projectId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Explain why you need to cancel")
  const rawDetails = (input as Record<string, unknown>).details
  if (typeof rawDetails !== "string")
    throw new ServiceRequestsError(400, "Explain why you need to cancel")
  const details = rawDetails.trim()
  if (details.length < 10 || details.length > 2000)
    throw new ServiceRequestsError(
      400,
      "Give a reason between 10 and 2,000 characters",
    )
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const project = await tx.project.findFirst({
      where: { id: projectId, ...clientProjectScope(userId) },
      select: { id: true, name: true, status: true, requestId: true },
    })
    if (!project)
      throw new ServiceRequestsError(404, "Active project not found")
    if (!["IN_PROGRESS", "ON_HOLD"].includes(project.status))
      throw new ServiceRequestsError(
        409,
        "Cancellation requests are unavailable for this project",
      )
    if (!project.requestId)
      throw new ServiceRequestsError(
        409,
        "A Department Head must be assigned before requesting cancellation",
      )
    const pending = await tx.projectChangeRequest.count({
      where: {
        projectId,
        requestedById: userId,
        kind: "CANCELLATION",
        status: "PENDING",
      },
    })
    if (pending)
      throw new ServiceRequestsError(
        409,
        "A cancellation request is already under review",
      )
    await tx.projectChangeRequest.create({
      data: {
        projectId,
        requestedById: userId,
        kind: "CANCELLATION",
        details,
      },
    })
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })
    await appendEvent(
      tx,
      project.requestId,
      userId,
      "PROJECT_CANCELLATION_REQUESTED",
      `The client requested cancellation of “${project.name}”. Review the request in Project Workspace.`,
      project.id,
    )
  })
  return getProject(userId, projectId)
}

export async function reviewProjectChangeRequest(
  userId: string,
  projectId: string,
  changeRequestId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Choose a decision")
  const value = input as Record<string, unknown>
  const decision = value.decision
  const responseNote =
    typeof value.responseNote === "string" ? value.responseNote.trim() : ""
  if (decision !== "ACCEPTED" && decision !== "NOT_APPROVED")
    throw new ServiceRequestsError(400, "Choose whether to accept the request")
  if (decision === "NOT_APPROVED" && responseNote.length < 3)
    throw new ServiceRequestsError(
      400,
      "Give the client a reason before declining the request",
    )
  if (responseNote.length > 2000)
    throw new ServiceRequestsError(
      400,
      "Response must be 2,000 characters or fewer",
    )
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const head = await tx.project.findFirst({
      where: {
        id: projectId,
        request: {
          acceptedDepartment: activeDepartmentHead(userId),
        },
      },
      select: { id: true, status: true },
    })
    if (!head)
      throw new ServiceRequestsError(
        403,
        "Only the responsible Department Head can review this request",
      )
    if (!["IN_PROGRESS", "ON_HOLD"].includes(head.status))
      throw new ServiceRequestsError(
        409,
        "Change requests cannot be reviewed after this project ends",
      )
    const changed = await tx.projectChangeRequest.updateMany({
      where: {
        id: changeRequestId,
        projectId,
        kind: "CHANGE",
        status: "PENDING",
      },
      data: {
        status: decision,
        responseNote: responseNote || null,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "This change request has already been reviewed",
      )
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })
  })
  return getProject(userId, projectId)
}

export async function reviewProjectCancellationRequest(
  userId: string,
  projectId: string,
  cancellationRequestId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Choose a decision")
  const value = input as Record<string, unknown>
  const decision = value.decision
  const responseNote =
    typeof value.responseNote === "string" ? value.responseNote.trim() : ""
  if (decision !== "ACCEPTED" && decision !== "NOT_APPROVED")
    throw new ServiceRequestsError(400, "Choose whether to approve the request")
  if (decision === "NOT_APPROVED" && responseNote.length < 3)
    throw new ServiceRequestsError(
      400,
      "Give the client a reason before declining the request",
    )
  if (responseNote.length > 2000)
    throw new ServiceRequestsError(
      400,
      "Response must be 2,000 characters or fewer",
    )
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        request: {
          acceptedDepartment: activeDepartmentHead(userId),
        },
      },
      select: { id: true, name: true, status: true, requestId: true },
    })
    if (!project)
      throw new ServiceRequestsError(
        403,
        "Only the responsible Department Head can review this request",
      )
    if (
      decision === "ACCEPTED" &&
      !["IN_PROGRESS", "ON_HOLD"].includes(project.status)
    )
      throw new ServiceRequestsError(
        409,
        "This project can no longer be cancelled",
      )
    const changed = await tx.projectChangeRequest.updateMany({
      where: {
        id: cancellationRequestId,
        projectId,
        kind: "CANCELLATION",
        status: "PENDING",
      },
      data: {
        status: decision,
        responseNote: responseNote || null,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "This cancellation request has already been reviewed",
      )
    if (decision === "ACCEPTED") {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "CANCELLED", updatedAt: new Date() },
      })
      if (project.requestId) {
        await tx.requestWorkflow.updateMany({
          where: {
            requestId: project.requestId,
            state: { in: ["ACTIVE_PROJECT", "ON_HOLD"] },
          },
          data: { state: "CANCELLED" },
        })
        await tx.serviceRequest.updateMany({
          where: { id: project.requestId, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED" },
        })
      }
      await tx.projectChangeRequest.updateMany({
        where: {
          projectId,
          kind: "CHANGE",
          status: "PENDING",
        },
        data: {
          status: "NOT_APPROVED",
          responseNote:
            "This project was cancelled after the client's cancellation request was approved.",
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      })
    } else {
      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      })
    }
    if (project.requestId)
      await appendEvent(
        tx,
        project.requestId,
        userId,
        decision === "ACCEPTED"
          ? "PROJECT_CANCELLATION_APPROVED"
          : "PROJECT_CANCELLATION_DECLINED",
        decision === "ACCEPTED"
          ? `The Department Head approved cancellation of “${project.name}”. The project is now cancelled.`
          : `The Department Head declined the cancellation request for “${project.name}”.`,
        project.id,
      )
  })
  return getProject(userId, projectId)
}

export async function reviewClientDeliverable(
  userId: string,
  projectId: string,
  milestoneId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Choose an action for the deliverable")
  const value = input as Record<string, unknown>
  const decision = value.decision
  const note = typeof value.note === "string" ? value.note.trim() : ""
  if (decision !== "APPROVED" && decision !== "REVISION_REQUESTED")
    throw new ServiceRequestsError(
      400,
      "Choose whether to approve or request a revision",
    )
  if (decision === "REVISION_REQUESTED" && note.length < 3)
    throw new ServiceRequestsError(
      400,
      "Enter a reason for the requested revision",
    )
  if (note.length > 2000)
    throw new ServiceRequestsError(
      400,
      "Note must be 2,000 characters or fewer",
    )
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Project", projectId)
    const project = await tx.project.findFirst({
      where: { id: projectId, ...clientProjectScope(userId) },
      select: { id: true, status: true },
    })
    if (!project)
      throw new ServiceRequestsError(404, "Active project not found")
    if (project.status === "CANCELLED")
      throw new ServiceRequestsError(
        409,
        "This project is not accepting reviews",
      )
    const milestone = await tx.projectMilestone.findFirst({
      where: {
        id: milestoneId,
        projectId,
        deliveryStatus: "SENT_TO_CLIENT",
        workflowFile: { clientVisible: true },
      },
      select: { id: true, workflowFileId: true },
    })
    if (!milestone?.workflowFileId)
      throw new ServiceRequestsError(404, "Shared deliverable not found")
    const review = await tx.projectDeliverableClientReview.createMany({
      data: {
        milestoneId,
        workflowFileId: milestone.workflowFileId,
        clientId: userId,
        status: decision,
        note: note || null,
      },
      skipDuplicates: true,
    })
    if (!review.count)
      throw new ServiceRequestsError(
        409,
        "You have already reviewed this version of the deliverable",
      )
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })
  })
  return getProject(userId, projectId)
}

export async function getClientDeliverableFile(
  userId: string,
  projectId: string,
  milestoneId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const milestone = await tx.projectMilestone.findFirst({
      where: {
        id: milestoneId,
        projectId,
        project: clientProjectScope(userId),
        deliveryStatus: "SENT_TO_CLIENT",
        workflowFile: { clientVisible: true },
      },
      select: {
        workflowFile: {
          select: { name: true, mimeType: true, size: true, data: true },
        },
      },
    })
    if (!milestone?.workflowFile)
      throw new ServiceRequestsError(404, "Shared deliverable not found")
    return milestone.workflowFile
  })
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
        templateKey: null,
        workspaceGroupId: null,
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
