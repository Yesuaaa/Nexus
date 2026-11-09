import { Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  createProjectCancellationRequest,
  createProjectChangeRequest,
  getClientDeliverableFile,
  getProject,
  listClientProjects,
  reviewClientDeliverable,
  reviewProjectCancellationRequest,
  reviewProjectChangeRequest,
  setMilestoneCompletion,
  updateClientProjectBrief,
} from "./projects.service.js"

export const projectsRouter = Router()
projectsRouter.use(requireAuth)
for (const parameter of [
  "id",
  "milestoneId",
  "changeRequestId",
  "cancellationRequestId",
]) {
  projectsRouter.param(parameter, (_request, response, next, value: string) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value))
      return response
        .status(400)
        .json({ error: "Invalid project or milestone ID" })
    next()
  })
}
projectsRouter.get("/", async (request, response) => {
  response.json(await listClientProjects(request.auth!.user.id))
})
projectsRouter.get(
  "/:id/deliverables/:milestoneId/file",
  async (request, response) => {
    const file = await getClientDeliverableFile(
      request.auth!.user.id,
      String(request.params.id),
      String(request.params.milestoneId),
    )
    const inline = ["application/pdf", "image/png", "image/jpeg"].includes(
      file.mimeType,
    )
    response.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)}`,
      "Content-Length": String(file.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    })
    response.send(Buffer.from(file.data))
  },
)
projectsRouter.post(
  "/:id/deliverables/:milestoneId/review",
  async (request, response) => {
    response.json(
      await reviewClientDeliverable(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.milestoneId),
        request.body,
      ),
    )
  },
)
projectsRouter.post("/:id/change-requests", async (request, response) => {
  response
    .status(201)
    .json(
      await createProjectChangeRequest(
        request.auth!.user.id,
        String(request.params.id),
        request.body,
      ),
    )
})
projectsRouter.post("/:id/cancellation-requests", async (request, response) => {
  response
    .status(201)
    .json(
      await createProjectCancellationRequest(
        request.auth!.user.id,
        String(request.params.id),
        request.body,
      ),
    )
})
projectsRouter.patch(
  "/:id/cancellation-requests/:cancellationRequestId",
  async (request, response) => {
    response.json(
      await reviewProjectCancellationRequest(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.cancellationRequestId),
        request.body,
      ),
    )
  },
)
projectsRouter.patch(
  "/:id/change-requests/:changeRequestId",
  async (request, response) => {
    response.json(
      await reviewProjectChangeRequest(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.changeRequestId),
        request.body,
      ),
    )
  },
)
projectsRouter.patch("/:id/brief", async (request, response) => {
  response.json(
    await updateClientProjectBrief(
      request.auth!.user.id,
      String(request.params.id),
      request.body,
    ),
  )
})
projectsRouter.get("/:id", async (request, response) => {
  response.json(
    await getProject(request.auth!.user.id, String(request.params.id)),
  )
})
projectsRouter.patch(
  "/:id/milestones/:milestoneId",
  async (request, response) => {
    const input: unknown = request.body
    if (
      !input ||
      typeof input !== "object" ||
      !("completed" in input) ||
      typeof input.completed !== "boolean"
    )
      return response
        .status(400)
        .json({ error: "Choose whether this milestone is completed" })
    response.json(
      await setMilestoneCompletion(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.milestoneId),
        input.completed,
      ),
    )
  },
)
projectsRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies ErrorRequestHandler)
