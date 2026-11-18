import { randomUUID } from "node:crypto"
import type { Prisma } from "../../generated/prisma/client.js"
import { ActivityLogWriteError } from "../../shared/activity-log-write-error.js"
import { isRecordId } from "../../shared/validation.js"
import {
  logContext,
  serviceLogEndpoint,
} from "../service-operation-logs/log-context.js"
import {
  auditLabel,
  encodeProjectLogChanges,
  projectLogEvents,
  type ProjectLogChanges,
  type ProjectLogEvent,
} from "./events.js"

export class ProjectManagementLogWriteError extends ActivityLogWriteError {
  constructor(cause: unknown) {
    super("Project Management", cause)
  }
}

export async function writeProjectLog(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  event: ProjectLogEvent,
  changes: ProjectLogChanges,
  target?: { id: string; label?: string | null },
) {
  const context = logContext.getStore()
  try {
    if (target && !isRecordId(target.id))
      throw new Error("Invalid project log target")
    const actor = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true, role: true },
    })
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        name: true,
        requestId: true,
        workspaceGroupId: true,
        workspaceGroup: { select: { name: true } },
      },
    })
    const workspaceEvent = projectLogEvents[event][1] === "Workspace"
    const workspaceId = project.workspaceGroupId ?? projectId
    await tx.projectManagementLog.create({
      data: {
        event,
        source: projectLogEvents[event][0],
        outcome: "SUCCESS",
        actorId: userId,
        actorName: auditLabel(actor.fullName, 100),
        actorRole: actor.role,
        projectId,
        projectName: auditLabel(project.name),
        workspaceId,
        targetId: target?.id ?? (workspaceEvent ? workspaceId : projectId),
        targetLabel: auditLabel(
          target?.label ??
            (workspaceEvent
              ? (project.workspaceGroup?.name ?? project.name)
              : project.name),
        ),
        requestId: project.requestId,
        changes: encodeProjectLogChanges(changes),
        endpoint: context ? serviceLogEndpoint(context.request) : undefined,
        correlationId: context?.correlationId ?? randomUUID(),
      },
    })
  } catch (error) {
    throw new ProjectManagementLogWriteError(error)
  }
}
