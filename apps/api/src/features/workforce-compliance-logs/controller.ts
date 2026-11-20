import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { fail } from "../../shared/http-error.js"
import { parsePage } from "../../shared/query/pagination.js"
import { isRecordId, isUuidV4 } from "../../shared/validation.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { eventLabels, sources } from "./projection.js"
import { listWorkforceComplianceLogs } from "./repository.js"

const filters = new Set([
  "from",
  "to",
  "page",
  "event",
  "source",
  "search",
  "actorId",
  "subjectId",
  "operationId",
  "correlationId",
])

export const workforceComplianceLogsRouter = Router()
workforceComplianceLogsRouter.use(requireAuth, requireRole(Role.SUPERADMIN))
workforceComplianceLogsRouter.get("/", async (request, response) => {
  const user = request.auth!.user
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
    fail(403, "Workforce Compliance log access is required")

  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(request.query)) {
    if (
      !filters.has(key) ||
      typeof value !== "string" ||
      value.length > 80 ||
      value.includes("\0")
    )
      fail(400, "Invalid log filters")
    query[key] = value
  }

  const to = query.to ? new Date(query.to) : undefined
  const from = query.from ? new Date(query.from) : undefined
  const page = parsePage(query.page)
  if (
    !page ||
    (from && !Number.isFinite(from.getTime())) ||
    (to && !Number.isFinite(to.getTime()))
  )
    fail(400, "Choose a valid page and a log range of at most 366 days")
  if (
    (query.event && !Object.hasOwn(eventLabels, query.event)) ||
    (query.source && !sources.has(query.source)) ||
    (query.actorId && !isRecordId(query.actorId)) ||
    (query.subjectId && !isRecordId(query.subjectId)) ||
    (query.operationId && !isUuidV4(query.operationId)) ||
    (query.correlationId && !isUuidV4(query.correlationId))
  )
    fail(400, "Invalid log filters")

  response.json({
    ...(await listWorkforceComplianceLogs({ ...query, from, to, page })),
    retentionDays: null,
  })
})
