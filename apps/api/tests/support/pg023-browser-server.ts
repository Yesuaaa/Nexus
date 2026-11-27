import { once } from "node:events"
import { test } from "node:test"
import express from "express"
import { createApp } from "../../src/app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { closeServer, startPgliteDatabase } from "./pglite-app.js"

test(
  "PG-023 disposable employee rewrite upstream",
  { timeout: 1_800_000 },
  async (t) => {
    const { prisma, beforeShutdown } = await startPgliteDatabase(t)
    const admin = await prisma.user.create({
      data: {
        email: "pg023-admin@example.test",
        role: "ADMIN",
        passwordHash: "fixture",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "pg023-rewrite@example.test",
        fullName: "PG023 Rewrite Employee",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "EXP-REWRITE",
        fullName: "PG023 Rewrite Employee",
        userId: staff.id,
      },
    })
    const { token } = await issueSession(admin)
    const upstream = express()
    const receipts: string[] = []
    upstream.get("/__pg023", async (_request, response) => {
      response.json({
        token,
        employeeId: employee.id,
        receipts,
        snapshot: {
          users: await prisma.user.findMany({
            orderBy: { id: "asc" },
            omit: { passwordHash: true },
          }),
          employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
          workforceHistory: await prisma.workforceManagementChange.findMany(),
          accountHistory: await prisma.accountManagementChange.findMany(),
        },
      })
    })
    upstream.use((request, _response, next) => {
      if (request.path.startsWith("/api/employees"))
        receipts.push(`${request.method} ${request.path}`)
      next()
    })
    upstream.use(createApp())
    const server = upstream.listen(5286, "127.0.0.1")
    beforeShutdown(() => closeServer(server))
    await once(server, "listening")
    await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
  },
)
