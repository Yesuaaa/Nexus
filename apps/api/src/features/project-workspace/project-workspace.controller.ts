import { json, Router } from "express"
import { recordIdParam } from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import { fail } from "../../shared/http-error.js"
import { parsePage } from "../../shared/query/pagination.js"
import { parseWorkspaceIdentity } from "./workspace-identity.js"
import {
  addProjectTask,
  assignProjectTeamLead,
  cancelProjectWorkspace,
  createProjectWorkspaces,
  getProjectWorkspace,
  listApprovedBookings,
  listProjectWorkspaceTemplates,
  listProjectWorkspaces,
  listWorkspaceDirectory,
  renameProjectWorkspace,
  updateProjectTask,
  saveProjectPlan,
  updateProjectDeliverable,
  uploadProjectDeliverable,
  removeProjectDeliverableAttachment,
  reviewProjectDeliverable,
  sendProjectDeliverableToClient,
  downloadProjectDeliverable,
  updateProjectWorkspaceStatus,
} from "./project-workspace.service.js"

export const projectWorkspaceRouter = Router()
projectWorkspaceRouter.use(requireAuth)

projectWorkspaceRouter.param(
  "id",
  (_request, _response, next, value: string) => {
    parseWorkspaceIdentity(value)
    next()
  },
)

for (const parameter of ["projectId", "taskId", "deliverableId"])
  projectWorkspaceRouter.param(
    parameter,
    recordIdParam("Invalid project workspace ID"),
  )

projectWorkspaceRouter.get("/", async (request, response) => {
  const limit = Number(request.query.limit)
  response.json(
    await listProjectWorkspaces(request.auth!.user.id, {
      sort: request.query.sort === "most-active" ? "most-active" : "recent",
      limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
    }),
  )
})

projectWorkspaceRouter.get("/directory", async (request, response) => {
  const {
    page: inputPage,
    search = "",
    status = "",
    sort = "recent",
    view = "active",
  } = request.query
  const page = parsePage(inputPage)
  if (
    !page ||
    typeof search !== "string" ||
    search.length > 200 ||
    typeof status !== "string" ||
    ![
      "",
      "PLANNED",
      "IN_PROGRESS",
      "ON_HOLD",
      "COMPLETED",
      "CANCELLED",
    ].includes(status) ||
    (sort !== "recent" &&
      sort !== "name" &&
      sort !== "client" &&
      sort !== "projects") ||
    (view !== "active" && view !== "archive")
  )
    fail(400, "Invalid workspace directory filters")
  response.json(
    await listWorkspaceDirectory(request.auth!.user.id, {
      page,
      search: search.trim(),
      status,
      sort,
      view,
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

projectWorkspaceRouter.patch("/:id", async (request, response) => {
  response.json(
    await renameProjectWorkspace(
      request.auth!.user.id,
      String(request.params.id),
      request.body as unknown,
    ),
  )
})

projectWorkspaceRouter.post("/:id/cancel", async (request, response) => {
  response.json(
    await cancelProjectWorkspace(
      request.auth!.user.id,
      String(request.params.id),
    ),
  )
})

projectWorkspaceRouter.post("/:id/status", async (request, response) => {
  const body = request.body as unknown
  const action =
    body && typeof body === "object" && "action" in body ? body.action : null
  if (action !== "ON_HOLD" && action !== "RESUME" && action !== "COMPLETE")
    fail(400, "Choose a valid project status action")
  response.json(
    await updateProjectWorkspaceStatus(
      request.auth!.user.id,
      String(request.params.id),
      action,
    ),
  )
})

projectWorkspaceRouter.put(
  "/:id/projects/:projectId/team-lead",
  json({ limit: "4kb" }),
  async (request, response) => {
    response.json(
      await assignProjectTeamLead(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        request.body?.employeeId,
      ),
    )
  },
)

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

projectWorkspaceRouter.patch(
  "/:id/projects/:projectId/deliverables/:deliverableId",
  async (request, response) => {
    response.json(
      await updateProjectDeliverable(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.deliverableId),
        request.body as unknown,
      ),
    )
  },
)

projectWorkspaceRouter.post(
  "/:id/projects/:projectId/deliverables/:deliverableId/attachment",
  json({ limit: "7mb" }),
  async (request, response) => {
    response
      .status(201)
      .json(
        await uploadProjectDeliverable(
          request.auth!.user.id,
          String(request.params.id),
          String(request.params.projectId),
          String(request.params.deliverableId),
          request.body as unknown,
        ),
      )
  },
)

projectWorkspaceRouter.delete(
  "/:id/projects/:projectId/deliverables/:deliverableId/attachment",
  async (request, response) => {
    response.json(
      await removeProjectDeliverableAttachment(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.deliverableId),
      ),
    )
  },
)

projectWorkspaceRouter.post(
  "/:id/projects/:projectId/deliverables/:deliverableId/approve",
  async (request, response) => {
    response.json(
      await reviewProjectDeliverable(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.deliverableId),
        "approve",
      ),
    )
  },
)

projectWorkspaceRouter.post(
  "/:id/projects/:projectId/deliverables/:deliverableId/reject",
  json({ limit: "8kb" }),
  async (request, response) => {
    response.json(
      await reviewProjectDeliverable(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.deliverableId),
        "reject",
        request.body as unknown,
      ),
    )
  },
)

projectWorkspaceRouter.post(
  "/:id/projects/:projectId/deliverables/:deliverableId/send",
  async (request, response) => {
    response.json(
      await sendProjectDeliverableToClient(
        request.auth!.user.id,
        String(request.params.id),
        String(request.params.projectId),
        String(request.params.deliverableId),
      ),
    )
  },
)

projectWorkspaceRouter.get(
  "/:id/projects/:projectId/deliverables/:deliverableId/attachment",
  async (request, response) => {
    const file = await downloadProjectDeliverable(
      request.auth!.user.id,
      String(request.params.id),
      String(request.params.projectId),
      String(request.params.deliverableId),
    )
    const extensionByType: Record<string, string> = {
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "text/plain": ".txt",
    }
    response.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="download${extensionByType[file.mimeType] ?? ""}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)}`,
      "Content-Length": String(file.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    })
    response.send(Buffer.from(file.data))
  },
)
