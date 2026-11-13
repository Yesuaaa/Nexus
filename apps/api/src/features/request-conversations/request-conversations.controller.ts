import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { activeAccount } from "../../shared/query/accounts.js"
import {
  isMessageBody,
  isOptionalRecordId,
  isRecordId,
  isUuidV4,
  recordIdParam,
} from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import { verifyAccessToken } from "../auth/auth.jwt.js"
import { HttpError } from "../../shared/http-error.js"
import {
  conversationRealtime,
  type ConversationRealtime,
} from "./request-conversations.realtime.js"
import {
  getConversationAccess,
  getConversationStreamAccess,
  listConversations,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
  editConversationMessage,
  deleteConversationMessage,
  deleteArchivedConversation,
  scheduleConversationMeeting,
  updateConversationMeeting,
} from "./request-conversations.service.js"

export function createRequestConversationsRouter(
  realtime: ConversationRealtime = conversationRealtime,
) {
  const router = Router()
  router.use(requireAuth)
  router.get("/", async (request, response) => {
    const before = request.query.before
    const view = request.query.view ?? "active"
    if (view !== "active" && view !== "archived")
      return response.status(400).json({ error: "Invalid conversation view" })
    if (!isOptionalRecordId(before))
      return response.status(400).json({ error: "Invalid conversation cursor" })
    response.json(await listConversations(request.auth!.user.id, before, view))
  })
  router.param("id", recordIdParam("Invalid request id"))
  router.param("messageId", recordIdParam("Invalid message id"))
  router.get("/:id", async (request, response) => {
    const id = String(request.params.id)
    const before = request.query.before
    const booking = request.query.booking
    if (!isOptionalRecordId(before))
      return response.status(400).json({ error: "Invalid message cursor" })
    if (!isOptionalRecordId(booking))
      return response.status(400).json({ error: "Invalid booking id" })
    const access = await getConversationAccess(
      request.auth!.user.id,
      id,
      booking,
    )
    const history = await listConversationMessages(
      request.auth!.user.id,
      id,
      before,
    )
    response.json({ ...access, ...history })
  })
  router.post("/:id/meetings", async (request, response) => {
    const meeting = await scheduleConversationMeeting(
      request.auth!.user.id,
      String(request.params.id),
      request.body,
    )
    response.status(201).json({ meeting })
  })
  router.patch("/:id/meetings/:meetingId", async (request, response) => {
    const meetingId = String(request.params.meetingId)
    if (!isRecordId(meetingId))
      return response.status(400).json({ error: "Invalid meeting id" })
    const meeting = await updateConversationMeeting(
      request.auth!.user.id,
      String(request.params.id),
      meetingId,
      request.body,
    )
    response.json({ meeting })
  })
  router.patch("/:id/read", async (request, response) => {
    response.json(
      await markConversationRead(
        request.auth!.user.id,
        String(request.params.id),
        request.auth!.user.role === "USER" ? "USER" : "STAFF",
      ),
    )
  })
  router.delete("/:id", async (request, response) => {
    response.json(
      await deleteArchivedConversation(
        request.auth!.user.id,
        String(request.params.id),
      ),
    )
  })
  router.post("/:id/messages", async (request, response) => {
    const input: unknown = request.body
    if (
      !input ||
      typeof input !== "object" ||
      !("body" in input) ||
      !isMessageBody(input.body) ||
      !("clientMessageId" in input) ||
      !isUuidV4(input.clientMessageId) ||
      ("bookingId" in input &&
        input.bookingId !== null &&
        !isRecordId(input.bookingId))
    )
      return response.status(400).json({
        error: "Enter a message of 1–4000 characters and a valid message ID",
      })
    const message = await sendConversationMessage(
      request.auth!.user.id,
      String(request.params.id),
      input.body.trim(),
      input.clientMessageId,
      "bookingId" in input && typeof input.bookingId === "string"
        ? input.bookingId
        : null,
    )
    response.status(201).json({ message })
  })
  router.patch("/:id/messages/:messageId", async (request, response) => {
    if (request.auth!.user.role !== "STAFF")
      return response.status(403).json({
        error: "Only staff can edit conversation messages",
      })
    const input: unknown = request.body
    if (
      !input ||
      typeof input !== "object" ||
      !("body" in input) ||
      !isMessageBody(input.body)
    )
      return response.status(400).json({
        error: "Enter a message of 1–4000 characters",
      })
    const message = await editConversationMessage(
      request.auth!.user.id,
      String(request.params.id),
      String(request.params.messageId),
      input.body.trim(),
    )
    response.json({ message })
  })
  router.delete("/:id/messages/:messageId", async (request, response) => {
    if (request.auth!.user.role !== "STAFF")
      return response.status(403).json({
        error: "Only staff can delete conversation messages",
      })
    const message = await deleteConversationMessage(
      request.auth!.user.id,
      String(request.params.id),
      String(request.params.messageId),
    )
    response.json({ message })
  })
  router.get("/:id/events", async (request, response) => {
    const id = String(request.params.id)
    const { user, sessionId } = request.auth!
    const { id: conversationId } = await getConversationStreamAccess(
      user.id,
      id,
    )
    let closed = false
    let headersReady = false
    let release: (() => Promise<void>) | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let keepAlive: ReturnType<typeof setInterval> | undefined
    let expiry: ReturnType<typeof setTimeout> | undefined
    function close() {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      clearInterval(keepAlive)
      clearTimeout(expiry)
      void release?.().catch(() => {})
      response.end()
    }
    function event(name: string) {
      if (closed || !headersReady) return
      if (!response.write(`event: ${name}\ndata: {}\n\n`)) close()
    }
    let checking = false
    let pendingChange = false
    async function validateAndNotify(name: string) {
      if (closed) return
      if (checking) {
        if (name === "messages-changed") pendingChange = true
        return
      }
      checking = true
      try {
        await verifyAccessToken(request.header("authorization")!.slice(7))
        const session = await getPrisma()!.session.findFirst({
          where: {
            id: sessionId,
            userId: user.id,
            expiresAt: { gt: new Date() },
            user: activeAccount,
          },
          select: { id: true },
        })
        if (!session) {
          event("access-revoked")
          close()
          return
        }
        await getConversationStreamAccess(user.id, id)
        event(name)
      } catch (error) {
        if (error instanceof HttpError && [403, 404].includes(error.status))
          event("access-revoked")
        else {
          event("reconnecting")
          console.error(
            "Conversation stream check failed:",
            conversationId,
            error,
          )
        }
        close()
      } finally {
        checking = false
        if (pendingChange && !closed) {
          pendingChange = false
          void validateAndNotify("messages-changed")
        }
      }
    }
    response.once("close", close)
    try {
      release = await realtime.subscribe(
        conversationId,
        () => {
          void validateAndNotify("messages-changed")
        },
        (connected) => {
          if (!connected && headersReady) {
            event("reconnecting")
            close()
          }
        },
      )
      if (closed) {
        await release()
        return
      }
      // Recheck access after waiting for Supabase before opening the stream.
      await getConversationStreamAccess(user.id, id)
      if (closed) {
        await release()
        return
      }
      response.status(200).set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      })
      response.flushHeaders()
      headersReady = true
      // Keep the proxy socket active even while a database access check is slow.
      // Comments carry no private data and do not replace authorization checks.
      keepAlive = setInterval(() => {
        if (!closed && !response.write(": keep-alive\n\n")) close()
      }, 10_000)
      event("connected")
      // Resync after subscribing to cover messages written during the handshake.
      event("messages-changed")
      heartbeat = setInterval(() => {
        void validateAndNotify("heartbeat")
      }, 15_000)
      // Bound every stream; reconnect uses the shared automatic token refresh.
      expiry = setTimeout(close, 55_000)
    } catch (error) {
      response.removeListener("close", close)
      closed = true
      await release?.()
      throw error
    }
  })
  return router
}
