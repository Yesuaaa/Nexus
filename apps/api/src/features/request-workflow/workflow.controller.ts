import { json, Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { uploadWorkflowFile, downloadWorkflowFile } from "./workflow.files.js"
import {
  listWorkflowApprovals,
  listWorkflowNotifications,
  readWorkflowNotification,
} from "./workflow.notifications.js"
import { actOnWorkflow } from "./workflow.service.js"
import { getWorkflow } from "./workflow.snapshot.js"

export const requestWorkflowRouter = Router()
requestWorkflowRouter.use(requireAuth)
requestWorkflowRouter.get("/notifications", async (request, response) => {
  response.json(await listWorkflowNotifications(request.auth!.user.id))
})
requestWorkflowRouter.patch(
  "/notifications/:id/read",
  async (request, response) => {
    response.json(
      await readWorkflowNotification(
        request.auth!.user.id,
        String(request.params.id),
      ),
    )
  },
)
requestWorkflowRouter.get("/approvals", async (request, response) => {
  response.json(await listWorkflowApprovals(request.auth!.user.id))
})
for (const param of ["id", "fileId"])
  requestWorkflowRouter.param(param, (_request, response, next, id: string) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      return response.status(400).json({ error: "Invalid record ID" })
    next()
  })
requestWorkflowRouter.get("/:id", async (request, response) => {
  response.json(
    await getWorkflow(request.auth!.user.id, String(request.params.id)),
  )
})
requestWorkflowRouter.post(
  "/:id/actions",
  json({ limit: "64kb" }),
  async (request, response) => {
    response.json(
      await actOnWorkflow(
        request.auth!.user.id,
        String(request.params.id),
        request.body,
      ),
    )
  },
)
requestWorkflowRouter.post(
  "/:id/files",
  json({ limit: "7mb" }),
  async (request, response) => {
    response.status(201).json({
      file: await uploadWorkflowFile(
        request.auth!.user.id,
        String(request.params.id),
        request.body,
      ),
    })
  },
)
requestWorkflowRouter.get("/:id/files/:fileId", async (request, response) => {
  const file = await downloadWorkflowFile(
    request.auth!.user.id,
    String(request.params.id),
    String(request.params.fileId),
  )
  response.set({
    "Content-Type": file.mimeType,
    "Content-Disposition": `attachment; filename="download${file.mimeType === "application/pdf" ? ".pdf" : file.mimeType === "text/plain" ? ".txt" : file.mimeType === "image/png" ? ".png" : ".jpg"}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)}`,
    "Content-Length": String(file.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  })
  response.send(Buffer.from(file.data))
})
requestWorkflowRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies ErrorRequestHandler)
