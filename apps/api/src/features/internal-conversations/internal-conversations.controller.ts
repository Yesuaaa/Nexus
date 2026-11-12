import { Router } from "express"
import {
  isMessageBody,
  isOptionalRecordId,
  isRecordId,
  isUuidV4,
  recordIdParam,
} from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  createInternalConversation,
  getInternalConversation,
  listInternalContacts,
  listInternalConversations,
  markInternalConversationRead,
  sendInternalMessage,
} from "./internal-conversations.service.js"

export const internalConversationsRouter = Router()
internalConversationsRouter.use(requireAuth)

internalConversationsRouter.get("/contacts", async (request, response) => {
  response.json(await listInternalContacts(request.auth!.user.id))
})

internalConversationsRouter.get("/", async (request, response) => {
  const before = request.query.before
  if (!isOptionalRecordId(before))
    return response
      .status(400)
      .json({ error: "Invalid internal conversation cursor" })
  response.json(await listInternalConversations(request.auth!.user.id, before))
})

internalConversationsRouter.post("/", async (request, response) => {
  const input: unknown = request.body
  if (
    !input ||
    typeof input !== "object" ||
    !("recipientId" in input) ||
    !isRecordId(input.recipientId)
  )
    return response
      .status(400)
      .json({ error: "Choose a staff or administrator account." })
  response
    .status(201)
    .json(
      await createInternalConversation(
        request.auth!.user.id,
        input.recipientId,
      ),
    )
})

internalConversationsRouter.param(
  "id",
  recordIdParam("Invalid internal conversation id"),
)

internalConversationsRouter.get("/:id", async (request, response) => {
  const before = request.query.before
  if (!isOptionalRecordId(before))
    return response
      .status(400)
      .json({ error: "Invalid internal message cursor" })
  response.json(
    await getInternalConversation(
      request.auth!.user.id,
      String(request.params.id),
      before,
    ),
  )
})

internalConversationsRouter.patch("/:id/read", async (request, response) => {
  response.json(
    await markInternalConversationRead(
      request.auth!.user.id,
      String(request.params.id),
    ),
  )
})

internalConversationsRouter.post("/:id/messages", async (request, response) => {
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
  const message = await sendInternalMessage(
    request.auth!.user.id,
    String(request.params.id),
    input.body.trim(),
    input.clientMessageId,
  )
  response.status(201).json({ message })
})
