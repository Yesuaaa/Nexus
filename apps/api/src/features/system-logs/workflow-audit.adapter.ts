import { Prisma } from "../../generated/prisma/client.js"
import { readTransaction } from "../../lib/database-read.js"
import {
  assertHistoryObject,
  historyTimestamp,
} from "../../shared/management-history.js"
import { isRecordId } from "../../shared/validation.js"
import type { NormalizedEventV1 } from "./management-event.js"
import type { ManagementFilters, Position } from "./management-query.js"
import { commonWhere, SCAN_CAP } from "./management-history.repository.js"
import { projectSource, projectActions } from "./project-audit.catalog.js"
import { normalizeProjectAudit } from "./project-audit.adapter.js"
import { serviceActions, workflowTypes } from "./service-audit.catalog.js"

type WorkflowRow = {
  id: string
  createdAt: Date
  type: string
  entityId: string | null
  actorId: string | null
  internal: boolean
  requestId: string
}
/** One read per physical source; no summary, documents, amounts or current-state joins. */
export function readWorkflowAudit(
  f: ManagementFilters,
  snapshot: string,
  after: Position | null,
  eventId?: string,
) {
  const types = workflowTypes(f)
  if (f.operationId || !types.length) return Promise.resolve([])
  return readTransaction((tx) =>
    tx.$queryRaw<WorkflowRow[]>(Prisma.sql`
    SELECT id, "createdAt", type,
      CASE WHEN type IN (${Prisma.join(projectActions)}) THEN "entityId" ELSE NULL END AS "entityId",
      "actorId", internal, "requestId" FROM "WorkflowEvent"
    WHERE ${commonWhere(projectSource, f, snapshot, after)}
    AND internal = FALSE AND type IN (${Prisma.join(types)})
    AND (type NOT IN (${Prisma.join(projectActions)}) OR "entityId" IS NOT NULL)
    ${f.subjectId ? Prisma.sql`AND (CASE WHEN type IN (${Prisma.join(projectActions)}) THEN "entityId" ELSE "requestId" END) = ${f.subjectId}` : Prisma.empty}
    ${eventId ? Prisma.sql`AND id = ${eventId}` : Prisma.empty}
    ORDER BY "createdAt" DESC, id COLLATE "C" DESC LIMIT ${eventId ? 1 : SCAN_CAP + 1}`),
  )
}
export function normalizeWorkflowAudit(
  input: unknown,
): NormalizedEventV1 | null {
  try {
    const keys = [
      "id",
      "createdAt",
      "type",
      "entityId",
      "actorId",
      "internal",
      "requestId",
    ]
    assertHistoryObject(input, keys, keys)
    if (
      typeof input.type !== "string" ||
      input.internal !== false ||
      !isRecordId(input.requestId)
    )
      return null
    if (projectActions.some((type) => type === input.type)) {
      const { requestId, ...project } = input
      void requestId
      return normalizeProjectAudit(project)
    }
    if (
      !serviceActions.some((type) => type === input.type) ||
      typeof input.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) ||
      (input.actorId !== null && !isRecordId(input.actorId)) ||
      !(input.createdAt instanceof Date) ||
      !Number.isFinite(input.createdAt.getTime()) ||
      !historyTimestamp(input.createdAt.toISOString())
    )
      return null
    const eventName = `service_request.${input.type.toLowerCase()}`
    return {
      schemaVersion: 1,
      source: projectSource,
      eventId: `${projectSource}:${input.id}`,
      sourceEventId: input.id,
      occurredAt: input.createdAt.toISOString(),
      observedAt: null,
      category: "audit",
      area: "module",
      moduleId: "service-operations",
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
      subject: { type: "service_request", id: input.requestId },
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
        kind: "service",
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
