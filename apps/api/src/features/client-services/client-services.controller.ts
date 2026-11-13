import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { clientServicesService } from "./client-services.service.js"
import { parseClientRequestFilters } from "./client-services.schema.js"
import { submitServiceRequest } from "../service-requests/service-requests.service.js"

export const clientServicesRouter = Router()

// All routes here are restricted to authenticated Client accounts (Role.USER)
clientServicesRouter.use(requireAuth)
clientServicesRouter.use(requireRole(Role.USER))

clientServicesRouter.post(
  "/service-requests/:id/cancel",
  async (request, response) => {
    const result = await getPrisma()!.serviceRequest.updateMany({
      where: {
        id: String(request.params.id),
        clientId: request.auth!.user.id,
        acceptedDepartmentId: null,
        status: {
          in: [
            "SUBMITTED",
            "UNDER_REVIEW",
            "AWAITING_CLIENT_INFO",
            "READY_FOR_QUOTATION",
          ],
        },
      },
      data: { status: "CANCELLED" },
    })
    if (!result.count)
      return response.status(409).json({
        error:
          "This request is no longer available for cancellation. Refresh and try again.",
      })
    return response.json({ success: true })
  },
)

clientServicesRouter.get("/services", async (_request, response) => {
  const services = await clientServicesService.getServices()
  return response.json({ services })
})

clientServicesRouter.get("/services/:id", async (request, response) => {
  const service = await clientServicesService.getServiceById(
    String(request.params.id),
  )
  return response.json({ service })
})

clientServicesRouter.get(
  "/services/:id/specialists",
  async (request, response) => {
    const specialists = await clientServicesService.getSpecialists(
      String(request.params.id),
    )
    return response.json(specialists)
  },
)

clientServicesRouter.post("/service-requests", async (request, response) => {
  const clientId = request.auth!.user.id
  const serviceRequest = await submitServiceRequest(clientId, request.body)
  return response.status(201).json({ serviceRequest })
})

clientServicesRouter.get("/service-requests", async (request, response) => {
  const filters = parseClientRequestFilters(request.query)
  if (!filters)
    return response.status(400).json({ error: "Invalid request filters" })
  const clientId = request.auth!.user.id
  const result = await clientServicesService.getClientRequests(
    clientId,
    filters,
  )
  return response.json(result)
})
