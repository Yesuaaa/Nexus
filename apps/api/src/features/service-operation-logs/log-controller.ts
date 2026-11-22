import { Router } from "express"
import { Role, type Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import {
  hasAdministrativeCapability,
  AdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"
import { retentionMs } from "./log-retention.js"
import { serviceLogEvents } from "./log-writer.js"
import {
  readServiceLogChanges,
  serviceLogTargetTypes,
} from "./audit-context.js"
import {
  describeServiceLog,
  describeServiceLogDetail,
  matchingDescriptionCodes,
} from "./log-descriptions.js"

export const serviceLogsRouter = Router()
serviceLogsRouter.use(
  requireAuth,
  requireRole(Role.SUPERADMIN),
  (req, _res, next) => {
    if (
      !hasAdministrativeCapability(
        req.auth!.user,
        AdministrativeCapability.MODULE_ACCESS,
      ) ||
      !hasAdministrativeCapability(
        req.auth!.user,
        AdministrativeCapability.ORGANIZATION_READ,
      )
    )
      fail(403, "Service Operations log access is required")
    next()
  },
)
serviceLogsRouter.get("/", async (req, res) => {
  const allowed = [
    "from",
    "to",
    "page",
    "outcome",
    "source",
    "event",
    "actorId",
    "subjectId",
    "requestId",
    "correlationId",
    "search",
  ]
  if (
    Object.entries(req.query).some(
      ([key, value]) =>
        !allowed.includes(key) ||
        typeof value !== "string" ||
        value.length > 80,
    )
  )
    fail(400, "Invalid log filters")
  const q = req.query as Record<string, string | undefined>
  const page = Number(q.page ?? 1)
  const now = new Date()
  const cutoff = new Date(now.getTime() - retentionMs)
  const from = q.from ? new Date(q.from) : cutoff
  const to = q.to ? new Date(q.to) : now
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to
  )
    fail(400, "Invalid log date range or page")
  if (q.outcome && !["SUCCESS", "FAILURE"].includes(q.outcome))
    fail(400, "Invalid outcome")
  if (
    q.source &&
    !["catalog", "requests", "workflow", "workload"].includes(q.source)
  )
    fail(400, "Invalid source")
  if (
    q.event &&
    q.event !== "API_FAILURE" &&
    !Object.hasOwn(serviceLogEvents, q.event)
  )
    fail(400, "Invalid event")
  for (const key of ["actorId", "subjectId", "requestId"] as const)
    if (q[key] && !isRecordId(q[key])) fail(400, "Invalid identity filter")
  if (
    q.correlationId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      q.correlationId,
    )
  )
    fail(400, "Invalid correlation ID")
  const search = q.search?.trim()
  const descriptionCodes = matchingDescriptionCodes(search ?? "")
  const searchIsCorrelationId = Boolean(
    search &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      search,
    ),
  )
  const baseWhere: Prisma.ServiceOperationLogWhereInput = {
    createdAt: { gte: from < cutoff ? cutoff : from, lte: to },
    ...Object.fromEntries(
      [
        "outcome",
        "source",
        "event",
        "actorId",
        "subjectId",
        "requestId",
        "correlationId",
      ]
        .filter((key) => q[key])
        .map((key) => [key, q[key]]),
    ),
  }
  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const matchingCurrentActors = search
        ? await tx.user.findMany({
            where: { fullName: { contains: search, mode: "insensitive" } },
            select: { id: true },
          })
        : []
      const where: Prisma.ServiceOperationLogWhereInput = search
        ? {
            ...baseWhere,
            AND: [
              {
                OR: [
                  { actorName: { contains: search, mode: "insensitive" } },
                  { actorId: { contains: search, mode: "insensitive" } },
                  { subjectId: { contains: search, mode: "insensitive" } },
                  { targetLabel: { contains: search, mode: "insensitive" } },
                  { requestId: { contains: search, mode: "insensitive" } },
                  ...(searchIsCorrelationId
                    ? [{ correlationId: { equals: search } }]
                    : []),
                  { endpoint: { contains: search, mode: "insensitive" } },
                  { event: { contains: search, mode: "insensitive" } },
                  { action: { contains: search, mode: "insensitive" } },
                  { failureCode: { contains: search, mode: "insensitive" } },
                  { failureReason: { contains: search, mode: "insensitive" } },
                  ...(matchingCurrentActors.length
                    ? [
                        {
                          actorId: {
                            in: matchingCurrentActors.map((actor) => actor.id),
                          },
                          actorName: null,
                        },
                      ]
                    : []),
                  ...(descriptionCodes.events.length
                    ? [{ event: { in: descriptionCodes.events } }]
                    : []),
                  ...(descriptionCodes.actions.length
                    ? [{ action: { in: descriptionCodes.actions } }]
                    : []),
                  ...(descriptionCodes.endpoints.length
                    ? [{ endpoint: { in: descriptionCodes.endpoints } }]
                    : []),
                ],
              },
            ],
          }
        : baseWhere
      const total = await tx.serviceOperationLog.count({ where })
      const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 25)))
      const events = await tx.serviceOperationLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * 25,
        take: 25,
        select: {
          id: true,
          event: true,
          endpoint: true,
          action: true,
          source: true,
          outcome: true,
          actorId: true,
          actorName: true,
          actorRole: true,
          subjectId: true,
          targetType: true,
          targetLabel: true,
          changes: true,
          requestId: true,
          correlationId: true,
          status: true,
          failureCode: true,
          failureReason: true,
          createdAt: true,
        },
      })
      const missingActorIds = [
        ...new Set(
          events.flatMap((event) =>
            event.actorId && !event.actorName ? [event.actorId] : [],
          ),
        ),
      ]
      const currentActors = missingActorIds.length
        ? await tx.user.findMany({
            where: { id: { in: missingActorIds } },
            select: { id: true, fullName: true },
          })
        : []
      const currentNames = new Map(
        currentActors.map((actor) => [
          actor.id,
          actor.fullName?.trim() || null,
        ]),
      )
      return {
        events: events.map(({ actorName, ...event }) => {
          const changes = readServiceLogChanges(event.changes)
          const currentName = event.actorId
            ? currentNames.get(event.actorId)
            : undefined
          const currentActorExists = event.actorId
            ? currentNames.has(event.actorId)
            : false
          return {
            ...event,
            failureCode:
              event.event === "API_FAILURE"
                ? (event.failureCode ?? "LEGACY_UNCLASSIFIED")
                : null,
            failureReason:
              event.event === "API_FAILURE"
                ? (event.failureReason ??
                  "A safe cause was not captured for this earlier incident.")
                : null,
            target: {
              id: event.subjectId,
              type:
                event.targetType ??
                (Object.hasOwn(serviceLogTargetTypes, event.event)
                  ? serviceLogTargetTypes[
                      event.event as keyof typeof serviceLogTargetTypes
                    ]
                  : null),
              label: event.targetLabel,
            },
            changes,
            summaryDetail: describeServiceLogDetail(
              changes,
              event.outcome === "FAILURE",
            ),
            message: describeServiceLog(
              event.event,
              event.action,
              event.source,
              event.endpoint,
              event.targetLabel,
              event.event === "API_FAILURE"
                ? (event.failureCode ?? "LEGACY_UNCLASSIFIED")
                : null,
            ),
            actor: {
              id: event.actorId,
              name:
                actorName ??
                currentName ??
                (currentActorExists
                  ? "Account without a display name"
                  : event.actorId
                    ? "Former or unavailable account"
                    : "System"),
              role: event.actorRole,
              attribution: actorName
                ? "RECORDED"
                : currentActorExists
                  ? "CURRENT"
                  : event.actorId
                    ? "UNAVAILABLE"
                    : "SYSTEM",
            },
          }
        }),
        total,
        page: currentPage,
        pageSize: 25,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
  res.json({ ...result, asOf: now, retentionDays: 30 })
})
