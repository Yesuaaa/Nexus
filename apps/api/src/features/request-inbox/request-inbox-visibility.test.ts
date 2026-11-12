import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { getPrisma } from "../../lib/db.js"
import { Role } from "../../generated/prisma/client.js"
import { issueSession } from "../auth/auth.service.js"

test(
  "shared service requests leave other linked departments' inboxes once accepted",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const database = new PGlite()
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await cleanup.socket?.stop()
      await database.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await database.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    const socket = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
    })
    cleanup.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma

    async function user(name: string, role: Role) {
      const record = await prisma.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          contactNumber: "09123456789",
          passwordHash: "private-hash",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        ...record,
        headers: { authorization: `Bearer ${session.token}` },
      }
    }
    const client = await user("Client", Role.USER)
    const designHead = await user("DesignHead", Role.STAFF)
    const marketingHead = await user("MarketingHead", Role.STAFF)
    const design = await prisma.department.create({
      data: { name: "Design", headId: designHead.id },
    })
    const marketing = await prisma.department.create({
      data: { name: "Marketing", headId: marketingHead.id },
    })
    const shared = await prisma.service.create({
      data: {
        name: "Shared",
        description: "Shared",
        departments: { connect: [{ id: design.id }, { id: marketing.id }] },
      },
    })
    const accepted = await prisma.serviceRequest.create({
      data: {
        referenceNumber: "SR-SHARED-ACCEPTED",
        clientId: client.id,
        serviceId: shared.id,
        title: "Accepted by Design",
        projectGoals: "Private goals",
        projectRequirements: "Private requirements",
      },
    })
    const open = await prisma.serviceRequest.create({
      data: {
        referenceNumber: "SR-SHARED-OPEN",
        clientId: client.id,
        serviceId: shared.id,
        title: "Still open",
      },
    })
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const get = (path: string, actor: { headers: Record<string, string> }) =>
      fetch(`${base}${path}`, { headers: actor.headers })
    const accept = (id: string, actor: { headers: Record<string, string> }) =>
      fetch(`${base}/request-inbox/${id}/accept`, {
        method: "POST",
        headers: actor.headers,
      })
    const listIds = async (
      actor: { headers: Record<string, string> },
      query = "view=all",
    ) => {
      const response = await get(`/request-inbox?${query}`, actor)
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        serviceRequests: { id: string }[]
        total: number
      }
      assert.equal(body.total, body.serviceRequests.length)
      return body.serviceRequests.map((request) => request.id).sort()
    }

    await t.test("both linked heads see unaccepted requests", async () => {
      const both = [accepted.id, open.id].sort()
      assert.deepEqual(await listIds(designHead), both)
      assert.deepEqual(await listIds(marketingHead), both)
      for (const actor of [designHead, marketingHead])
        assert.equal(
          (await get(`/request-inbox/${accepted.id}`, actor)).status,
          200,
        )
    })

    await t.test("only the accepting department keeps access", async () => {
      assert.equal((await accept(accepted.id, designHead)).status, 200)

      assert.deepEqual(await listIds(marketingHead), [open.id])
      assert.deepEqual(await listIds(marketingHead, "view=under-review"), [])
      assert.deepEqual(
        await listIds(marketingHead, "view=all&search=SR-SHARED-ACCEPTED"),
        [],
      )
      assert.equal(
        (await get(`/request-inbox/${accepted.id}`, marketingHead)).status,
        404,
      )
      // Losing the acceptance race still reports a conflict, without details.
      const conflict = await accept(accepted.id, marketingHead)
      assert.equal(conflict.status, 409)
      assert.deepEqual(Object.keys((await conflict.json()) as object), [
        "error",
      ])

      assert.deepEqual(await listIds(designHead), [accepted.id, open.id].sort())
      assert.deepEqual(await listIds(designHead, "view=under-review"), [
        accepted.id,
      ])
      const details = await get(`/request-inbox/${accepted.id}`, designHead)
      assert.equal(details.status, 200)
      const { serviceRequest } = (await details.json()) as {
        serviceRequest: { acceptedDepartmentId: string; projectGoals: string }
      }
      assert.equal(serviceRequest.acceptedDepartmentId, design.id)
      assert.equal(serviceRequest.projectGoals, "Private goals")
    })

    await t.test(
      "other linked heads can still accept unaccepted requests",
      async () => {
        assert.equal((await accept(open.id, marketingHead)).status, 200)
        assert.deepEqual(await listIds(marketingHead), [open.id])
        assert.deepEqual(await listIds(designHead), [accepted.id])
        assert.equal(
          (await get(`/request-inbox/${open.id}`, designHead)).status,
          404,
        )
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: open.id },
            })
          ).acceptedDepartmentId,
          marketing.id,
        )
      },
    )
  },
)
