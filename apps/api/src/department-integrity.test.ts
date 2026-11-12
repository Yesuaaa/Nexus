import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import express from "express"
import { createApp } from "./app.js"
import { Prisma } from "./generated/prisma/client.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"
import { handleError } from "./shared/error-handler.js"

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.once("listening", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function close(server: Server | undefined) {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()))
}

test(
  "department and employee writes keep head, lead, and history integrity",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    const cleanup: {
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      await close(cleanup.server)
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await db.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma

    const admin = await prisma.user.create({
      data: {
        id: "admin",
        email: "admin@integrity.example",
        fullName: "Admin Person",
        passwordHash: "test-only-hash",
        role: "ADMIN",
      },
    })
    const token = (await issueSession(admin)).token

    await prisma.department.create({
      data: { id: "dept-a", name: "Product" },
    })
    await prisma.team.create({
      data: { id: "team-a", name: "Design", departmentId: "dept-a" },
    })
    async function staff(
      id: string,
      position: string | null,
      startDate: string,
      teamId: string | null = null,
    ) {
      await prisma.user.create({
        data: {
          id,
          email: `${id}@integrity.example`,
          fullName: `${id} Person`,
          passwordHash: "test-only-hash",
          role: "STAFF",
          position,
          departmentId: "dept-a",
          teamId,
          employee: {
            create: {
              id: `emp-${id}`,
              employeeId: `EXP-${id}`,
              fullName: `${id} Person`,
              position,
              startDate: new Date(startDate),
              departmentId: "dept-a",
              teamId,
            },
          },
        },
      })
    }
    await staff("head", "Department Head", "2020-01-01")
    await staff("deputy", "Designer", "2021-01-01")
    await staff("stale", "Department Head", "2022-01-01")
    await staff("lead", "Team Lead", "2022-06-01", "team-a")
    await prisma.department.update({
      where: { id: "dept-a" },
      data: { headId: "head" },
    })
    await prisma.team.update({
      where: { id: "team-a" },
      data: { leadId: "lead" },
    })

    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    const base = `${await listen(server)}/api`
    async function request(path: string, method = "GET", body?: unknown) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = (await response.json()) as { error?: string }
      return { status: response.status, payload }
    }

    await t.test(
      "loading department detail keeps an on-leave head's title",
      async () => {
        const leave = await request("/employees/emp-head", "PUT", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "emp-deputy",
        })
        assert.equal(leave.status, 200, JSON.stringify(leave.payload))
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(department.headId, "deputy")
        assert.equal(department.temporaryHeadOriginalId, "head")
        assert.equal(department.temporaryHeadAssignedId, "deputy")

        const detail = await request("/departments/dept-a")
        assert.equal(detail.status, 200, JSON.stringify(detail.payload))

        const head = await prisma.user.findUniqueOrThrow({
          where: { id: "head" },
          include: { employee: true },
        })
        assert.equal(head.position, "Department Head")
        assert.equal(head.employee?.position, "Department Head")
        // Stale titles on everyone else are still cleaned up.
        const stale = await prisma.user.findUniqueOrThrow({
          where: { id: "stale" },
          include: { employee: true },
        })
        assert.equal(stale.position, null)
        assert.equal(stale.employee?.position, null)
      },
    )

    await t.test(
      "restoring an on-leave head onto a sub-team is rejected",
      async () => {
        const rejected = await request("/employees/emp-head", "PUT", {
          status: "ACTIVE",
          teamId: "team-a",
        })
        assert.equal(rejected.status, 400, JSON.stringify(rejected.payload))
        assert.match(rejected.payload.error ?? "", /cannot be assigned/)

        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(department.headId, "deputy")
        assert.equal(department.temporaryHeadOriginalId, "head")
        assert.equal(department.temporaryHeadAssignedId, "deputy")
        const head = await prisma.user.findUniqueOrThrow({
          where: { id: "head" },
          include: { employee: true },
        })
        assert.equal(head.teamId, null)
        assert.equal(head.employee?.teamId, null)
        assert.equal(head.employee?.status, "ON_LEAVE")

        // Returning without a team restores the original head.
        const restored = await request("/employees/emp-head", "PUT", {
          status: "ACTIVE",
          position: "Department Head",
        })
        assert.equal(restored.status, 200, JSON.stringify(restored.payload))
        const after = await prisma.department.findUniqueOrThrow({
          where: { id: "dept-a" },
        })
        assert.equal(after.headId, "head")
        assert.equal(after.temporaryHeadOriginalId, null)
        assert.equal(after.temporaryHeadAssignedId, null)
      },
    )

    await t.test("a Team Lead going inactive steps down as lead", async () => {
      const inactive = await request("/employees/emp-lead", "PUT", {
        status: "INACTIVE",
      })
      assert.equal(inactive.status, 200, JSON.stringify(inactive.payload))
      const team = await prisma.team.findUniqueOrThrow({
        where: { id: "team-a" },
      })
      assert.equal(team.leadId, null)
      const lead = await prisma.employee.findUniqueOrThrow({
        where: { id: "emp-lead" },
      })
      assert.equal(lead.status, "INACTIVE")
      assert.equal(lead.teamId, "team-a")
    })

    await t.test(
      "deleting a department with request history returns 409",
      async () => {
        const client = await prisma.user.create({
          data: {
            email: "client@integrity.example",
            fullName: "Client Person",
            passwordHash: "test-only-hash",
            role: "USER",
          },
        })
        const service = await prisma.service.create({
          data: { name: "Branding", description: "Brand work" },
        })
        await prisma.department.createMany({
          data: [
            { id: "dept-accepted", name: "Accepted Requests" },
            { id: "dept-chat", name: "Conversation Only" },
            { id: "dept-service", name: "Linked Service" },
          ],
        })
        await prisma.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "Accepted request",
            status: "UNDER_REVIEW",
            acceptedDepartmentId: "dept-accepted",
            acceptedAt: new Date(),
          },
        })
        await prisma.requestConversation.create({
          data: { clientId: client.id, departmentId: "dept-chat" },
        })
        await prisma.service.update({
          where: { id: service.id },
          data: { departments: { connect: { id: "dept-service" } } },
        })
        await prisma.requestConversation.create({
          data: { clientId: client.id, departmentId: "dept-service" },
        })

        for (const id of ["dept-accepted", "dept-chat"]) {
          const deleted = await request(`/departments/${id}`, "DELETE")
          assert.equal(deleted.status, 409, id)
          assert.equal(
            deleted.payload.error,
            "This department has client request history and can't be deleted",
          )
          assert.ok(await prisma.department.findUnique({ where: { id } }))
        }
        const linked = await request("/departments/dept-service", "DELETE")
        assert.equal(linked.status, 409)
        assert.equal(
          linked.payload.error,
          "Reassign or remove this department's services before deleting the department",
        )

        await prisma.department.create({
          data: { id: "dept-empty", name: "Empty" },
        })
        const emptyDelete = await request("/departments/dept-empty", "DELETE")
        assert.equal(emptyDelete.status, 200)
        assert.equal(
          await prisma.department.findUnique({ where: { id: "dept-empty" } }),
          null,
        )
      },
    )

    await t.test(
      "the error handler maps foreign key failures to 409",
      async () => {
        const app = express()
        app.get("/fk", () => {
          throw new Prisma.PrismaClientKnownRequestError(
            "Foreign key constraint violated",
            { code: "P2003", clientVersion: "test" },
          )
        })
        app.use(handleError)
        const fkServer = app.listen(0, "127.0.0.1")
        try {
          const response = await fetch(`${await listen(fkServer)}/fk`)
          assert.equal(response.status, 409)
          const body = (await response.json()) as { error: string }
          assert.equal(
            body.error,
            "This record is linked to other data and can't be changed or deleted",
          )
        } finally {
          await close(fkServer)
        }
      },
    )
  },
)
