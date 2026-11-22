import { createHash } from "node:crypto"
import { Prisma, type Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { presentWorkforceComplianceLogs } from "./projection.js"
import {
  maxSearchGroups,
  readLogWindow,
  saveLogWindow,
} from "./pagination-window.js"

type LogFilters = {
  from?: Date
  to?: Date
  snapshot?: string
  asOf?: Date
  rangeDays: number
  page: number
  source?: string
  event?: string
  actorId?: string
  subjectId?: string
  operationId?: string
  correlationId?: string
  search?: string
}

export type ComplianceHistoryRow = {
  id: string
  groupId: string
  operationId: string | null
  correlationId: string | null
  actorId: string | null
  actorName: string | null
  actorRoleAtTime: Role | null
  employeeId: string | null
  employeeName: string | null
  subjectId: string
  entityType: string
  source: string
  event: string
  before: Prisma.JsonValue
  after: Prisma.JsonValue
  createdAt: Date
}

function history(from: Date, to: Date, asOf: Date, snapshot: string) {
  return Prisma.sql`
    SELECT a.id, coalesce(a."operationId"::text, 'attendance:' || a.id) AS "groupId",
      a."operationId", a."correlationId", a."actorRoleAtTime", a."actorId",
      a."employeeId", a."entityId" AS "subjectId", a."entityType",
      CASE WHEN a."entityType" = 'AttendanceAdjustment' THEN
          CASE WHEN coalesce(a.after, a.before)->>'type' = 'OVERTIME'
            THEN 'overtime' ELSE 'corrections' END
        WHEN a."entityType" IN ('AttendancePolicy', 'AttendancePolicyDay', 'AttendancePolicyAssignment')
          THEN 'policies'
        ELSE 'time-logs'
      END AS source,
      CASE
        WHEN a."entityType" = 'AttendanceAdjustment' AND a.action = 'INSERT'
          AND a.after->>'status' = 'PENDING' THEN 'SUBMITTED'
        WHEN a."entityType" = 'AttendanceAdjustment' AND a.action = 'UPDATE'
          AND a.before->>'status' IS DISTINCT FROM a.after->>'status'
          AND a.after->>'status' IN ('VERIFIED', 'APPROVED', 'REJECTED') THEN a.after->>'status'
        WHEN a."entityType" = 'AttendancePolicy' AND a.action = 'UPDATE'
          AND a.before->>'archivedAt' IS NULL AND a.after->>'archivedAt' IS NOT NULL THEN 'ARCHIVED'
        WHEN a."entityType" = 'AttendancePolicy' AND a.action = 'UPDATE'
          AND a.before->>'archivedAt' IS NOT NULL AND a.after->>'archivedAt' IS NULL THEN 'RESTORED'
        WHEN a."entityType" = 'AttendancePolicyAssignment' AND a.action = 'UPDATE'
          AND a.before->>'cancelledAt' IS NULL AND a.after->>'cancelledAt' IS NOT NULL THEN 'CANCELLED'
        WHEN a.action = 'INSERT' THEN 'CREATED'
        WHEN a.action = 'DELETE' THEN 'DELETED'
        ELSE 'UPDATED'
      END AS event,
      a.before, a.after, a."createdAt"
    FROM "AttendanceAudit" a
    WHERE a."createdAt" BETWEEN ${from.toISOString()}::timestamptz AND ${to.toISOString()}::timestamptz
      AND a."createdAt" < ${asOf.toISOString()}::timestamptz
      AND (a."writerTransaction" IS NULL OR pg_visible_in_snapshot(a."writerTransaction"::xid8, ${snapshot}::pg_snapshot))
      AND a.before IS DISTINCT FROM a.after
    UNION ALL
    SELECT d.id, coalesce(d."operationId"::text, 'leave:' || d.id),
      d."operationId", d."correlationId", d."actorRoleAtTime", d."actorId",
      r."employeeId", d."requestId", 'LeaveRequest', 'leave', d.action::text,
      jsonb_build_object('status', d."fromStatus"), jsonb_build_object('status', d."toStatus"), d."createdAt"
    FROM "LeaveDecision" d JOIN "LeaveRequest" r ON r.id = d."requestId"
    WHERE d."createdAt" BETWEEN ${from.toISOString()}::timestamptz AND ${to.toISOString()}::timestamptz
      AND d."createdAt" < ${asOf.toISOString()}::timestamptz
      AND (d."writerTransaction" IS NULL OR pg_visible_in_snapshot(d."writerTransaction"::xid8, ${snapshot}::pg_snapshot))
  `
}

const names = Prisma.sql`
  LEFT JOIN "User" actor ON actor.id = h."actorId" AND strpos(actor."fullName", '@') = 0
  LEFT JOIN "Employee" employee ON employee.id = h."employeeId" AND strpos(employee."fullName", '@') = 0
`
const pageSize = 25
const day = 24 * 60 * 60 * 1000

export async function listWorkforceComplianceLogs(
  sessionId: string,
  filters: LogFilters,
) {
  const conditions: Prisma.Sql[] = []
  if (filters.source) conditions.push(Prisma.sql`h.source = ${filters.source}`)
  if (filters.event) conditions.push(Prisma.sql`h.event = ${filters.event}`)
  if (filters.actorId)
    conditions.push(Prisma.sql`h."actorId" = ${filters.actorId}`)
  if (filters.subjectId)
    conditions.push(Prisma.sql`h."subjectId" = ${filters.subjectId}`)
  if (filters.operationId)
    conditions.push(Prisma.sql`h."operationId" = ${filters.operationId}::uuid`)
  if (filters.correlationId)
    conditions.push(
      Prisma.sql`h."correlationId" = ${filters.correlationId}::uuid`,
    )
  const search = filters.search?.trim()
  if (search)
    conditions.push(Prisma.sql`
    (
      lower(h.source) = lower(${search})
      OR strpos(lower(concat_ws(' ', actor."fullName", employee."fullName", h."actorId", h."employeeId",
        h."subjectId", h."operationId", h."correlationId", h.event, replace(h.source, '-', ' '))),
        lower(${search})) > 0
    )
  `)

  const scope = createHash("sha256")
    .update(
      JSON.stringify([
        sessionId,
        filters.from,
        filters.to,
        filters.rangeDays,
        filters.source,
        filters.event,
        filters.actorId,
        filters.subjectId,
        filters.operationId,
        filters.correlationId,
        search,
      ]),
    )
    .digest("base64url")
  const existingWindow = filters.snapshot
    ? readLogWindow(filters.snapshot, scope, filters.asOf)
    : undefined
  const { window, ...result } = await getPrisma()!.$transaction(
    async (tx) => {
      const window = existingWindow ?? (await newLogWindow(tx, scope, filters))
      const rowsInRange = history(
        window.from,
        window.to,
        window.asOf,
        window.sourceSnapshot,
      )
      const matched = Prisma.sql`
        SELECT h."groupId", max(h."createdAt") AS "createdAt"
        FROM (${rowsInRange}) h
        ${search ? names : Prisma.empty}
        ${conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
        GROUP BY h."groupId"
      `
      // Materialize text matches once. The joins below are only for display
      // when opening a page of an existing search window.
      let matchingIds = existingWindow?.matchingIds
      if (search && !existingWindow) {
        const matches = await tx.$queryRaw<{ groupId: string }[]>`
          SELECT "groupId" FROM (${matched}) groups
          ORDER BY "createdAt" DESC, "groupId" DESC
          LIMIT ${maxSearchGroups + 1}
        `
        if (matches.length > maxSearchGroups)
          fail(
            422,
            "Too many logs match. Narrow your search or choose a shorter time range.",
          )
        matchingIds = matches.map(({ groupId }) => groupId)
      }
      const result = matchingIds
        ? sliceLogPage(matchingIds, filters.page)
        : await queryLogPage(tx, matched, filters.page)
      const rows = result.ids.length
        ? await tx.$queryRaw<ComplianceHistoryRow[]>`
          SELECT h.*, left(actor."fullName", 100) AS "actorName", left(employee."fullName", 100) AS "employeeName"
          FROM (${rowsInRange}) h
          ${names}
          WHERE h."groupId" IN (${Prisma.join(result.ids)})
          ORDER BY h."createdAt" DESC, h.id DESC
        `
        : []
      return {
        window: { ...window, matchingIds },
        asOf: window.asOf,
        events: presentWorkforceComplianceLogs(result.ids, rows),
        total: result.total,
        page: result.page,
        pageSize,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
  return { ...result, snapshot: filters.snapshot ?? saveLogWindow(window) }
}

async function newLogWindow(
  tx: Prisma.TransactionClient,
  scope: string,
  filters: LogFilters,
) {
  const [{ now, sourceSnapshot }] = await tx.$queryRaw<
    { now: Date; sourceSnapshot: string }[]
  >`
    SELECT date_trunc('milliseconds', CURRENT_TIMESTAMP) AS now, pg_current_snapshot()::text AS "sourceSnapshot"
  `
  const asOf = filters.asOf && filters.asOf < now ? filters.asOf : now
  const to = filters.to && filters.to < asOf ? filters.to : asOf
  const from = filters.from ?? new Date(to.getTime() - filters.rangeDays * day)
  if (from > to || to.getTime() - from.getTime() > 366 * day)
    fail(400, "Choose a log range of at most 366 days")
  return { scope, asOf, from, to, sourceSnapshot }
}

function sliceLogPage(ids: string[], requestedPage: number) {
  const total = ids.length
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))
  return { total, page, ids: ids.slice((page - 1) * pageSize, page * pageSize) }
}

async function queryLogPage(
  tx: Prisma.TransactionClient,
  matched: Prisma.Sql,
  page: number,
) {
  const [result] = await tx.$queryRaw<
    { total: number; page: number; ids: string[] }[]
  >`
    WITH matched AS (${matched}), pagination AS (
      SELECT count(*)::int AS total,
        least(${page}::int, greatest(1, ceil(count(*)::numeric / ${pageSize})))::int AS page
      FROM matched
    )
    SELECT total, page, ARRAY(
      SELECT "groupId" FROM matched ORDER BY "createdAt" DESC, "groupId" DESC
      LIMIT ${pageSize} OFFSET (pagination.page - 1) * ${pageSize}
    ) AS ids FROM pagination
  `
  return result
}
