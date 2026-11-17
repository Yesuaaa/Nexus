import { Router } from "express"
import {
  isMessageBody,
  isOptionalRecordId,
  isUuidV4,
  recordIdParam,
} from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  getProjectConversation,
  listProjectConversations,
  markProjectConversationRead,
  sendProjectMessage,
} from "./project-conversations.service.js"

export const projectConversationsRouter = Router()
projectConversationsRouter.use(requireAuth)
projectConversationsRouter.use((request, response, next) => {
  if (!["USER", "STAFF"].includes(request.auth!.user.role))
    return response.status(403).json({
      error: "Project chat is available to clients and assigned staff.",
    })
  next()
})
projectConversationsRouter.param("id", recordIdParam("Invalid project ID"))
projectConversationsRouter.use((request, response, next) => {
  if (!isOptionalRecordId(request.query.before))
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
    !isMessageBody(input.body) ||
    !("clientMessageId" in input) ||
    !isUuidV4(input.clientMessageId)
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
