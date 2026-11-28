import { once } from "node:events"
import { test } from "node:test"
import express from "express"
import { createApp } from "../../src/app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { createInternalConversation } from "../../src/features/internal-conversations/internal-conversations.service.js"
import { closeServer, startPgliteDatabase } from "./pglite-app.js"

test(
  "PG-028 isolated internal messaging upstream",
  { timeout: 1_800_000 },
  async (t) => {
    const { prisma, beforeShutdown } = await startPgliteDatabase(t)
    const sender = await prisma.user.create({
      data: {
        email: "pg028-sender@example.test",
        fullName: "Fixture Sender",
        role: "ADMIN",
        passwordHash: "synthetic",
      },
    })
    const other = await prisma.user.create({
      data: {
        email: "pg028-recipient@example.test",
        fullName: "Fixture Recipient",
        role: "STAFF",
        passwordHash: "synthetic",
      },
    })
    const outsider = await prisma.user.create({
      data: {
        email: "pg028-outsider@example.test",
        fullName: "Fixture Nonparticipant",
        role: "ADMIN",
        passwordHash: "synthetic",
      },
    })
    const thread = await createInternalConversation(sender.id, other.id)
    const sibling = await createInternalConversation(other.id, outsider.id)
    const sessions = {
      sender: await issueSession(sender),
      outsider: await issueSession(outsider),
    }
    const app = express()
    const receipts: { path: string; status: number }[] = []
    app.get("/__pg028", async (_request, response) => {
      response.json({
        thread: thread.id,
        sender: sender.id,
        receipts,
        messages: await prisma.internalMessage.findMany({
          select: { senderId: true, conversationId: true, body: true },
        }),
        sibling: await prisma.internalConversation.findUnique({
          where: { id: sibling.id },
          include: { messages: true, participants: true },
        }),
      })
    })
    app.get("/__pg028/session/:role", (request, response) => {
      const role = request.params.role
      if (role !== "sender" && role !== "outsider")
        return response.sendStatus(404)
      const { token, refreshToken } = sessions[role]
      return response
        .set("Cache-Control", "no-store")
        .json({ token, refreshToken })
    })
    app.use((request, response, next) => {
      if (request.path.startsWith("/api/internal-conversations")) {
        const path = request.method + " " + request.path
        response.once("finish", () =>
          receipts.push({ path, status: response.statusCode }),
        )
      }
      next()
    })
    app.use(createApp())
    const server = app.listen(5300, "127.0.0.1")
    beforeShutdown(() => closeServer(server))
    await once(server, "listening")
    await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
  },
)
