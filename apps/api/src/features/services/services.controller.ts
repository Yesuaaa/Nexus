import { json, Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { servicesService } from "./services.service.js"

export const servicesRouter = Router()
servicesRouter.use(requireAuth)
servicesRouter.use(json({ limit: "3mb" }))

// Active services are the only options exposed to new client-request forms.
// Historical records can continue to reference a service after it is deactivated.
servicesRouter.get("/available", async (_request, response) => {
  const services = await servicesService.getAvailable()
  response.json({ services })
})

servicesRouter.get(
  "/",
  requirePermission(Permission.SERVICES_READ),
  async (_request, response) => {
    const services = await servicesService.getAll()
    response.json({ services })
  },
)

servicesRouter.get(
  "/pricing-templates",
  requirePermission(Permission.SERVICES_READ),
  async (_request, response) => {
    const pricingTemplates = await servicesService.getPricingTemplates()
    response.json({ pricingTemplates })
  },
)

servicesRouter.put(
  "/pricing-templates/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const pricingTemplate = await servicesService.updatePricingTemplate(
      String(request.params.id),
      request.body,
    )
    return response.json({ pricingTemplate })
  },
)

servicesRouter.delete(
  "/pricing-templates/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    return response.json(
      await servicesService.deletePricingTemplate(String(request.params.id)),
    )
  },
)

servicesRouter.get(
  "/:id/specialists/:specialistId",
  async (request, response) => {
    const specialist = await servicesService.getSpecialistProfile(
      String(request.params.id),
      String(request.params.specialistId),
    )
    response.json({ specialist })
  },
)

servicesRouter.get("/:id/specialists", async (request, response) => {
  const specialists = await servicesService.getSpecialists(
    String(request.params.id),
  )
  response.json({ specialists })
})

servicesRouter.get(
  "/:id",
  requirePermission(Permission.SERVICES_READ),
  async (request, response) => {
    const service = await servicesService.getById(String(request.params.id))
    response.json({ service })
  },
)

servicesRouter.post(
  "/",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const service = await servicesService.create(request.body)
    return response.status(201).json({ service })
  },
)

servicesRouter.put(
  "/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const service = await servicesService.update(
      String(request.params.id),
      request.body,
    )
    return response.json({ service })
  },
)

servicesRouter.patch(
  "/:id/status",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const service = await servicesService.updateStatus(
      String(request.params.id),
      request.body?.isActive,
    )
    return response.json({ service })
  },
)

servicesRouter.delete(
  "/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const result = await servicesService.delete(String(request.params.id))
    return response.json(result)
  },
)
