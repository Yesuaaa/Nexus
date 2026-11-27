import { json, Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import {
  createShowcaseEntry,
  listPublicShowcase,
  listShowcaseEntries,
  readPublicShowcase,
  updateShowcaseEntry,
  changeShowcaseArchive,
  deleteArchivedShowcase,
  reorderShowcaseEntries,
} from "./project-showcase.service.js"

export const publicProjectShowcaseRouter = Router()
publicProjectShowcaseRouter.get("/", async (request, response) => {
  response.json({
    projects: await listPublicShowcase(request.query.placement === "homepage"),
  })
})
publicProjectShowcaseRouter.get("/:slug", async (request, response) => {
  response.json({ project: await readPublicShowcase(request.params.slug) })
})

export const projectShowcaseRouter = Router()
projectShowcaseRouter.use(
  requireAuth,
  requirePermission(Permission.ADMINISTRATION_MANAGE_ALL),
)
projectShowcaseRouter.get("/", async (request, response) => {
  response.json({
    projects: await listShowcaseEntries(request.query.archived === "true"),
  })
})
projectShowcaseRouter.post(
  "/reorder",
  json({ limit: "2mb" }),
  async (request, response) => {
    response.json({ projects: await reorderShowcaseEntries(request.body) })
  },
)
projectShowcaseRouter.post(
  "/:id/archive",
  json({ limit: "8kb" }),
  async (request, response) => {
    response.json({
      project: await changeShowcaseArchive(
        request.params.id,
        request.body,
        true,
      ),
    })
  },
)
projectShowcaseRouter.post(
  "/:id/restore",
  json({ limit: "8kb" }),
  async (request, response) => {
    response.json({
      project: await changeShowcaseArchive(
        request.params.id,
        request.body,
        false,
      ),
    })
  },
)
projectShowcaseRouter.delete(
  "/:id",
  json({ limit: "8kb" }),
  async (request, response) => {
    await deleteArchivedShowcase(request.params.id, request.body)
    response.status(204).end()
  },
)
projectShowcaseRouter.post(
  "/",
  json({ limit: "15mb" }),
  async (request, response) => {
    response
      .status(201)
      .json({ project: await createShowcaseEntry(request.body) })
  },
)
projectShowcaseRouter.patch(
  "/:id",
  json({ limit: "15mb" }),
  async (request, response) => {
    response.json({
      project: await updateShowcaseEntry(request.params.id, request.body),
    })
  },
)
