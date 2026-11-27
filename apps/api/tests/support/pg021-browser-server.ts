import { once } from "node:events"
import { test } from "node:test"
import express from "express"
import { createApp } from "../../src/app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { closeServer, startPgliteDatabase } from "./pglite-app.js"

test(
  "PG-021 disposable rewrite upstream",
  { timeout: 1_800_000 },
  async (t) => {
    const { prisma, beforeShutdown } = await startPgliteDatabase(t)
    const admin = await prisma.user.create({
      data: {
        email: "pg021-admin@example.test",
        role: "ADMIN",
        passwordHash: "fixture",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "pg021-member@example.test",
        fullName: "PG021 Candidate",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const department = await prisma.department.create({
      data: { name: "PG021 Engineering" },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "PG021",
        fullName: "PG021 Candidate",
        email: staff.email,
        userId: staff.id,
        status: "ACTIVE",
      },
    })
    const { token } = await issueSession(admin)
    const receipts: string[] = []
    const upstream = express()
    upstream.get("/__pg021", async (_request, response) => {
      response.json({
        token,
        departmentId: department.id,
        actorId: admin.id,
        receipts,
        userDepartmentId: (
          await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })
        ).departmentId,
        employeeDepartmentId: (
          await prisma.employee.findUniqueOrThrow({
            where: { id: employee.id },
          })
        ).departmentId,
        history: await prisma.workforceManagementChange.findMany(),
      })
    })
    upstream.use((request, _response, next) => {
      receipts.push(`${request.method} ${request.path}`)
      next()
    })
    upstream.use(createApp())
    const server = upstream.listen(5284, "127.0.0.1")
    beforeShutdown(() => closeServer(server))
    await once(server, "listening")
    await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
  },
)
