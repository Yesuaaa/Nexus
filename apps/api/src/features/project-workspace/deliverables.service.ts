import {
  auditLabel,
  projectAuditStatus,
} from "../project-management-logs/events.js"
import { writeProjectLog } from "../project-management-logs/writer.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { recordProjectDeliverableMessage } from "../project-conversations/deliverable-messages.js"
import { lockRows } from "../../shared/db/locks.js"
import {
  deliverableInput,
  getDeliverableAccess,
  recordDeliverableEvent,
} from "./deliverable-access.js"
import { getProjectWorkspace } from "./workspace-details.service.js"
import {
  getStaffContext,
  lockAndRevalidateProjectForEdit,
  terminalProjectStatuses,
} from "./workspace-access.js"

export async function updateProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  input: unknown,
) {
  const body = deliverableInput(input)
  const update: Prisma.ProjectMilestoneUpdateInput = {}
  if (body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 300
    )
      throw new ServiceRequestsError(
        400,
        "Use a deliverable name up to 300 characters",
      )
    update.title = body.title.trim()
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 4000)
      throw new ServiceRequestsError(
        400,
        "Keep the description under 4,000 characters",
      )
    update.description = body.description.trim() || null
  }
  if (body.expectedFileType !== undefined) {
    if (
      typeof body.expectedFileType !== "string" ||
      body.expectedFileType.length > 50
    )
      throw new ServiceRequestsError(400, "Choose a valid attachment type")
    update.expectedFileType = body.expectedFileType.trim() || null
  }
  if (!Object.keys(update).length)
    throw new ServiceRequestsError(400, "Change at least one deliverable field")

  await getPrisma()!.$transaction(async (tx) => {
    const { project, isHead } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
      true,
    )
    if (!isHead)
      throw new ServiceRequestsError(
        403,
        "Only the department head can edit deliverables",
      )
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: {
        deliveryStatus: true,
        title: true,
        description: true,
        expectedFileType: true,
      },
    })
    if (current.deliveryStatus === "SENT_TO_CLIENT")
      throw new ServiceRequestsError(409, "Sent deliverables cannot be edited")
    const saved = await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: update,
      select: { title: true, description: true, expectedFileType: true },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      "PROJECT_DELIVERABLE_UPDATED",
      `Updated the details for deliverable “${body.title ?? current.title}”.`,
    )
    const descriptionEdited = saved.description !== current.description
    const fileTypeEdited = saved.expectedFileType !== current.expectedFileType
    if (saved.title !== current.title || descriptionEdited || fileTypeEdited)
      await writeProjectLog(
        tx,
        userId,
        projectId,
        "DELIVERABLE_UPDATED",
        {
          Name: [auditLabel(current.title), auditLabel(saved.title)],
          "Description edited": [false, descriptionEdited],
          "Expected file type edited": [false, fileTypeEdited],
        },
        { id: deliverableId, label: saved.title },
      )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function reviewProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  decision: "approve" | "reject",
  input?: unknown,
) {
  const reasonValue = input ? deliverableInput(input).reason : undefined
  const reason =
    decision === "reject" && typeof reasonValue === "string"
      ? reasonValue.trim()
      : ""
  if (decision === "reject" && (reason.length < 3 || reason.length > 2000))
    throw new ServiceRequestsError(
      400,
      "Enter a rejection reason between 3 and 2,000 characters",
    )

  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    await lockAndRevalidateProjectForEdit(
      tx,
      userId,
      initialContext,
      workspaceId,
      projectId,
    )
    const { project, request, isHead, isTeamLead, hasTeamLead } =
      await getDeliverableAccess(
        tx,
        userId,
        workspaceId,
        projectId,
        deliverableId,
      )
    if (!request?.workflow)
      throw new ServiceRequestsError(409, "This project has no client workflow")
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { title: true, deliveryStatus: true, workflowFileId: true },
    })
    if (current.deliveryStatus !== "IN_REVIEW" || !current.workflowFileId)
      throw new ServiceRequestsError(
        409,
        "Only submitted deliverables can be reviewed",
      )
    const submission = await tx.projectDeliverableSubmission.findFirst({
      where: {
        milestoneId: deliverableId,
        workflowFileId: current.workflowFileId,
      },
      select: {
        id: true,
        status: true,
        submittedById: true,
      },
    })
    if (!submission || !["IN_REVIEW", "ESCALATED"].includes(submission.status))
      throw new ServiceRequestsError(
        409,
        "This deliverable submission is no longer awaiting review",
      )
    if (submission.submittedById === userId)
      throw new ServiceRequestsError(
        403,
        "You cannot review your own submission",
      )
    const leadCanReview = isTeamLead && submission.status === "IN_REVIEW"
    const headCanReview =
      isHead &&
      (submission.status === "ESCALATED" ||
        (!hasTeamLead && submission.status === "IN_REVIEW"))
    if (!leadCanReview && !headCanReview)
      throw new ServiceRequestsError(
        403,
        hasTeamLead
          ? "A Department Head can review only escalated submissions"
          : "Only the assigned project lead or Department Head can review deliverables",
      )
    const approved = decision === "approve"
    const reviewedAt = new Date()
    const submissionUpdated = await tx.projectDeliverableSubmission.updateMany({
      where: { id: submission.id, status: submission.status },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedById: userId,
        reviewedAt,
        feedback: approved ? null : reason,
      },
    })
    if (!submissionUpdated.count)
      throw new ServiceRequestsError(
        409,
        "This submission was reviewed by someone else. Refresh the project.",
      )
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        deliveryStatus: approved ? "APPROVED" : "REJECTED",
        rejectionReason: approved ? null : reason,
        reviewedById: userId,
        reviewedAt,
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      approved
        ? "PROJECT_DELIVERABLE_APPROVED"
        : "PROJECT_DELIVERABLE_REJECTED",
      approved
        ? `Approved “${current.title}”.`
        : `Rejected “${current.title}”: ${reason}`,
    )
    await writeProjectLog(
      tx,
      userId,
      projectId,
      approved ? "DELIVERABLE_APPROVED" : "DELIVERABLE_REJECTED",
      {
        Status: [
          projectAuditStatus(current.deliveryStatus),
          projectAuditStatus(approved ? "APPROVED" : "REJECTED"),
        ],
      },
      { id: deliverableId, label: current.title },
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function sendProjectDeliverableToClient(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const { project, request } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
      true,
    )
    if (!request?.workflow)
      throw new ServiceRequestsError(409, "This project has no client workflow")
    await lockRows(tx, "Project", project.id)
    const lockedStatus = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    })
    if (terminalProjectStatuses.includes(lockedStatus.status))
      throw new ServiceRequestsError(
        409,
        "Archived projects cannot share new deliverables",
      )
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { title: true, deliveryStatus: true, workflowFileId: true },
    })
    if (current.deliveryStatus !== "APPROVED" || !current.workflowFileId)
      throw new ServiceRequestsError(
        409,
        "Approve the deliverable before sending it to the client",
      )
    await tx.workflowFile.update({
      where: { id: current.workflowFileId },
      data: { clientVisible: true },
    })
    await tx.projectDeliverableSubmission.updateMany({
      where: {
        milestoneId: deliverableId,
        workflowFileId: current.workflowFileId,
        status: "APPROVED",
      },
      data: { status: "SENT_TO_CLIENT" },
    })
    const sharedFile = await tx.workflowFile.findUniqueOrThrow({
      where: { id: current.workflowFileId },
      select: { name: true },
    })
    await recordProjectDeliverableMessage(tx, {
      projectId,
      senderId: userId,
      deliverableId,
      title: current.title,
      fileId: current.workflowFileId,
      fileName: sharedFile.name,
      kind: "delivery",
    })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        deliveryStatus: "SENT_TO_CLIENT",
        sentToClientById: userId,
        sentToClientAt: new Date(),
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      current.workflowFileId,
      userId,
      "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
      `A project deliverable was shared with you: “${current.title}”.`,
      false,
    )
    await tx.requestWorkflow.update({
      where: { requestId: project.requestId! },
      data: { version: { increment: 1 } },
    })
    await tx.serviceRequest.update({
      where: { id: project.requestId! },
      data: { updatedAt: new Date() },
    })
    await writeProjectLog(
      tx,
      userId,
      projectId,
      "DELIVERABLE_SHARED",
      {
        Status: [
          projectAuditStatus(current.deliveryStatus),
          projectAuditStatus("SENT_TO_CLIENT"),
        ],
      },
      { id: deliverableId, label: current.title },
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function escalateProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    await lockAndRevalidateProjectForEdit(
      tx,
      userId,
      initialContext,
      workspaceId,
      projectId,
    )
    const { project, isTeamLead } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (!isTeamLead)
      throw new ServiceRequestsError(
        403,
        "Only the assigned Team Lead can escalate deliverables",
      )
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const milestone = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { title: true, deliveryStatus: true, workflowFileId: true },
    })
    if (milestone.deliveryStatus !== "IN_REVIEW" || !milestone.workflowFileId)
      throw new ServiceRequestsError(
        409,
        "Only a pending deliverable can be escalated",
      )
    const changed = await tx.projectDeliverableSubmission.updateMany({
      where: {
        milestoneId: deliverableId,
        workflowFileId: milestone.workflowFileId,
        status: "IN_REVIEW",
      },
      data: { status: "ESCALATED", escalatedAt: new Date() },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "This deliverable was already escalated or reviewed",
      )
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      "PROJECT_DELIVERABLE_ESCALATED",
      `Escalated “${milestone.title}” for Department Head review.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}
