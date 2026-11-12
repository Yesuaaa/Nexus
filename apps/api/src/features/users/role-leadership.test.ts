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
  "role changes cannot strand department heads or team leads outside STAFF",
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

    for (const [id, role] of [
      ["actor", Role.SUPERADMIN],
      ["head", Role.STAFF],
      ["lead", Role.STAFF],
      ["member", Role.STAFF],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@example.com`,
          fullName: `${id} Person`,
          passwordHash: "private-hash",
        },
      })
    const department = await prisma.department.create({
      data: { name: "Design", headId: "head" },
    })
    await prisma.team.create({
      data: { name: "Creative", departmentId: department.id, leadId: "lead" },
    })
    const session = await issueSession(
      await prisma.user.findUniqueOrThrow({ where: { id: "actor" } }),
    )
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const changeRole = (id: string, role: Role) =>
      fetch(`${base}/users/${id}/role`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role }),
      })
    const roleOf = async (id: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { id } })).role

    await t.test("department heads keep STAFF until reassigned", async () => {
      for (const role of [Role.USER, Role.ADMIN, Role.SUPERADMIN]) {
        const response = await changeRole("head", role)
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error:
            "Reassign the Design head role before changing this account's role",
        })
        assert.equal(await roleOf("head"), Role.STAFF)
      }
      assert.equal(
        (
          await prisma.department.findUniqueOrThrow({
            where: { id: department.id },
          })
        ).headId,
        "head",
      )
    })

    await t.test("team leads keep STAFF until reassigned", async () => {
      for (const role of [Role.USER, Role.ADMIN, Role.SUPERADMIN]) {
        const response = await changeRole("lead", role)
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error:
            "Reassign the Creative team lead role before changing this account's role",
        })
        assert.equal(await roleOf("lead"), Role.STAFF)
      }
    })

    await t.test(
      "STAFF without leadership and reassigned heads can change role",
      async () => {
        assert.equal((await changeRole("member", Role.USER)).status, 200)
        assert.equal(await roleOf("member"), Role.USER)
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal((await changeRole("head", Role.ADMIN)).status, 200)
        assert.equal(await roleOf("head"), Role.ADMIN)
      },
    )
  },
)
