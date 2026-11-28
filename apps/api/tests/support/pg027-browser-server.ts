import { once } from "node:events"
import { test } from "node:test"
import express from "express"
import { createApp } from "../../src/app.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import { closeServer, startPgliteDatabase } from "./pglite-app.js"

test("PG-027 isolated login upstream", { timeout: 1_800_000 }, async (t) => {
  const { prisma, beforeShutdown } = await startPgliteDatabase(t)
  const client = await prisma.user.create({
    data: {
      email: "pg027-user@example.test",
      fullName: "PG027 Client",
      role: "USER",
      passwordHash: await hashPassword("PG027 Synthetic integration 123!"),
    },
  })
  await prisma.service.create({
    data: {
      id: "pg027-service",
      name: "PG027 Synthetic Service",
      description: "Disposable integration fixture",
    },
  })
  const app = express()
  const receipts: { path: string; status: number }[] = []
  app.get("/__pg027", async (_request, response) => {
    const sessions = await prisma.session.findMany({
      select: { userId: true, _count: { select: { refreshTokens: true } } },
    })
    response.json({
      owner: client.id,
      sessions,
      receipts,
      inquiries: await prisma.serviceInquiry.count(),
      bookings: await prisma.serviceRequest.count(),
    })
  })
  app.use((request, response, next) => {
    if (["/api/auth/login", "/api/auth/me"].includes(request.path)) {
      const path = request.method + " " + request.path
      response.once("finish", () =>
        receipts.push({ path, status: response.statusCode }),
      )
    }
    next()
  })
  app.use(createApp())
  const server = app.listen(5298, "127.0.0.1")
  beforeShutdown(() => closeServer(server))
  await once(server, "listening")
  await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
})
