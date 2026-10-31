import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { requireAuth } from "../auth/auth.middleware.js"
import { verifyAccessToken } from "../auth/auth.jwt.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  conversationRealtime,
  type ConversationRealtime,
} from "./request-conversations.realtime.js"
import {
  getConversationAccess,
  listConversations,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
  editConversationMessage,
  deleteConversationMessage,
} from "./request-conversations.service.js"

export function createRequestConversationsRouter(
  realtime: ConversationRealtime = conversationRealtime,
) {
  const router = Router()
  router.use(requireAuth)
  router.get("/", async (request, response) => {
    const before = request.query.before
    if (
      before !== undefined &&
      (typeof before !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(before))
    )
      return response.status(400).json({ error: "Invalid conversation cursor" })
    response.json(await listConversations(request.auth!.user.id, before))
  })
  router.param("id", (_request, response, next, id: string) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      return response.status(400).json({ error: "Invalid request id" })
    next()
  })
  router.param("messageId", (_request, response, next, id: string) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      return response.status(400).json({ error: "Invalid message id" })
    next()
  })
  router.get("/:id", async (request, response) => {
    const id = String(request.params.id)
    const before = request.query.before
    if (
      before !== undefined &&
      (typeof before !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(before))
    )
      return response.status(400).json({ error: "Invalid message cursor" })
    const access = await getConversationAccess(request.auth!.user.id, id)
    const history = await listConversationMessages(
      request.auth!.user.id,
      id,
      before,
    )
    response.json({ ...access, ...history })
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
  router.post("/:id/messages", async (request, response) => {
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
    const message = await sendConversationMessage(
      request.auth!.user.id,
      String(request.params.id),
      input.body.trim(),
      input.clientMessageId,
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
      typeof input.body !== "string" ||
      !input.body.trim() ||
      input.body.length > 4000 ||
      input.body.includes("\u0000")
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
    await getConversationAccess(user.id, id)
    let closed = false
    let headersReady = false
    let release: (() => Promise<void>) | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let expiry: ReturnType<typeof setTimeout> | undefined
    function close() {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      clearTimeout(expiry)
      void release?.().catch(() => {})
      response.end()
    }
    function event(name: string) {
      if (closed || !headersReady) return
      if (!response.write(`event: ${name}\ndata: {}\n\n`)) close()
    }
    let checking = false
    async function validateAndNotify(name: string) {
      if (closed || checking) return
      checking = true
      try {
        await verifyAccessToken(request.header("authorization")!.slice(7))
        const session = await getPrisma()!.session.findFirst({
          where: {
            id: sessionId,
            userId: user.id,
            expiresAt: { gt: new Date() },
            user: { isActive: true, accountDeletedAt: null },
          },
          select: { id: true },
        })
        if (!session) {
          event("access-revoked")
          close()
          return
        }
        await getConversationAccess(user.id, id)
        event(name)
      } catch (error) {
        if (error instanceof ServiceRequestsError) event("access-revoked")
        close()
      } finally {
        checking = false
      }
    }
    response.once("close", close)
    try {
      release = await realtime.subscribe(
        id,
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
      await getConversationAccess(user.id, id)
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
  router.use(((error, _request, response, next) => {
    if (error instanceof ServiceRequestsError)
      return response.status(error.status).json({ error: error.message })
    next(error)
  }) satisfies import("express").ErrorRequestHandler)
  return router
}
