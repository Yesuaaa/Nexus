import {
  assertHistoryObject,
  historyTimestamp,
} from "../../shared/management-history.js"
import { isRecordId } from "../../shared/validation.js"
import type { NormalizedEventV1 } from "./management-event.js"
import { projectSource, projectActions } from "./project-audit.catalog.js"

export function normalizeProjectAudit(
  input: unknown,
): NormalizedEventV1 | null {
  try {
    const keys = ["id", "createdAt", "type", "entityId", "actorId", "internal"]
    assertHistoryObject(input, keys, keys)
    if (
      typeof input.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) ||
      !(input.createdAt instanceof Date) ||
      !Number.isFinite(input.createdAt.getTime()) ||
      !historyTimestamp(input.createdAt.toISOString()) ||
      typeof input.type !== "string" ||
      !projectActions.some((type) => type === input.type) ||
      !isRecordId(input.entityId) ||
      (input.actorId !== null && !isRecordId(input.actorId)) ||
      input.internal !== false
    )
      return null
    const eventName = `project.${input.type.toLowerCase()}`
    return {
      schemaVersion: 1,
      source: projectSource,
      eventId: `${projectSource}:${input.id}`,
      sourceEventId: input.id,
      occurredAt: input.createdAt.toISOString(),
      observedAt: null,
      category: "audit",
      area: "module",
      moduleId: "project-management",
      relatedModuleIds: [],
      eventName,
      sourceAction: input.type,
      severity: "info",
      outcome: "succeeded",
      actor: {
        kind: input.actorId === null ? "unknown" : "account",
        accountId: input.actorId,
        roleAtTime: null,
        roleEvidence: "not-recorded",
      },
      subject: { type: "project", id: input.entityId },
      correlation: {
        operationId: null,
        httpRequestId: null,
        traceId: null,
        workflowActionId: null,
        businessRequestId: null,
        projectId: null,
        workdayId: null,
        jobRunId: null,
      },
      summaryKey: eventName,
      details: {
        kind: "project",
        origin: null,
        changedFields: [],
        transitions: {},
        sessionsRevoked: null,
      },
    }
  } catch {
    return null
  }
}
