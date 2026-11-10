import { randomUUID } from "node:crypto"
import type { Prisma } from "../../generated/prisma/client.js"

export function readDeliverableCard(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.fileName !== "string" ||
    typeof value.fileId !== "string" ||
    (value.kind !== "submission" && value.kind !== "delivery")
  )
    return null
  return {
    id: value.id,
    title: value.title,
    fileName: value.fileName,
    fileId: value.fileId,
    kind: value.kind,
  }
}

/** The workspace write and its chat card commit together. Files stay in WorkflowFile. */
export function recordProjectDeliverableMessage(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string
    senderId: string
    deliverableId: string
    title: string
    fileId: string
    fileName: string
    kind: "submission" | "delivery"
    note?: string
    uploadId?: string
    sha256?: string
  },
) {
  return tx.projectMessage.create({
    data: {
      projectId: input.projectId,
      senderId: input.senderId,
      clientMessageId: input.uploadId ?? randomUUID(),
      body:
        input.note ||
        (input.kind === "submission"
          ? "Submitted for review."
          : "Shared a deliverable."),
      clientVisible: input.kind === "delivery",
      deliverable: {
        id: input.deliverableId,
        title: input.title,
        fileId: input.fileId,
        fileName: input.fileName,
        kind: input.kind,
        ...(input.sha256 ? { sha256: input.sha256 } : {}),
      },
    },
  })
}
