import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { recordIdParam } from "../../shared/validation.js"
import { createLeaveService } from "./leave.service.js"

export function createLeaveRouter(clock: () => Date = () => new Date()) {
  const router = Router()
  const service = createLeaveService(clock)
  router.use(requireAuth)
  router.param("requestId", recordIdParam("Invalid leave request ID"))
  router.post("/preview", async (request, response) => {
    response.json(await service.preview(request.auth!.user.id, request.body))
  })
  router.get("/requests", async (request, response) => {
    response.json(await service.list(request.auth!.user.id, request.query))
  })
  router.get("/overview", async (request, response) => {
    response.json(await service.overview(request.auth!.user.id, request.query))
  })
  router.get("/requests/:requestId", async (request, response) => {
    response.json(
      await service.detail(
        request.auth!.user.id,
        String(request.params.requestId),
      ),
    )
  })
  router.post("/requests", async (request, response) => {
    response
      .status(201)
      .json(await service.submit(request.auth!.user.id, request.body))
  })
  for (const action of [
    "verify",
    "approve",
    "reject",
    "cancel",
    "reverse",
  ] as const)
    router.post(`/requests/:requestId/${action}`, async (request, response) => {
      response.json(
        await service.act(
          request.auth!.user.id,
          String(request.params.requestId),
          action.toUpperCase() as
            "VERIFY" | "APPROVE" | "REJECT" | "CANCEL" | "REVERSE",
          request.body,
        ),
      )
    })
  return router
}
