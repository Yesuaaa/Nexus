import { Router } from "express"
import { Role, type Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { containsText } from "../../shared/query/pagination.js"
import { isRecordId } from "../../shared/validation.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { retentionMs } from "../service-operation-logs/log-retention.js"
import {
  describeProjectActivity,
  isProjectLogEvent,
  projectLogEvents,
  readProjectLogChanges,
} from "./events.js"
import {
  projectIncidentMessage,
  projectIncidentOperations,
} from "./incidents.js"

const identityFilters = [
  "actorId",
  "projectId",
  "workspaceId",
  "subjectId",
  "requestId",
] as const
const exactFilters = [
  "outcome",
  "source",
  "event",
  "actorId",
  "projectId",
  "workspaceId",
  "requestId",
  "correlationId",
] as const
const allowed = new Set<string>([
  ...exactFilters,
  "subjectId",
  "from",
  "to",
  "page",
  "search",
])
const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const pageSize = 25

export const projectLogsRouter = Router()
projectLogsRouter.use(
  requireAuth,
  requireRole(Role.SUPERADMIN),
  (req, _res, next) => {
    const user = req.auth!.user
    if (
      !hasAdministrativeCapability(
        user,
        AdministrativeCapability.MODULE_ACCESS,
      ) ||
      !hasAdministrativeCapability(
        user,
        AdministrativeCapability.ORGANIZATION_READ,
      )
    )
      fail(403, "Project Management log access is required")
    next()
  },
)

projectLogsRouter.get("/", async (req, res) => {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (!allowed.has(key) || typeof value !== "string" || value.length > 80)
      fail(400, "Invalid log filters")
    query[key] = value
  }

  const asOf = new Date()
  const cutoff = new Date(asOf.getTime() - retentionMs)
  const from = query.from ? new Date(query.from) : cutoff
  const to = query.to ? new Date(query.to) : asOf
  const page = Number(query.page ?? 1)
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to
  )
    fail(400, "Invalid log date range or page")
  if (query.outcome && !["SUCCESS", "FAILURE"].includes(query.outcome))
    fail(400, "Invalid outcome")
  if (
    query.source &&
    !["workspace", "planning", "deliverables", "client"].includes(query.source)
  )
    fail(400, "Invalid area")
  if (
    query.event &&
    query.event !== "API_FAILURE" &&
    !isProjectLogEvent(query.event)
  )
    fail(400, "Invalid event")
  if (identityFilters.some((key) => query[key] && !isRecordId(query[key])))
    fail(400, "Invalid identity filter")
  if (query.correlationId && !uuidPattern.test(query.correlationId))
    fail(400, "Invalid correlation ID")

  const search = query.search?.trim()
  const where: Prisma.ProjectManagementLogWhereInput = {
    createdAt: {
      gte: from < cutoff ? cutoff : from,
      lte: to > asOf ? asOf : to,
    },
    ...Object.fromEntries(
      exactFilters.filter((key) => query[key]).map((key) => [key, query[key]]),
    ),
    targetId: query.subjectId || undefined,
  }
  if (search) {
    const matches = containsText(search)
    const needle = search.toLowerCase()
    const events = Object.keys(projectLogEvents).filter(
      (event) =>
        isProjectLogEvent(event) &&
        projectLogEvents[event].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    )
    const endpoints = Object.keys(projectIncidentOperations).filter(
      (endpoint) =>
        projectIncidentMessage(endpoint).toLowerCase().includes(needle),
    )
    if (projectIncidentMessage(null).toLowerCase().includes(needle))
      events.push("API_FAILURE")
    where.OR = [
      { projectId: matches },
      { projectName: matches },
      { workspaceId: matches },
      { targetId: matches },
      { targetLabel: matches },
      { actorId: matches },
      { actorName: matches },
      { requestId: matches },
      { event: matches },
      { endpoint: matches },
      { source: matches },
      { failureCode: matches },
      { failureReason: matches },
      ...(uuidPattern.test(search) ? [{ correlationId: search }] : []),
      ...(events.length ? [{ event: { in: events } }] : []),
      ...(endpoints.length
        ? [{ outcome: "FAILURE" as const, endpoint: { in: endpoints } }]
        : []),
    ]
  }

  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const total = await tx.projectManagementLog.count({ where })
      const currentPage = Math.min(
        page,
        Math.max(1, Math.ceil(total / pageSize)),
      )
      const rows = await tx.projectManagementLog.findMany({
        where,
        select: {
          id: true,
          event: true,
          source: true,
          outcome: true,
          actorId: true,
          actorName: true,
          actorRole: true,
          projectId: true,
          projectName: true,
          workspaceId: true,
          targetId: true,
          targetLabel: true,
          requestId: true,
          changes: true,
          endpoint: true,
          correlationId: true,
          status: true,
          failureCode: true,
          failureReason: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      })
      const events = rows.map(
        ({ actorName, targetId, targetLabel, changes, ...row }) => {
          const details = isProjectLogEvent(row.event)
            ? projectLogEvents[row.event]
            : undefined
          const safeChanges = readProjectLogChanges(changes)
          const transition = safeChanges.find(
            ({ field, before, after }) =>
              (field === "Status" || field === "Name") &&
              typeof before === "string" &&
              typeof after === "string",
          )
          const detail = transition
            ? `${transition.before} → ${transition.after}`
            : row.event === "PLAN_UPDATED" ||
                row.event === "DELIVERABLE_UPDATED"
              ? safeChanges.map(({ field }) => field).join(", ")
              : null
          const summaryDetail =
            row.outcome === "FAILURE"
              ? row.failureReason
              : [
                  row.projectName &&
                  (row.projectName !== targetLabel ||
                    row.event.endsWith("_REQUEST_REVIEWED"))
                    ? `Project “${row.projectName}”`
                    : null,
                  detail,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
          return {
            ...row,
            action: null,
            subjectId: targetId,
            actor: {
              id: row.actorId,
              name:
                actorName ??
                (row.actorId
                  ? "Account without a display name"
                  : "Actor unavailable"),
              role: row.actorRole,
              attribution: row.actorId ? "RECORDED" : "UNKNOWN",
            },
            target: {
              id: targetId,
              label: targetLabel,
              type: details?.[1] ?? null,
            },
            changes: safeChanges,
            message:
              row.outcome === "FAILURE"
                ? projectIncidentMessage(row.endpoint)
                : describeProjectActivity(row.event, targetLabel, safeChanges),
            summaryDetail,
          }
        },
      )
      return { events, total, page: currentPage }
    },
    { isolationLevel: "RepeatableRead" },
  )
  res.json({ ...result, pageSize, asOf, retentionDays: 30 })
})
