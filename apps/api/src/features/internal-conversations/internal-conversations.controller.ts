import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  createInternalConversation,
  getInternalConversation,
  listInternalContacts,
  listInternalConversations,
  markInternalConversationRead,
  sendInternalMessage,
} from "./internal-conversations.service.js"

const idPattern = /^[A-Za-z0-9_-]{1,80}$/
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const internalConversationsRouter = Router()
internalConversationsRouter.use(requireAuth)

internalConversationsRouter.get("/contacts", async (request, response) => {
  response.json(await listInternalContacts(request.auth!.user.id))
})

internalConversationsRouter.get("/", async (request, response) => {
  const before = request.query.before
  if (
    before !== undefined &&
    (typeof before !== "string" || !idPattern.test(before))
  )
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
    typeof input.recipientId !== "string" ||
    !idPattern.test(input.recipientId)
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
  (_request, response, next, id: string) => {
    if (!idPattern.test(id))
      return response
        .status(400)
        .json({ error: "Invalid internal conversation id" })
    next()
  },
)

internalConversationsRouter.get("/:id", async (request, response) => {
  const before = request.query.before
  if (
    before !== undefined &&
    (typeof before !== "string" || !idPattern.test(before))
  )
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
    typeof input.body !== "string" ||
    !input.body.trim() ||
    input.body.length > 4000 ||
    input.body.includes("\u0000") ||
    !("clientMessageId" in input) ||
    typeof input.clientMessageId !== "string" ||
    !uuidPattern.test(input.clientMessageId)
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

internalConversationsRouter.use(((error, _request, response, next) => {
  if (error instanceof ServiceRequestsError)
    return response.status(error.status).json({ error: error.message })
  next(error)
}) satisfies import("express").ErrorRequestHandler)
