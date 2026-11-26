import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { projectWorkspaceReviewAccess } from "./deliverable-access.js"
import {
  getStaffContext,
  lockAndRevalidateProjectForEdit,
  terminalProjectStatuses,
} from "./workspace-access.js"
import { getProjectWorkspace } from "./workspace-details.service.js"

function submittedNoteContent(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Enter a project note")
  const content = (input as Record<string, unknown>).content
  if (
    typeof content !== "string" ||
    !content.trim() ||
    content.trim().length > 4000 ||
    content.includes("\u0000")
  )
    throw new ServiceRequestsError(
      400,
      "Enter a project note between 1 and 4,000 characters",
    )
  return content.trim()
}

function projectNoteReviewInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Choose a review decision")
  const body = input as Record<string, unknown>
  const action = body.action
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : ""
  if (
    !(["APPROVE", "REQUEST_REVISION", "REJECT"] as const).includes(
      action as "APPROVE" | "REQUEST_REVISION" | "REJECT",
    )
  )
    throw new ServiceRequestsError(400, "Choose a valid review decision")
  if (
    body.feedback !== undefined &&
    (typeof body.feedback !== "string" ||
      body.feedback.length > 2000 ||
      body.feedback.includes("\u0000"))
  )
    throw new ServiceRequestsError(
      400,
      "Keep review feedback under 2,000 characters",
    )
  if (action !== "APPROVE" && feedback.length < 3)
    throw new ServiceRequestsError(
      400,
      "Add feedback when requesting a revision or rejecting a note",
    )
  if (
    body.clientVisible !== undefined &&
    typeof body.clientVisible !== "boolean"
  )
    throw new ServiceRequestsError(
      400,
      "Choose whether the note is client-visible",
    )
  return {
    action: action as "APPROVE" | "REQUEST_REVISION" | "REJECT",
    feedback,
    clientVisible: body.clientVisible === true,
  }
}

export async function createProjectNote(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
) {
  const content = submittedNoteContent(input)
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, context, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    const access = await projectWorkspaceReviewAccess(
      tx,
      context,
      project.id,
      acceptedDepartmentId,
    )
    if (!access.isAssignedStaff)
      throw new ServiceRequestsError(
        403,
        "Only assigned project staff can submit notes",
      )
    if (!project.requestId || terminalProjectStatuses.includes(project.status))
      throw new ServiceRequestsError(409, "This project is not accepting notes")
    const note = await tx.projectNote.create({
      data: {
        projectId: project.id,
        createdById: userId,
        revisions: {
          create: {
            revision: 1,
            content,
            authorId: userId,
            status: "SUBMITTED",
          },
        },
      },
      select: {
        id: true,
        revisions: { select: { id: true, revision: true } },
      },
    })
    const revision = note.revisions[0]
    if (!revision)
      throw new Error("Created project note has no initial revision")
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await writeProjectNoteRevisionEvent(
      tx,
      project.requestId,
      revision.id,
      userId,
      "PROJECT_NOTE_SUBMITTED",
      `Submitted project note revision ${revision.revision} for review.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function createProjectNoteRevision(
  userId: string,
  workspaceId: string,
  projectId: string,
  noteId: string,
  input: unknown,
) {
  const content = submittedNoteContent(input)
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, context, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    const access = await projectWorkspaceReviewAccess(
      tx,
      context,
      project.id,
      acceptedDepartmentId,
    )
    if (!access.isAssignedStaff)
      throw new ServiceRequestsError(
        403,
        "Only assigned project staff can revise notes",
      )
    if (!project.requestId || terminalProjectStatuses.includes(project.status))
      throw new ServiceRequestsError(409, "This project is not accepting notes")
    await lockRows(tx, "ProjectNote", noteId)
    const note = await tx.projectNote.findFirst({
      where: { id: noteId, projectId: project.id },
      select: {
        id: true,
        createdById: true,
        revisions: {
          orderBy: [{ revision: "desc" }, { id: "desc" }],
          take: 1,
          select: { revision: true, status: true },
        },
      },
    })
    if (!note) throw new ServiceRequestsError(404, "Project note not found")
    if (note.createdById !== userId)
      throw new ServiceRequestsError(
        403,
        "Only the note author can submit a revision",
      )
    const latest = note.revisions[0]
    if (!latest || !["REVISION_REQUIRED", "APPROVED"].includes(latest.status))
      throw new ServiceRequestsError(
        409,
        "A note can be revised after changes are requested or after approval",
      )
    const revision = await tx.projectNoteRevision.create({
      data: {
        noteId: note.id,
        revision: latest.revision + 1,
        content,
        authorId: userId,
        status: "SUBMITTED",
      },
      select: { id: true, revision: true },
    })
    await tx.projectNote.update({
      where: { id: note.id },
      data: { updatedAt: new Date() },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await writeProjectNoteRevisionEvent(
      tx,
      project.requestId,
      revision.id,
      userId,
      "PROJECT_NOTE_SUBMITTED",
      `Submitted project note revision ${revision.revision} for review.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function reviewProjectNoteRevision(
  userId: string,
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
  input: unknown,
) {
  const review = projectNoteReviewInput(input)
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, context, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    if (!project.requestId)
      throw new ServiceRequestsError(409, "This project has no linked request")
    await lockRows(tx, "ProjectNote", noteId)
    await lockRows(tx, "ProjectNoteRevision", revisionId)
    const note = await tx.projectNote.findFirst({
      where: { id: noteId, projectId: project.id },
      select: { id: true },
    })
    if (!note) throw new ServiceRequestsError(404, "Project note not found")
    const revision = await tx.projectNoteRevision.findFirst({
      where: { id: revisionId, noteId },
      select: { id: true, revision: true, status: true, authorId: true },
    })
    if (!revision)
      throw new ServiceRequestsError(404, "Project note revision not found")
    const access = await projectWorkspaceReviewAccess(
      tx,
      context,
      project.id,
      acceptedDepartmentId,
    )
    const isOwnReview = revision.authorId === userId
    const canReviewOwnSubmission =
      isOwnReview &&
      revision.status === "SUBMITTED" &&
      review.action !== "REQUEST_REVISION" &&
      (access.isTeamLead || access.isDepartmentHead)
    if (isOwnReview && !canReviewOwnSubmission)
      throw new ServiceRequestsError(403, "You cannot review your own note")
    const leadCanReview = access.isTeamLead && revision.status === "SUBMITTED"
    const headCanReview =
      access.isDepartmentHead &&
      (revision.status === "ESCALATED" ||
        (!access.hasTeamLead && revision.status === "SUBMITTED"))
    if (!canReviewOwnSubmission && !leadCanReview && !headCanReview)
      throw new ServiceRequestsError(
        403,
        access.hasTeamLead
          ? "A Department Head can review only escalated notes"
          : "Only the assigned project lead or Department Head can review notes",
      )
    if (review.clientVisible && review.action !== "APPROVE")
      throw new ServiceRequestsError(
        400,
        "Only approved notes can be shared with the client",
      )
    const status =
      review.action === "APPROVE"
        ? "APPROVED"
        : review.action === "REQUEST_REVISION"
          ? "REVISION_REQUIRED"
          : "REJECTED"
    const reviewedAt = new Date()
    const changed = await tx.projectNoteRevision.updateMany({
      where: { id: revision.id, status: revision.status },
      data: {
        status,
        reviewedById: userId,
        reviewedAt,
        feedback: review.feedback || null,
        clientVisible: status === "APPROVED" && review.clientVisible,
        publishedAt:
          status === "APPROVED" && review.clientVisible ? reviewedAt : null,
        publishedById:
          status === "APPROVED" && review.clientVisible ? userId : null,
      },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "This note was reviewed by someone else. Refresh the project.",
      )
    if (status === "APPROVED" && review.clientVisible) {
      const previousPublications = await tx.projectNoteRevision.findMany({
        where: { noteId, id: { not: revision.id }, clientVisible: true },
        select: { id: true, revision: true },
      })
      for (const previous of previousPublications) {
        const unpublished = await tx.projectNoteRevision.updateMany({
          where: { id: previous.id, clientVisible: true },
          data: {
            clientVisible: false,
            supersededAt: reviewedAt,
            supersededByRevisionId: revision.id,
          },
        })
        if (unpublished.count)
          await writeProjectNoteRevisionEvent(
            tx,
            project.requestId,
            previous.id,
            userId,
            "PROJECT_NOTE_PUBLICATION_SUPERSEDED",
            `Superseded published note revision ${previous.revision} with revision ${revision.revision}.`,
          )
      }
    }
    await tx.projectNote.update({
      where: { id: note.id },
      data: { updatedAt: reviewedAt },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: reviewedAt },
    })
    const eventType =
      status === "APPROVED"
        ? "PROJECT_NOTE_APPROVED"
        : status === "REVISION_REQUIRED"
          ? "PROJECT_NOTE_REVISION_REQUIRED"
          : "PROJECT_NOTE_REJECTED"
    const eventSummary =
      status === "APPROVED"
        ? "Approved a project note revision."
        : status === "REVISION_REQUIRED"
          ? "Requested changes to a project note revision."
          : "Rejected a project note revision."
    await writeProjectNoteRevisionEvent(
      tx,
      project.requestId,
      revision.id,
      userId,
      eventType,
      `Note revision ${revision.revision}: ${eventSummary}`,
    )
    if (status === "APPROVED" && review.clientVisible)
      await writeProjectNoteRevisionEvent(
        tx,
        project.requestId,
        revision.id,
        userId,
        "PROJECT_NOTE_PUBLISHED",
        `Published approved note revision ${revision.revision} to the client.`,
      )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function escalateProjectNoteRevision(
  userId: string,
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, context, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    if (!project.requestId)
      throw new ServiceRequestsError(409, "This project has no linked request")
    const access = await projectWorkspaceReviewAccess(
      tx,
      context,
      project.id,
      acceptedDepartmentId,
    )
    if (!access.isTeamLead)
      throw new ServiceRequestsError(
        403,
        "Only the assigned Team Lead can escalate notes",
      )
    await lockRows(tx, "ProjectNote", noteId)
    await lockRows(tx, "ProjectNoteRevision", revisionId)
    const note = await tx.projectNote.findFirst({
      where: { id: noteId, projectId: project.id },
      select: { id: true },
    })
    if (!note) throw new ServiceRequestsError(404, "Project note not found")
    const revision = await tx.projectNoteRevision.findFirst({
      where: { id: revisionId, noteId },
      select: { id: true, revision: true, status: true },
    })
    if (!revision)
      throw new ServiceRequestsError(404, "Project note revision not found")
    const changed = await tx.projectNoteRevision.updateMany({
      where: { id: revision.id, status: "SUBMITTED" },
      data: { status: "ESCALATED", escalatedAt: new Date() },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "Only a submitted note revision can be escalated",
      )
    await tx.projectNote.update({
      where: { id: note.id },
      data: { updatedAt: new Date() },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await writeProjectNoteRevisionEvent(
      tx,
      project.requestId,
      revision.id,
      userId,
      "PROJECT_NOTE_ESCALATED",
      `Escalated note revision ${revision.revision} for Department Head review.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function unpublishProjectNoteRevision(
  userId: string,
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, context, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    if (!project.requestId)
      throw new ServiceRequestsError(409, "This project has no linked request")
    await lockRows(tx, "ProjectNote", noteId)
    await lockRows(tx, "ProjectNoteRevision", revisionId)
    const revision = await tx.projectNoteRevision.findFirst({
      where: { id: revisionId, noteId, note: { projectId: project.id } },
      select: {
        id: true,
        revision: true,
        status: true,
        clientVisible: true,
        publishedById: true,
      },
    })
    if (!revision)
      throw new ServiceRequestsError(404, "Project note revision not found")
    const access = await projectWorkspaceReviewAccess(
      tx,
      context,
      project.id,
      acceptedDepartmentId,
    )
    if (
      !access.isDepartmentHead &&
      !(access.isTeamLead && revision.publishedById === userId)
    )
      throw new ServiceRequestsError(
        403,
        "Only the Department Head or the publishing Team Lead can unpublish this note",
      )
    if (revision.status !== "APPROVED" || !revision.clientVisible)
      throw new ServiceRequestsError(
        409,
        "Only a currently published, approved revision can be unpublished",
      )
    const unpublishedAt = new Date()
    const changed = await tx.projectNoteRevision.updateMany({
      where: {
        id: revision.id,
        status: "APPROVED",
        clientVisible: true,
      },
      data: {
        clientVisible: false,
        unpublishedAt,
        unpublishedById: userId,
      },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "This note publication changed. Refresh the project.",
      )
    await tx.projectNote.update({
      where: { id: noteId },
      data: { updatedAt: unpublishedAt },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: unpublishedAt },
    })
    await writeProjectNoteRevisionEvent(
      tx,
      project.requestId,
      revision.id,
      userId,
      "PROJECT_NOTE_UNPUBLISHED",
      `Unpublished project note revision ${revision.revision} from the client.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

async function writeProjectNoteRevisionEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  revisionId: string,
  userId: string,
  type: string,
  summary: string,
) {
  await tx.workflowEvent.create({
    data: {
      requestId,
      entityId: revisionId,
      actorId: userId,
      type,
      summary,
      internal: true,
    },
  })
}
