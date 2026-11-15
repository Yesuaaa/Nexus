import { Router } from "express"
import { fail } from "../../shared/http-error.js"
import { parsePage } from "../../shared/query/pagination.js"
import { recordIdParam } from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import {
  getAdministrativeConversation,
  listAdministrativeConversations,
  type BusinessConversationKind,
} from "./administrative-conversations.service.js"

function parseKind(value: unknown): BusinessConversationKind {
  if (value !== "service" && value !== "project")
    fail(400, "Invalid business conversation type")
  return value
}

export const administrativeConversationsRouter = Router()
administrativeConversationsRouter.use(
  requireAuth,
  (request, _response, next) => {
    const actor = request.auth!.user
    if (
      !hasAdministrativeCapability(
        actor,
        AdministrativeCapability.ORGANIZATION_READ,
      ) ||
      !hasAdministrativeCapability(
        actor,
        AdministrativeCapability.BUSINESS_CONVERSATION_INSPECTION,
      )
    )
      fail(403, "Business conversation metadata inspection is required")
    next()
  },
)
administrativeConversationsRouter.get("/", async (request, response) => {
  const kind = parseKind(request.query.kind ?? "service")
  const { search = "", departmentId = "" } = request.query
  const page = parsePage(request.query.page)
  if (
    typeof search !== "string" ||
    search.length > 100 ||
    typeof departmentId !== "string" ||
    departmentId.length > 80 ||
    !page
  )
    fail(400, "Invalid conversation filters")
  response.json(
    await listAdministrativeConversations({
      kind,
      search: search.trim(),
      departmentId,
      page,
    }),
  )
})
administrativeConversationsRouter.param(
  "id",
  recordIdParam("Invalid conversation ID"),
)
administrativeConversationsRouter.get(
  "/:kind/:id",
  async (request, response) => {
    const kind = parseKind(request.params.kind)
    const page = parsePage(request.query.page)
    if (!page) fail(400, "Invalid linked record page")
    response.json(
      await getAdministrativeConversation(
        kind,
        String(request.params.id),
        page,
      ),
    )
  },
)
