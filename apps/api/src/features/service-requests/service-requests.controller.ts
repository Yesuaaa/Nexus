import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { isRecordId } from "../../shared/validation.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import {
  getClientBooking,
  listClientBookings,
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
serviceRequestsRouter.get("/:id", async (request, response) => {
  const id = String(request.params.id)
  if (!isRecordId(id))
    return response.status(400).json({ error: "Invalid booked service id" })
  return response.json({
    serviceRequest: await getClientBooking(request.auth!.user.id, id),
  })
})
serviceRequestsRouter.post("/", async (request, response) => {
  const serviceRequest = await submitServiceRequest(
    request.auth!.user.id,
    request.body,
  )
  response.status(201).json({ serviceRequest })
})
