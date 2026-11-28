import { once } from "node:events"
import { test } from "node:test"
import express from "express"
import { createApp } from "../../src/app.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import { closeServer, startPgliteDatabase } from "./pglite-app.js"

test("PG-026 isolated login upstream", { timeout: 1_800_000 }, async (t) => {
  const { prisma, beforeShutdown } = await startPgliteDatabase(t)
  const admin = await prisma.user.create({
    data: {
      email: "pg026-admin@example.test",
      fullName: "PG026 Admin",
      role: "ADMIN",
      passwordHash: await hashPassword("PG026 Synthetic integration 123!"),
    },
  })
  const app = express()
  const receipts: { path: string; status: number }[] = []
  app.get("/__pg026", async (_request, response) => {
    const sessions = await prisma.session.findMany({
      select: { userId: true, _count: { select: { refreshTokens: true } } },
    })
    response.json({ owner: admin.id, sessions, receipts })
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
  const server = app.listen(5296, "127.0.0.1")
  beforeShutdown(() => closeServer(server))
  await once(server, "listening")
  await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
})
