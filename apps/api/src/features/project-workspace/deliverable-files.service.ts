import { projectAuditStatus } from "../project-management-logs/events.js"
import { writeProjectLog } from "../project-management-logs/writer.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { parseWorkflowUpload } from "../request-workflow/workflow.files.js"
import {
  readDeliverableCard,
  recordProjectDeliverableMessage,
} from "../project-conversations/deliverable-messages.js"
import { lockRows } from "../../shared/db/locks.js"
import {
  deliverableInput,
  getDeliverableAccess,
  recordDeliverableEvent,
} from "./deliverable-access.js"
import { getProjectWorkspace } from "./workspace-details.service.js"

export async function uploadProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  input: unknown,
) {
  const parsed = parseWorkflowUpload(input)
  const noteValue = deliverableInput(input).note
  if (
    noteValue !== undefined &&
    (typeof noteValue !== "string" ||
      noteValue.length > 2000 ||
      noteValue.includes("\u0000"))
  )
    throw new ServiceRequestsError(
      400,
      "Use a submission note up to 2,000 characters",
    )
  const note = typeof noteValue === "string" ? noteValue.trim() : ""
  await getPrisma()!.$transaction(async (tx) => {
    const initial = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    await lockRows(tx, "ServiceRequest", initial.project.requestId, "share")
    await lockRows(tx, "Project", projectId)
    const { project, milestone, isHead, request } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (isHead)
      throw new ServiceRequestsError(
        403,
        "Department Heads review deliverables; assigned staff upload them",
      )
    if (!request?.workflow || project.status === "CANCELLED")
      throw new ServiceRequestsError(409, "Deliverable uploads are unavailable")
    const lockedProject = await tx.project.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    })
    if (!["IN_PROGRESS", "ON_HOLD"].includes(lockedProject.status))
      throw new ServiceRequestsError(
        409,
        "Deliverable submissions are unavailable for this project",
      )
    const existing = await tx.projectMessage.findUnique({
      where: {
        projectId_senderId_clientMessageId: {
          projectId,
          senderId: userId,
          clientMessageId: parsed.uploadId,
        },
      },
      select: { body: true, deliverable: true },
    })
    if (existing) {
      const card = readDeliverableCard(existing.deliverable)
      const metadata = existing.deliverable
      if (
        !card ||
        card.id !== deliverableId ||
        card.fileName !== parsed.name ||
        existing.body !== (note || "Submitted for review.") ||
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata) ||
        metadata.sha256 !== parsed.sha256
      )
        throw new ServiceRequestsError(
          409,
          "This upload ID was already used for another submission",
        )
      return
    }
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { deliveryStatus: true, workflowFileId: true, title: true },
    })
    if (!["NOT_SUBMITTED", "REJECTED"].includes(current.deliveryStatus))
      throw new ServiceRequestsError(
        409,
        "This deliverable is locked while it is being reviewed or after approval",
      )
    if (current.workflowFileId)
      await tx.workflowFile.delete({ where: { id: current.workflowFileId } })
    const file = await tx.workflowFile.create({
      data: {
        requestId: project.requestId!,
        uploaderId: userId,
        uploadId: parsed.uploadId,
        name: parsed.name,
        mimeType: parsed.mimeType,
        size: parsed.size,
        sha256: parsed.sha256,
        data: parsed.data,
        clientVisible: false,
      },
      select: { id: true },
    })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        workflowFileId: file.id,
        deliveryStatus: "IN_REVIEW",
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
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
      "PROJECT_DELIVERABLE_UPLOADED",
      `Submitted “${milestone.title}” for review.`,
    )
    await recordProjectDeliverableMessage(tx, {
      projectId,
      senderId: userId,
      deliverableId,
      title: current.title,
      fileId: file.id,
      fileName: parsed.name,
      kind: "submission",
      note,
      uploadId: parsed.uploadId,
      sha256: parsed.sha256,
    })
    await writeProjectLog(
      tx,
      userId,
      projectId,
      current.workflowFileId ? "ATTACHMENT_REPLACED" : "ATTACHMENT_ADDED",
      {
        Status: [
          projectAuditStatus(current.deliveryStatus),
          projectAuditStatus("IN_REVIEW"),
        ],
        "Attachment present": [Boolean(current.workflowFileId), true],
        "Attachment type": [null, parsed.mimeType],
      },
      { id: deliverableId, label: current.title },
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function removeProjectDeliverableAttachment(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const { project, milestone, isHead } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (isHead)
      throw new ServiceRequestsError(
        403,
        "Department Heads review deliverables; assigned staff manage uploads",
      )
    if (!milestone.workflowFileId)
      throw new ServiceRequestsError(409, "This deliverable has no attachment")
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { deliveryStatus: true, workflowFileId: true, title: true },
    })
    if (
      !["IN_REVIEW", "REJECTED", "NOT_SUBMITTED"].includes(
        current.deliveryStatus,
      )
    )
      throw new ServiceRequestsError(
        409,
        "Approved deliverables can no longer be removed",
      )
    if (!current.workflowFileId)
      throw new ServiceRequestsError(409, "This deliverable has no attachment")
    const status =
      current.deliveryStatus === "REJECTED" ? "REJECTED" : "NOT_SUBMITTED"
    await tx.workflowFile.delete({ where: { id: current.workflowFileId } })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        workflowFileId: null,
        deliveryStatus: status,
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
      "PROJECT_DELIVERABLE_REMOVED",
      `Removed the attachment for “${current.title}”.`,
    )
    await writeProjectLog(
      tx,
      userId,
      projectId,
      "ATTACHMENT_REMOVED",
      {
        Status: [
          projectAuditStatus(current.deliveryStatus),
          projectAuditStatus(status),
        ],
        "Attachment present": [true, false],
      },
      { id: deliverableId, label: current.title },
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function downloadProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const { milestone } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (!milestone.workflowFileId)
      throw new ServiceRequestsError(404, "No attachment is available")
    const file = await tx.workflowFile.findUnique({
      where: { id: milestone.workflowFileId },
      select: { name: true, mimeType: true, size: true, data: true },
    })
    if (!file) throw new ServiceRequestsError(404, "No attachment is available")
    return file
  })
}
