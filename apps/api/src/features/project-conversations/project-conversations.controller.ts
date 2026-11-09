import { Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  getProjectConversation,
  listProjectConversations,
  markProjectConversationRead,
  sendProjectMessage,
} from "./project-conversations.service.js"

const idPattern = /^[A-Za-z0-9_-]{1,80}$/
export const projectConversationsRouter = Router()
projectConversationsRouter.use(requireAuth)
projectConversationsRouter.use((request, response, next) => {
  if (!["USER", "STAFF"].includes(request.auth!.user.role))
    return response.status(403).json({
      error: "Project chat is available to clients and assigned staff.",
    })
  next()
})
projectConversationsRouter.param(
  "id",
  (_request, response, next, id: string) => {
    if (!idPattern.test(id))
      return response.status(400).json({ error: "Invalid project ID" })
    next()
  },
)
projectConversationsRouter.use((request, response, next) => {
  const before = request.query.before
  if (
    before !== undefined &&
    (typeof before !== "string" || !idPattern.test(before))
  )
    return response.status(400).json({ error: "Invalid conversation cursor" })
  next()
})
projectConversationsRouter.get("/", async (request, response) => {
  response.json(
    await listProjectConversations(
      request.auth!.user.id,
      request.query.view === "archived",
      request.query.before as string | undefined,
    ),
  )
})
projectConversationsRouter.get("/:id", async (request, response) => {
  response.json(
    await getProjectConversation(
      request.auth!.user.id,
      String(request.params.id),
      request.query.before as string | undefined,
    ),
  )
})
projectConversationsRouter.patch("/:id/read", async (request, response) => {
  response.json(
    await markProjectConversationRead(
      request.auth!.user.id,
      String(request.params.id),
    ),
  )
})
projectConversationsRouter.post("/:id/messages", async (request, response) => {
  const input: unknown = request.body
  if (
    !input ||
    typeof input !== "object" ||
    !("body" in input) ||
    typeof input.body !== "string" ||
    !input.body.trim() ||
    input.body.length > 4000 ||
    input.body.includes("\u0000") ||
    !("clientMessageId" in input) ||
    typeof input.clientMessageId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.clientMessageId,
    )
  )
    return response.status(400).json({
      error: "Enter a message of 1–4000 characters and a valid message ID",
    })
  const message = await sendProjectMessage(
    request.auth!.user.id,
    String(request.params.id),
    input.body.trim(),
    input.clientMessageId,
  )
  response.status(201).json({ message })
})
projectConversationsRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies ErrorRequestHandler)
