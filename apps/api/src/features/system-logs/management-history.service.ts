import type { AuthContext } from "../auth/auth.middleware.js"
import {
  readAttendanceAudit,
  normalizeAttendanceAudit,
} from "./attendance-audit.adapter.js"
import { attendanceSource } from "./attendance-audit.catalog.js"
import {
  readWorkflowAudit,
  normalizeWorkflowAudit,
} from "./workflow-audit.adapter.js"
import { projectSource } from "./project-audit.catalog.js"
import { readTransaction } from "../../lib/database-read.js"
import { HttpError } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"
import {
  sources,
  normalizeManagementEvent,
  type NormalizedEventV1,
  type ManagementSource,
} from "./management-event.js"
import {
  comparePositions,
  encodeCursor,
  parseManagementQuery,
  type Position,
} from "./management-query.js"
import {
  SCAN_CAP,
  readAccountHistory,
  readWorkforceHistory,
} from "./management-history.repository.js"

export type SourceStatus = {
  source: ManagementSource
  status: "available" | "unavailable"
  omittedCount: number | null
  reasonCode: "SOURCE_UNAVAILABLE" | "INVALID_RECORD" | "SCAN_CAP" | null
}
async function authorize(auth: AuthContext) {
  if (!auth?.user || !isRecordId(auth.user.id) || !isRecordId(auth.sessionId))
    throw new HttpError(401, "Authentication required")
  let session
  try {
    session = await readTransaction((tx) =>
      tx.session.findFirst({
        where: {
          id: auth.sessionId,
          userId: auth.user.id,
          expiresAt: { gt: new Date() },
        },
        select: {
          user: {
            select: { role: true, isActive: true, accountDeletedAt: true },
          },
        },
      }),
    )
  } catch {
    throw new HttpError(503, "Management history unavailable")
  }
  if (
    !session ||
    !session.user.isActive ||
    session.user.accountDeletedAt !== null
  )
    throw new HttpError(401, "Invalid or expired session")
  if (session.user.role !== "SUPERADMIN")
    throw new HttpError(403, "Insufficient permissions")
}
type Candidate = { source: ManagementSource; row: unknown; position: Position }
const reader = (source: ManagementSource) =>
  source === projectSource
    ? readWorkflowAudit
    : source === attendanceSource
      ? readAttendanceAudit
      : source === sources[0]
        ? readAccountHistory
        : readWorkforceHistory
const normalize = (source: ManagementSource, row: unknown) =>
  source === projectSource
    ? normalizeWorkflowAudit(row)
    : source === attendanceSource
      ? normalizeAttendanceAudit(row)
      : normalizeManagementEvent(source, row)
/** Shared read service; API activation is separately gated. No access emitter. */
export async function listManagementHistory(
  auth: AuthContext,
  input: unknown = {},
) {
  await authorize(auth)
  const query = parseManagementQuery(
    input,
    `${auth.user.id}:${auth.sessionId}`,
    new Date(),
  )
  const { filters, snapshot, after } = query
  const statuses: SourceStatus[] = []
  const candidates: Candidate[] = []
  const frontiers: Position[] = []
  // Separate read transactions isolate source failure; each uses existing read retry.
  for (const source of filters.sources) {
    try {
      const rows = await reader(source)(filters, snapshot, after)
      const status: SourceStatus = {
        source,
        status: "available",
        omittedCount: 0,
        reasonCode: null,
      }
      statuses.push(status)
      for (const row of rows.slice(0, SCAN_CAP)) {
        const position = {
          time: row.createdAt.toISOString(),
          source,
          id: row.id,
        }
        candidates.push({ source, row, position })
      }
      if (rows.length > SCAN_CAP)
        frontiers.push(candidates[candidates.length - 1].position)
    } catch {
      statuses.push({
        source,
        status: "unavailable",
        omittedCount: null,
        reasonCode: "SOURCE_UNAVAILABLE",
      })
    }
  }
  candidates.sort((a, b) => comparePositions(a.position, b.position))
  frontiers.sort(comparePositions)
  const frontier = frontiers[0]
  const events: NormalizedEventV1[] = [],
    seen = new Set<string>()
  let last: Position | null = null,
    more = frontiers.length > 0
  for (const candidate of candidates) {
    // Never pass the unscanned portion of another source.
    if (frontier && comparePositions(candidate.position, frontier) > 0) break
    const event = normalize(candidate.source, candidate.row)
    if (event && events.length === filters.pageSize) {
      more = true
      break
    }
    last = candidate.position
    if (!event) {
      const status = statuses.find((s) => s.source === candidate.source)!
      status.omittedCount = (status.omittedCount ?? 0) + 1
      if (status.reasonCode !== "SCAN_CAP") status.reasonCode = "INVALID_RECORD"
    } else if (!seen.has(event.eventId)) {
      seen.add(event.eventId)
      events.push(event)
    }
  }
  if (frontier && last && comparePositions(last, frontier) === 0) {
    statuses.find((s) => s.source === frontier.source)!.reasonCode = "SCAN_CAP"
  }
  const failed = statuses.some((s) => s.status === "unavailable")
  // Retrying a partial failure starts at the same input cursor; advancing could lose
  // recovered events. Callers must not treat these partial events as a complete page.
  const nextCursor =
    !failed && more && last && last.id.length <= 100
      ? encodeCursor({
          version: 1,
          fingerprint: query.fingerprint,
          snapshot,
          after: last,
          from: filters.from,
          to: filters.to,
          expires: query.expires,
        })
      : null
  const groups = new Map<string, NormalizedEventV1[]>()
  for (const event of events) {
    const id = event.correlation.operationId
    if (id === null) continue
    groups.set(id, [...(groups.get(id) ?? []), event])
  }
  return {
    schemaVersion: 1 as const,
    events,
    nextCursor,
    snapshotBoundary: snapshot,
    sources: statuses,
    complete: statuses.every(
      (s) => s.status === "available" && s.reasonCode === null,
    ),
    grouping: {
      scope: "page" as const,
      eventCount: events.length,
      operationCount: groups.size,
      ungroupedEventCount: events.filter(
        (event) => event.correlation.operationId === null,
      ).length,
      operations: [...groups].map(([operationId, rows]) => ({
        operationId,
        eventIds: rows.map((r) => r.eventId),
        eventCount: rows.length,
      })),
    },
  }
}

/** Detail uses the same validation/auth/projection boundary, not raw findUnique. */
export async function getManagementHistoryEvent(
  auth: AuthContext,
  source: ManagementSource,
  sourceEventId: string,
  range: { from?: string; to?: string } = {},
) {
  await authorize(auth)
  if (
    !sources.includes(source) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(sourceEventId)
  )
    throw new HttpError(400, "Invalid management history query")
  const query = parseManagementQuery(
    { ...range, source },
    `${auth.user.id}:${auth.sessionId}`,
    new Date(),
  )
  try {
    const rows = await reader(source)(
      query.filters,
      query.snapshot,
      null,
      sourceEventId,
    )
    const event = rows.length ? normalize(source, rows[0]) : null
    return {
      event,
      status: "available" as const,
      reasonCode: rows.length && !event ? ("INVALID_RECORD" as const) : null,
    }
  } catch {
    return {
      event: null,
      status: "unavailable" as const,
      reasonCode: "SOURCE_UNAVAILABLE" as const,
    }
  }
}
