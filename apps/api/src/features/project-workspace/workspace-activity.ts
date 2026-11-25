import type { Prisma } from "../../generated/prisma/client.js"

export const activityTypes = [
  "PROJECT_ACTIVATED",
  "PROJECT_MILESTONE_UPDATED",
  "STAFFING_APPROVED",
  "WORKSPACE_CREATED",
  "WORKSPACE_RENAMED",
  "WORKSPACE_CANCELLED",
  "WORKSPACE_ON_HOLD",
  "WORKSPACE_RESUMED",
  "WORKSPACE_COMPLETED",
  "WORKSPACE_TASK_ADDED",
  "WORKSPACE_TASK_UPDATED",
  "PROJECT_DELIVERABLE_UPDATED",
  "PROJECT_DELIVERABLE_UPLOADED",
  "PROJECT_DELIVERABLE_REMOVED",
  "PROJECT_DELIVERABLE_APPROVED",
  "PROJECT_DELIVERABLE_REJECTED",
  "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
] as const

export function safeProjectActivitySummary(type: string, summary: string) {
  if (
    type === "STAFFING_APPROVED" &&
    summary.startsWith(
      "The department head approved project staffing. Employee records: ",
    )
  )
    return "The department head updated the project team."
  return summary
}

export async function writeWorkspaceEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  projectId: string,
  userId: string,
  type: string,
  summary: string,
) {
  await tx.workflowEvent.create({
    data: {
      requestId,
      entityId: projectId,
      actorId: userId,
      type,
      summary,
      internal: true,
    },
  })
}
