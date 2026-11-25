import { json, Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { authRateLimit } from "../auth/auth.limiter.js"
import { publicServicesService } from "./public-services.service.js"

export const publicServicesRouter = Router()
publicServicesRouter.use(authRateLimit(90))
publicServicesRouter.get("/services", async (request, response) => {
  response.json(
    await publicServicesService.list(request.query.q, request.query.page),
  )
})
publicServicesRouter.get("/services/:id", async (request, response) => {
  response.json({
    service: await publicServicesService.detail(request.params.id),
  })
})
publicServicesRouter.post(
  "/services/:id/inquiries",
  authRateLimit(3),
  json({ limit: "32kb" }),
  async (request, response) => {
    const result = await publicServicesService.submit(
      request.params.id,
      request.body,
    )
    response.status(result.replayed ? 200 : 201).json({
      ...result,
      message:
        "Your inquiry has been received for review. This does not confirm a booking or service agreement.",
    })
  },
)

export const serviceInquiriesRouter = Router()
serviceInquiriesRouter.use(requireAuth)
serviceInquiriesRouter.get(
  "/",
  requirePermission(Permission.SERVICE_INQUIRIES_READ),
  async (request, response) => {
    response.json(
      await publicServicesService.listInquiries(
        request.query.page,
        request.query.status,
      ),
    )
  },
)
serviceInquiriesRouter.patch(
  "/:id",
  requirePermission(Permission.SERVICE_INQUIRIES_MANAGE),
  json({ limit: "8kb" }),
  async (request, response) => {
    const inquiry = await publicServicesService.review(
      request.params.id,
      request.auth!.user.id,
      request.body,
    )
    response.json({ inquiry })
  },
)
