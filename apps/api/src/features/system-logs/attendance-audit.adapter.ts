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
import {
  attendanceSource,
  attendanceActions,
  attendanceActionSupported,
  attendanceSubjects,
} from "./attendance-audit.catalog.js"

type AttendanceRow = {
  id: string
  entityType: string
  entityId: string
  actorId: string | null
  action: string
  createdAt: Date
}
/** Metadata only: raw snapshots/reason/employee/workday/action IDs never leave SQL. */
export function readAttendanceAudit(
  f: ManagementFilters,
  snapshot: string,
  after: Position | null,
  eventId?: string,
) {
  if (f.operationId || (f.moduleId && f.moduleId !== "attendance-monitoring"))
    return Promise.resolve([])
  const entityTypes = Object.entries(attendanceSubjects)
    .filter(
      ([, subject]) =>
        (!f.subjectType || f.subjectType === subject) &&
        (!f.eventName || f.eventName.startsWith(`${subject}.`)),
    )
    .map(([entity]) => entity)
  if (!entityTypes.length) return Promise.resolve([])
  const action = f.action ?? f.eventName?.split(".")[1].toUpperCase()
  return readTransaction((tx) =>
    tx.$queryRaw<AttendanceRow[]>(Prisma.sql`
    SELECT id, "entityType", "entityId", "actorId", action, "createdAt" FROM "AttendanceAudit"
    WHERE ${commonWhere(attendanceSource, f, snapshot, after)}
    AND "entityType" IN (${Prisma.join(entityTypes)})
    AND action IN (${Prisma.join(attendanceActions)})
    AND ("entityType" <> 'AttendanceWorkday' OR action <> 'DELETE')
    ${eventId ? Prisma.sql`AND id = ${eventId}` : Prisma.empty}
    ${f.subjectId ? Prisma.sql`AND "entityId" = ${f.subjectId}` : Prisma.empty}
    ${action ? Prisma.sql`AND action = ${action}` : Prisma.empty}
    ORDER BY "createdAt" DESC, id COLLATE "C" DESC LIMIT ${eventId ? 1 : SCAN_CAP + 1}`),
  )
}
export function normalizeAttendanceAudit(
  input: unknown,
): NormalizedEventV1 | null {
  try {
    const keys = [
      "id",
      "entityType",
      "entityId",
      "actorId",
      "action",
      "createdAt",
    ]
    assertHistoryObject(input, keys, keys)
    if (
      typeof input.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) ||
      typeof input.entityType !== "string" ||
      !Object.hasOwn(attendanceSubjects, input.entityType) ||
      typeof input.entityId !== "string" ||
      !/^[A-Za-z0-9_:-]{1,100}$/.test(input.entityId) ||
      (input.actorId !== null && !isRecordId(input.actorId)) ||
      typeof input.action !== "string" ||
      !attendanceActionSupported(input.entityType, input.action) ||
      !(input.createdAt instanceof Date) ||
      !Number.isFinite(input.createdAt.getTime()) ||
      !historyTimestamp(input.createdAt.toISOString())
    )
      return null
    const eventName = `${attendanceSubjects[input.entityType as keyof typeof attendanceSubjects]}.${input.action.toLowerCase()}`
    return {
      schemaVersion: 1,
      eventId: `${attendanceSource}:${input.id}`,
      source: attendanceSource,
      sourceEventId: input.id,
      occurredAt: input.createdAt.toISOString(),
      observedAt: null,
      category: "audit",
      area: "module",
      moduleId: "attendance-monitoring",
      relatedModuleIds: [],
      eventName,
      sourceAction: input.action,
      severity: "info",
      outcome: "succeeded",
      actor: {
        kind: input.actorId === null ? "unknown" : "account",
        accountId: input.actorId,
        roleAtTime: null,
        roleEvidence: "not-recorded",
      },
      subject: {
        type: attendanceSubjects[
          input.entityType as keyof typeof attendanceSubjects
        ],
        id: input.entityId,
      },
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
        kind: "attendance",
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
