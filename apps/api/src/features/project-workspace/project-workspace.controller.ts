import { Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  addProjectTask,
  createProjectWorkspaces,
  getProjectWorkspace,
  listApprovedBookings,
  listProjectWorkspaceTemplates,
  listProjectWorkspaces,
  updateProjectTask,
  saveProjectPlan,
} from "./project-workspace.service.js"

export const projectWorkspaceRouter = Router()
projectWorkspaceRouter.use(requireAuth)

for (const parameter of ["id", "projectId", "taskId"]) {
  projectWorkspaceRouter.param(
    parameter,
    (_request, response, next, value: string) => {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(value))
        return response
          .status(400)
          .json({ error: "Invalid project workspace ID" })
      next()
    },
  )
}

projectWorkspaceRouter.get("/", async (request, response) => {
  const limit = Number(request.query.limit)
  response.json(
    await listProjectWorkspaces(request.auth!.user.id, {
      sort: request.query.sort === "most-active" ? "most-active" : "recent",
      limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
    }),
  )
})

projectWorkspaceRouter.get("/templates", async (request, response) => {
  response.json(await listProjectWorkspaceTemplates(request.auth!.user.id))
})

projectWorkspaceRouter.get("/approved-bookings", async (request, response) => {
  response.json(await listApprovedBookings(request.auth!.user.id))
})

projectWorkspaceRouter.post("/", async (request, response) => {
  response
    .status(201)
    .json(
      await createProjectWorkspaces(
        request.auth!.user.id,
        request.body as unknown,
      ),
    )
})

projectWorkspaceRouter.get("/:id", async (request, response) => {
  response.json(
    await getProjectWorkspace(request.auth!.user.id, String(request.params.id)),
  )
})

projectWorkspaceRouter.put(
  "/:id/projects/:projectId/plan",
  async (request, response) => {
    response.json(
      await saveProjectPlan(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        request.body as unknown,
      ),
    )
  },
)

projectWorkspaceRouter.post(
  "/:id/projects/:projectId/tasks",
  async (request, response) => {
    response.json(
      await addProjectTask(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        request.body as unknown,
      ),
    )
  },
)

projectWorkspaceRouter.patch(
  "/:id/projects/:projectId/tasks/:taskId",
  async (request, response) => {
    const body = request.body as unknown
    const status =
      body && typeof body === "object" && "status" in body ? body.status : null
    if (
      status !== "NOT_STARTED" &&
      status !== "IN_PROGRESS" &&
      status !== "DONE"
    )
      return response.status(400).json({ error: "Choose a valid task status" })
    response.json(
      await updateProjectTask(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.taskId),
        status,
      ),
    )
  },
)

projectWorkspaceRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies ErrorRequestHandler)
