import { Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { getProject, setMilestoneCompletion } from "./projects.service.js"

export const projectsRouter = Router()
projectsRouter.use(requireAuth)
for (const parameter of ["id", "milestoneId"]) {
  projectsRouter.param(parameter, (_request, response, next, value: string) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value))
      return response
        .status(400)
        .json({ error: "Invalid project or milestone ID" })
    next()
  })
}
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
