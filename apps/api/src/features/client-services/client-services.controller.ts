import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { clientServicesService } from "./client-services.service.js"
import { parseClientRequestFilters } from "./client-services.schema.js"
import { ServicesError } from "../services/services.service.js"
import {
  ServiceRequestsError,
  submitServiceRequest,
} from "../service-requests/service-requests.service.js"

export const clientServicesRouter = Router()

// All routes here are restricted to authenticated Client accounts (Role.USER)
clientServicesRouter.use(requireAuth)
clientServicesRouter.use(requireRole(Role.USER))

clientServicesRouter.post(
  "/service-requests/:id/cancel",
  async (request, response, next) => {
    try {
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
        return response
          .status(409)
          .json({
            error:
              "This request is no longer available for cancellation. Refresh and try again.",
          })
      return response.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

clientServicesRouter.get("/services", async (_request, response, next) => {
  try {
    const services = await clientServicesService.getServices()
    return response.json({ services })
  } catch (error) {
    next(error)
  }
})

clientServicesRouter.get("/services/:id", async (request, response, next) => {
  try {
    const service = await clientServicesService.getServiceById(
      String(request.params.id),
    )
    return response.json({ service })
  } catch (error) {
    if (error instanceof ServicesError) {
      return response.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

clientServicesRouter.get(
  "/services/:id/specialists",
  async (request, response, next) => {
    try {
      const specialists = await clientServicesService.getSpecialists(
        String(request.params.id),
      )
      return response.json(specialists)
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

clientServicesRouter.post(
  "/service-requests",
  async (request, response, next) => {
    try {
      const clientId = request.auth!.user.id
      const serviceRequest = await submitServiceRequest(clientId, request.body)
      return response.status(201).json({ serviceRequest })
    } catch (error) {
      if (error instanceof ServiceRequestsError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

clientServicesRouter.get(
  "/service-requests",
  async (request, response, next) => {
    try {
      const filters = parseClientRequestFilters(request.query)
      if (!filters)
        return response.status(400).json({ error: "Invalid request filters" })
      const clientId = request.auth!.user.id
      const result = await clientServicesService.getClientRequests(
        clientId,
        filters,
      )
      return response.json(result)
    } catch (error) {
      next(error)
    }
  },
)
