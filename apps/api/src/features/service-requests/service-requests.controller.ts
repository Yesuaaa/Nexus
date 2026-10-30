import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import {
  ServiceRequestsError,
  submitServiceRequest,
} from "./service-requests.service.js"

export const serviceRequestsRouter = Router()
serviceRequestsRouter.use(requireAuth)
serviceRequestsRouter.post(
  "/",
  requireRole(Role.USER),
  async (request, response, next) => {
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
  },
)
