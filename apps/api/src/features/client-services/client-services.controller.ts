import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { parsePage } from "../../shared/query-helpers.js"
import {
  ClientServicesError,
  clientServicesService,
} from "./client-services.service.js"
import { parseClientServiceRequestInput } from "./client-services.schema.js"

export const clientServicesRouter = Router()

// All routes here are restricted to authenticated Client accounts (Role.USER)
clientServicesRouter.use(requireAuth)
clientServicesRouter.use(requireRole(Role.USER))

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
    if (error instanceof ClientServicesError) {
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
      if (error instanceof ClientServicesError) {
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
      const { data, error } = parseClientServiceRequestInput(request.body)
      if (error || !data) {
        return response.status(400).json({ error: error || "Invalid input" })
      }

      const clientId = request.auth!.user.id
      const result = await clientServicesService.submitRequest(clientId, data)
      return response.status(201).json(result)
    } catch (error) {
      if (error instanceof ClientServicesError) {
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
      const page = parsePage(request.query.page) ?? 1
      const clientId = request.auth!.user.id
      const result = await clientServicesService.getClientRequests(
        clientId,
        page,
      )
      return response.json(result)
    } catch (error) {
      next(error)
    }
  },
)
