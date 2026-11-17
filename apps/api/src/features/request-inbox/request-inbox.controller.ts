import { Router } from "express"
import { recordIdParam } from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import { parseInboxFilters } from "./request-inbox.schema.js"
import {
  acceptInboxRequest,
  getInboxRequest,
  listInbox,
  requireDepartmentHead,
} from "./request-inbox.service.js"

export const requestInboxRouter = Router()
requestInboxRouter.use(requireAuth, async (request, _response, next) => {
  await requireDepartmentHead(request.auth!.user.id)
  next()
})
requestInboxRouter.get("/", async (request, response) => {
  const filters = parseInboxFilters(request.query)
  if (!filters)
    return response.status(400).json({ error: "Invalid inbox filters" })
  return response.json(await listInbox(request.auth!.user.id, filters))
})
requestInboxRouter.param("id", recordIdParam("Invalid request id"))
requestInboxRouter.get("/:id", async (request, response) => {
  response.json({
    serviceRequest: await getInboxRequest(
      request.auth!.user.id,
      String(request.params.id),
    ),
  })
})
requestInboxRouter.post("/:id/accept", async (request, response) => {
  response.json({
    serviceRequest: await acceptInboxRequest(
      request.auth!.user.id,
      String(request.params.id),
    ),
  })
})
