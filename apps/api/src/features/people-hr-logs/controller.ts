import { Router } from "express"
import {
  AccountManagementAction,
  Role,
  WorkforceManagementAction,
  WorkforceManagementOrigin,
} from "../../generated/prisma/client.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId, isUuidV4 } from "../../shared/validation.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { listPeopleHrLogs } from "./repository.js"

const actions = new Set<string>([
  ...Object.values(WorkforceManagementAction),
  AccountManagementAction.ARCHIVED,
])
const sources = new Set<string>([
  WorkforceManagementOrigin.EMPLOYEE_MANAGEMENT,
  WorkforceManagementOrigin.DEPARTMENT_MANAGEMENT,
  WorkforceManagementOrigin.TEAM_MANAGEMENT,
])
const filters = new Set([
  "from",
  "to",
  "source",
  "event",
  "actorId",
  "subjectId",
  "operationId",
  "search",
  "page",
])
export const peopleHrLogsRouter = Router()
peopleHrLogsRouter.use(requireAuth, requireRole(Role.SUPERADMIN))

peopleHrLogsRouter.get("/", async (request, response) => {
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
    fail(403, "People & HR log access is required")

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

  const asOf = new Date()
  const from = query.from ? new Date(query.from) : undefined
  const to = query.to ? new Date(query.to) : undefined
  const page = Number(query.page ?? 1)
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100_000 ||
    (from && !Number.isFinite(from.getTime())) ||
    (to && !Number.isFinite(to.getTime())) ||
    (from && to && from > to)
  )
    fail(400, "Invalid log date range or page")
  if (
    (query.source && !sources.has(query.source)) ||
    (query.event && !actions.has(query.event)) ||
    (query.actorId && !isRecordId(query.actorId)) ||
    (query.subjectId && !isRecordId(query.subjectId)) ||
    (query.operationId && !isUuidV4(query.operationId))
  )
    fail(400, "Invalid log filters")

  response.json({
    ...(await listPeopleHrLogs({
      ...query,
      from,
      to: to && to < asOf ? to : asOf,
      page,
    })),
    asOf,
    retentionDays: null,
  })
})
