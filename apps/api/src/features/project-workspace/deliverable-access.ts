import type { Prisma } from "../../generated/prisma/client.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  getStaffContext,
  scopedProjectForEdit,
  type StaffContext,
} from "./workspace-access.js"

const projectDeliverableSelect = {
  id: true,
  title: true,
  description: true,
  expectedFileType: true,
  deliveryStatus: true,
  rejectionReason: true,
  reviewedAt: true,
  sentToClientAt: true,
  workflowFileId: true,
  updatedAt: true,
  completedAt: true,
  workflowFile: {
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      uploaderId: true,
      createdAt: true,
      clientVisible: true,
    },
  },
} satisfies Prisma.ProjectMilestoneSelect

export async function getDeliverableAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  headOnly = false,
) {
  const context = await getStaffContext(tx, userId)
  const project = await scopedProjectForEdit(
    tx,
    context,
    workspaceId,
    projectId,
  )
  const request = await tx.serviceRequest.findUnique({
    where: { id: project.requestId! },
    select: {
      acceptedDepartmentId: true,
      workflow: { select: { state: true } },
    },
  })
  const isHead = Boolean(
    request?.acceptedDepartmentId &&
    context.headDepartmentIds.includes(request.acceptedDepartmentId),
  )
  if (headOnly && !isHead)
    throw new ServiceRequestsError(
      403,
      "Only the department head can manage deliverables",
    )
  const assignment = await tx.projectStaff.findFirst({
    where: {
      projectId: project.id,
      employee: {
        userId,
        status: "ACTIVE",
        user: activeStaff,
      },
    },
    select: { id: true, isTeamLead: true },
  })
  const hasTeamLead = Boolean(
    await tx.projectStaff.findFirst({
      where: {
        projectId: project.id,
        isTeamLead: true,
        employee: { status: "ACTIVE", user: activeStaff },
      },
      select: { id: true },
    }),
  )
  const isAssignedStaff = isHead || Boolean(assignment)
  if (!isHead && !isAssignedStaff)
    throw new ServiceRequestsError(
      403,
      "Only assigned project staff can manage deliverable attachments",
    )
  const milestone = await tx.projectMilestone.findFirst({
    where: { id: deliverableId, projectId: project.id },
    select: projectDeliverableSelect,
  })
  if (!milestone)
    throw new ServiceRequestsError(404, "Project deliverable not found")
  return {
    context,
    project,
    milestone,
    isHead,
    isTeamLead: assignment?.isTeamLead === true,
    hasTeamLead,
    request,
  }
}

export function recordDeliverableEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  deliverableId: string,
  userId: string,
  type: string,
  summary: string,
  internal = true,
) {
  return tx.workflowEvent.create({
    data: {
      requestId,
      entityId: deliverableId,
      actorId: userId,
      type,
      summary,
      internal,
    },
  })
}

export function deliverableInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Enter deliverable details")
  return input as Record<string, unknown>
}

export async function projectWorkspaceReviewAccess(
  tx: Prisma.TransactionClient,
  context: StaffContext,
  projectId: string,
  acceptedDepartmentId: string | null,
) {
  const [assignment, activeLead] = await Promise.all([
    tx.projectStaff.findFirst({
      where: {
        projectId,
        employee: {
          userId: context.id,
          status: "ACTIVE",
          user: activeStaff,
        },
      },
      select: { id: true, isTeamLead: true },
    }),
    tx.projectStaff.findFirst({
      where: {
        projectId,
        isTeamLead: true,
        employee: { status: "ACTIVE", user: activeStaff },
      },
      select: { id: true },
    }),
  ])
  return {
    isAssignedStaff: Boolean(assignment),
    isTeamLead: assignment?.isTeamLead === true,
    hasTeamLead: Boolean(activeLead),
    isDepartmentHead: Boolean(
      acceptedDepartmentId &&
      context.headDepartmentIds.includes(acceptedDepartmentId),
    ),
  }
}
