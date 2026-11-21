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
  "asOf",
  "snapshot",
  "range",
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
      value.length > (key === "snapshot" ? 8192 : 80) ||
      value.includes("\0")
    )
      fail(400, "Invalid log filters")
    query[key] = value
  }

  if (query.snapshot !== undefined) {
    const match = /^(\d{1,20}):(\d{1,20}):((?:\d{1,20}(?:,\d{1,20})*)?)$/.exec(query.snapshot)
    if (!match) fail(400, "Invalid log snapshot")
    const min = BigInt(match[1]), max = BigInt(match[2])
    const active = match[3] ? match[3].split(",").map(value => BigInt(value)) : []
    if (min < 1n || max < min || max > 18446744073709551615n ||
        active.some((xid, index) => xid < min || xid >= max || (index > 0 && xid <= active[index - 1])))
      fail(400, "Invalid log snapshot")
  }
  const to = query.to ? new Date(query.to) : undefined
  const from = query.from ? new Date(query.from) : undefined
  const asOf = query.asOf ? new Date(query.asOf) : undefined
  const page = parsePage(query.page)
  if (
    !page ||
    (from && !Number.isFinite(from.getTime())) ||
    (to && !Number.isFinite(to.getTime())) ||
    (asOf && !Number.isFinite(asOf.getTime()))
  )
    fail(400, "Choose a valid page and a log range of at most 366 days")
  if (
    (query.range && query.range !== "24h" && query.range !== "7d") ||
    (query.event && !Object.hasOwn(eventLabels, query.event)) ||
    (query.source && !sources.has(query.source)) ||
    (query.actorId && !isRecordId(query.actorId)) ||
    (query.subjectId && !isRecordId(query.subjectId)) ||
    (query.operationId && !isUuidV4(query.operationId)) ||
    (query.correlationId && !isUuidV4(query.correlationId))
  )
    fail(400, "Invalid log filters")

  response.json({
    ...(await listWorkforceComplianceLogs({
      ...query,
      from,
      to,
      asOf,
      page,
      rangeDays: query.range === "24h" ? 1 : query.range === "7d" ? 7 : 30,
    })),
    retentionDays: null,
  })
})
