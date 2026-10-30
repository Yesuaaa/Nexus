import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { parseInboxFilters } from "./request-inbox.schema.js"
import {
  acceptInboxRequest,
  getInboxRequest,
  listInbox,
  requireDepartmentHead,
} from "./request-inbox.service.js"

export const requestInboxRouter = Router()
requestInboxRouter.use(requireAuth, async (request, response, next) => {
  try {
    await requireDepartmentHead(request.auth!.user.id)
    next()
  } catch (error) {
    if (error instanceof ServiceRequestsError)
      return response.status(error.status).json({ error: error.message })
    next(error)
  }
})
requestInboxRouter.get("/", async (request, response) => {
  const filters = parseInboxFilters(request.query)
  if (!filters)
    return response.status(400).json({ error: "Invalid inbox filters" })
  return response.json(await listInbox(request.auth!.user.id, filters))
})
requestInboxRouter.param("id", (request, response, next, id: string) => {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
    return response.status(400).json({ error: "Invalid request id" })
  next()
})
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
requestInboxRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies import("express").ErrorRequestHandler)
