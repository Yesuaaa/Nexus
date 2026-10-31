import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import {
  getClientBooking,
  listClientBookings,
  ServiceRequestsError,
  submitServiceRequest,
} from "./service-requests.service.js"
import { parseServiceRequestFilters } from "./service-requests.schema.js"

export const serviceRequestsRouter = Router()
serviceRequestsRouter.use(requireAuth, requireRole(Role.USER))
serviceRequestsRouter.get("/", async (request, response) => {
  const filters = parseServiceRequestFilters(request.query)
  if (!filters)
    return response
      .status(400)
      .json({ error: "Invalid booked service filters" })
  return response.json(await listClientBookings(request.auth!.user.id, filters))
})
serviceRequestsRouter.get("/:id", async (request, response, next) => {
  const id = String(request.params.id)
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
    return response.status(400).json({ error: "Invalid booked service id" })
  try {
    return response.json({
      serviceRequest: await getClientBooking(request.auth!.user.id, id),
    })
  } catch (error) {
    if (error instanceof ServiceRequestsError)
      return response.status(error.status).json({ error: error.message })
    next(error)
  }
})
serviceRequestsRouter.post("/", async (request, response, next) => {
  try {
    const serviceRequest = await submitServiceRequest(
      request.auth!.user.id,
      request.body,
    )
    response.status(201).json({ serviceRequest })
  } catch (error) {
    if (error instanceof ServiceRequestsError)
      return response.status(error.status).json({ error: error.message })
    next(error)
  }
})
