import { json, Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { ServicesError, servicesService } from "./services.service.js"

export const servicesRouter = Router()
servicesRouter.use(requireAuth)
servicesRouter.use(json({ limit: "3mb" }))

// Active services are the only options exposed to new client-request forms.
// Historical records can continue to reference a service after it is deactivated.
servicesRouter.get("/available", async (_request, response, next) => {
  try {
    const services = await servicesService.getAvailable()
    response.json({ services })
  } catch (error) {
    next(error)
  }
})

servicesRouter.get(
  "/",
  requirePermission(Permission.SERVICES_READ),
  async (_request, response, next) => {
    try {
      const services = await servicesService.getAll()
      response.json({ services })
    } catch (error) {
      next(error)
    }
  },
)

servicesRouter.get(
  "/pricing-templates",
  requirePermission(Permission.SERVICES_READ),
  async (_request, response, next) => {
    try {
      const pricingTemplates = await servicesService.getPricingTemplates()
      response.json({ pricingTemplates })
    } catch (error) {
      next(error)
    }
  },
)

servicesRouter.get(
  "/:id",
  requirePermission(Permission.SERVICES_READ),
  async (request, response, next) => {
    try {
      const service = await servicesService.getById(String(request.params.id))
      response.json({ service })
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

servicesRouter.post(
  "/",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response, next) => {
    try {
      const service = await servicesService.create(request.body)
      return response.status(201).json({ service })
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

servicesRouter.put(
  "/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response, next) => {
    try {
      const service = await servicesService.update(
        String(request.params.id),
        request.body,
      )
      return response.json({ service })
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

servicesRouter.patch(
  "/:id/status",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response, next) => {
    try {
      const service = await servicesService.updateStatus(
        String(request.params.id),
        request.body?.isActive,
      )
      return response.json({ service })
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

servicesRouter.delete(
  "/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response, next) => {
    try {
      const result = await servicesService.delete(String(request.params.id))
      return response.json(result)
    } catch (error) {
      if (error instanceof ServicesError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)
