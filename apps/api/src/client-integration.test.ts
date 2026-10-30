import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"

test(
  "client directory reads only client accounts without exposing credentials",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
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
      .sort()) {
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const tokens = new Map<string, string>()
    for (const role of ["ADMIN", "SUPERADMIN", "STAFF", "USER"] as const) {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@example.com`,
          role,
          fullName: `${role} Person`,
          passwordHash: "secret-hash",
        },
      })
      tokens.set(role, (await issueSession(user)).token)
    }
    for (let i = 0; i < 22; i++) {
      await prisma.user.create({
        data: {
          id: `client-${String(i).padStart(2, "0")}`,
          email: `client${String(i).padStart(2, "0")}@example.com`,
          fullName: i === 0 ? null : `Client ${String(i).padStart(2, "0")}`,
          contactNumber: i === 0 ? null : "+63 917 000 0101",
          role: "USER",
          isActive: i !== 1,
          passwordHash: "never-return-this",
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
      })
    }
    const service = await prisma.service.create({
      data: { name: "Client service", description: "Test service" },
    })
    for (const [clientId, count] of [
      ["client-00", 12],
      ["client-01", 1],
    ] as const) {
      for (let i = 0; i < count; i++) {
        await prisma.serviceRequest.create({
          data: {
            clientId,
            serviceId: service.id,
            title: `Request ${clientId} ${i}`,
            description: "private description",
            status: i % 2 === 0 ? "SUBMITTED" : "CLOSED",
            createdAt: new Date(
              `2026-10-${String(10 + (i % 2)).padStart(2, "0")}T00:00:00Z`,
            ),
          },
        })
      }
      await prisma.project.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          clientId,
          name: `Project ${clientId} ${i}`,
          status: i % 2 === 0 ? ("PLANNED" as const) : ("COMPLETED" as const),
          startDate: i === 0 ? null : new Date("2026-10-01T00:00:00Z"),
          createdAt: new Date(
            `2026-10-${String(10 + (i % 2)).padStart(2, "0")}T00:00:00Z`,
          ),
        })),
      })
    }
    await prisma.user.create({
      data: {
        email: "deleted@example.com",
        role: "USER",
        passwordHash: "deleted-secret",
        accountDeletedAt: new Date(),
      },
    })
    const deletedClient = await prisma.user.findUniqueOrThrow({
      where: { email: "deleted@example.com" },
      select: { id: true },
    })
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@example.com" },
      select: { id: true },
    })
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/clients`
    const request = (query = "", actor = "ADMIN", method = "GET") =>
      fetch(`${base}${query}`, {
        method,
        headers: { authorization: `Bearer ${tokens.get(actor)}` },
      })
    type List = {
      clients: {
        id: string
        fullName: string | null
        email: string
        contactNumber: string | null
        isActive: boolean
        createdAt: string
      }[]
      total: number
      page: number
      pageSize: number
    }
    async function list(query = "", actor = "ADMIN") {
      const response = await request(query, actor)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get("cache-control"), "no-store")
      return (await response.json()) as List
    }
    const related = (
      clientId: string,
      resource = "",
      query = "",
      actor = "ADMIN",
    ) =>
      fetch(`${base}/${clientId}${resource}${query}`, {
        headers: { authorization: `Bearer ${tokens.get(actor)}` },
      })
    await t.test(
      "only Admin can read; Superadmin, Staff, User and anonymous cannot",
      async () => {
        await list()
        for (const actor of ["SUPERADMIN", "STAFF", "USER"])
          assert.equal((await request("", actor)).status, 403)
        assert.equal((await fetch(base)).status, 401)
      },
    )
    await t.test(
      "only undeleted USER records, with a safe projection and nullable contact fields",
      async () => {
        const result = await list("?sortBy=email&sortOrder=asc")
        assert.equal(result.total, 23)
        assert.deepEqual(
          Object.keys(result.clients[0]).sort(),
          [
            "id",
            "fullName",
            "email",
            "contactNumber",
            "isActive",
            "createdAt",
          ].sort(),
        )
        assert.equal(result.clients[0].fullName, null)
        assert.equal(result.clients[0].contactNumber, null)
        assert.equal(JSON.stringify(result).includes("secret"), false)
        assert.equal(
          result.clients.some(
            (client) => client.email === "deleted@example.com",
          ),
          false,
        )
      },
    )
    await t.test(
      "search matches name or email case-insensitively and combines with status",
      async () => {
        assert.equal((await list("?search=CLIENT%2001")).total, 1)
        assert.equal(
          (await list("?search=CLIENT01%40EXAMPLE.COM&status=INACTIVE")).total,
          1,
        )
        assert.equal((await list("?search=client01&status=ACTIVE")).total, 0)
        assert.equal((await list("?search=not-found")).total, 0)
        assert.equal((await list("?status=INACTIVE")).total, 1)
      },
    )
    await t.test(
      "sorting and pagination are stable, including tied dates and out-of-range pages",
      async () => {
        const first = await list()
        const second = await list("?page=2")
        const third = await list("?page=3")
        assert.equal(first.pageSize, 10)
        assert.equal(second.pageSize, 10)
        assert.equal(third.pageSize, 10)
        assert.equal(first.clients.length, 10)
        assert.equal(second.clients.length, 10)
        assert.equal(third.clients.length, 3)
        assert.equal(
          new Set(
            [...first.clients, ...second.clients, ...third.clients].map(
              (client) => client.id,
            ),
          ).size,
          23,
        )
        assert.deepEqual((await list()).clients, first.clients)
        const asc = await list("?sortBy=email&sortOrder=asc")
        assert.equal(asc.clients[0].email, "client00@example.com")
        const desc = await list("?sortBy=email&sortOrder=desc")
        assert.equal(desc.clients[0].email, "user@example.com")
        for (const sortBy of ["fullName", "createdAt", "isActive"])
          await list(`?sortBy=${sortBy}&sortOrder=asc`)
        assert.deepEqual((await list("?page=99")).clients, [])
      },
    )
    await t.test(
      "rejects malformed filters and unsupported collection methods",
      async () => {
        for (const query of [
          "?page=0",
          "?page=1.5",
          "?page=1000001",
          "?page=1&page=2",
          "?status=ON_LEAVE",
          "?status=ACTIVE&status=INACTIVE",
          "?sortBy=passwordHash",
          "?sortOrder=random",
          `?search=${"a".repeat(101)}`,
        ]) {
          assert.equal((await request(query)).status, 400, query)
        }
        for (const method of ["PATCH", "PUT", "DELETE"])
          assert.equal((await request("", "ADMIN", method)).status, 404)
        assert.equal((await request("", "ADMIN", "POST")).status, 400)
      },
    )
    await t.test(
      "summary and related records expose safe isolated paginated data",
      async () => {
        const summaryResponse = await related("client-00")
        assert.equal(summaryResponse.status, 200)
        const summary = (await summaryResponse.json()) as Record<
          string,
          unknown
        >
        assert.deepEqual(Object.keys(summary).sort(), [
          "client",
          "projectCount",
          "serviceRequestCount",
        ])
        const client = summary.client as Record<string, unknown>
        assert.deepEqual(
          Object.keys(client).sort(),
          [
            "id",
            "fullName",
            "email",
            "contactNumber",
            "isActive",
            "createdAt",
          ].sort(),
        )
        assert.equal(summary.serviceRequestCount, 12)
        assert.equal(summary.projectCount, 12)
        assert.equal(JSON.stringify(summary).includes("secret"), false)

        const firstResponse = await related("client-00", "/service-requests")
        assert.equal(firstResponse.status, 200)
        const first = (await firstResponse.json()) as {
          serviceRequests: Record<string, unknown>[]
          total: number
          page: number
          pageSize: number
        }
        assert.equal(first.total, 12)
        assert.equal(first.pageSize, 10)
        assert.equal(first.serviceRequests.length, 10)
        assert.deepEqual(
          Object.keys(first.serviceRequests[0]!).sort(),
          ["id", "title", "status", "createdAt", "service"].sort(),
        )
        assert.deepEqual(first.serviceRequests[0]!.service, {
          id: service.id,
          name: service.name,
        })
        assert.equal(
          JSON.stringify(first).includes("private description"),
          false,
        )
        const second = (await (
          await related("client-00", "/service-requests", "?page=2")
        ).json()) as { serviceRequests: { id: string }[]; page: number }
        assert.equal(second.page, 2)
        assert.equal(second.serviceRequests.length, 2)
        assert.equal(
          new Set([
            ...first.serviceRequests.map((item) => item.id),
            ...second.serviceRequests.map((item) => item.id),
          ]).size,
          12,
        )

        const projectsResponse = await related("client-00", "/projects")
        assert.equal(projectsResponse.status, 200)
        const projects = (await projectsResponse.json()) as {
          projects: Record<string, unknown>[]
          total: number
          page: number
          pageSize: number
        }
        assert.equal(projects.total, 12)
        assert.equal(projects.pageSize, 10)
        assert.deepEqual(
          Object.keys(projects.projects[0]!).sort(),
          ["id", "name", "status", "startDate", "createdAt"].sort(),
        )
        assert.equal(
          projects.projects.some((project) => project.startDate === null),
          true,
        )
        assert.equal(
          (await related("client-00", "/projects", "", "SUPERADMIN")).status,
          403,
        )

        const isolated = (await (
          await related("client-01", "/service-requests")
        ).json()) as { serviceRequests: { title: string }[]; total: number }
        assert.equal(isolated.total, 1)
        assert.match(isolated.serviceRequests[0]!.title, /client-01/)
        assert.equal(
          (await related("client-02", "/service-requests")).status,
          200,
        )
        const empty = (await (
          await related("client-02", "/projects")
        ).json()) as { total: number; projects: unknown[] }
        assert.equal(empty.total, 0)
        assert.deepEqual(empty.projects, [])
      },
    )
    await t.test(
      "rejects malformed ids and pages, hides missing/deleted/non-client parents, and protects reads",
      async () => {
        for (const id of ["bad.id", "space here", "x".repeat(81)])
          assert.equal((await related(id)).status, 400)
        for (const page of ["0", "1.5", "1000001", "1&page=2"])
          assert.equal(
            (await related("client-00", "/projects", `?page=${page}`)).status,
            400,
          )
        for (const id of ["missing", deletedClient.id, adminUser.id]) {
          for (const path of ["", "/projects", "/service-requests"])
            assert.equal((await related(id, path)).status, 404)
        }
        for (const path of ["", "/projects", "/service-requests"]) {
          assert.equal(
            (await related("client-00", path, "", "STAFF")).status,
            403,
          )
          assert.equal(
            (await related("client-00", path, "", "USER")).status,
            403,
          )
        }
        assert.equal((await fetch(`${base}/client-00/projects`)).status, 401)
      },
    )
    await t.test(
      "client mutations validate input, enforce admin access, and preserve history",
      async () => {
        const mutate = (
          path: string,
          method: string,
          body?: unknown,
          actor = "ADMIN",
        ) =>
          fetch(`${base}${path}`, {
            method,
            headers: {
              authorization: `Bearer ${tokens.get(actor)}`,
              "content-type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        const input = {
          fullName: "New Client",
          email: "New.Client@example.com",
          contactNumber: "+63 917 123 4567",
          isActive: true,
          password: "client initial password",
        }
        for (const actor of ["STAFF", "USER", "SUPERADMIN"]) {
          assert.equal((await mutate("", "POST", input, actor)).status, 403)
          assert.equal(
            (await mutate("/client-02", "PATCH", input, actor)).status,
            403,
          )
          assert.equal(
            (await mutate("/client-02", "DELETE", undefined, actor)).status,
            403,
          )
        }
        assert.equal(
          (await mutate("", "POST", { ...input, password: "short" })).status,
          400,
        )
        assert.equal(
          (await mutate("", "POST", { ...input, contactNumber: "bad" })).status,
          400,
        )
        const created = await mutate("", "POST", {
          ...input,
          role: "SUPERADMIN",
        })
        assert.equal(created.status, 201)
        const { client } = (await created.json()) as {
          client: { id: string; email: string }
        }
        assert.equal(client.email, "new.client@example.com")
        assert.equal("passwordHash" in client, false)
        const stored = await prisma.user.findUniqueOrThrow({
          where: { id: client.id },
        })
        assert.equal(stored.role, "USER")
        assert.notEqual(stored.passwordHash, input.password)
        assert.equal((await mutate("", "POST", input)).status, 409)
        assert.equal(
          (
            await mutate(`/${client.id}`, "PATCH", {
              ...input,
              email: "ADMIN@example.com",
            })
          ).status,
          409,
        )
        const session = await prisma.session.create({
          data: {
            userId: client.id,
            tokenHash: "client-session",
            expiresAt: new Date(Date.now() + 60000),
          },
        })
        assert.equal(
          (
            await mutate(`/${client.id}`, "PATCH", {
              ...input,
              fullName: "Updated Client",
              isActive: false,
              password: "ignored password",
            })
          ).status,
          200,
        )
        assert.equal(
          await prisma.session.count({ where: { id: session.id } }),
          0,
        )
        const updated = await prisma.user.findUniqueOrThrow({
          where: { id: client.id },
        })
        assert.equal(updated.fullName, "Updated Client")
        assert.equal(updated.passwordHash, stored.passwordHash)
        assert.equal(
          (await mutate(`/${adminUser.id}`, "PATCH", input)).status,
          404,
        )
        assert.equal((await mutate(`/${adminUser.id}`, "DELETE")).status, 404)
        assert.equal((await mutate("/client-00", "DELETE")).status, 409)
        assert.equal(
          await prisma.project.count({ where: { clientId: "client-00" } }),
          12,
        )
        assert.equal((await mutate(`/${client.id}`, "DELETE")).status, 204)
        assert.equal((await related(client.id)).status, 404)
        assert.equal(
          (await mutate(`/${client.id}`, "PATCH", input)).status,
          404,
        )
        assert.equal((await mutate(`/${client.id}`, "DELETE")).status, 404)
        assert.equal((await mutate("", "POST", input)).status, 409)
      },
    )
    await t.test(
      "soft deletion preserves client records and permanent deletion returns a conflict",
      async () => {
        await prisma.user.update({
          where: { id: "client-00" },
          data: { isActive: false },
        })
        const userUrl = `${base.replace("/clients", "/users")}/client-00`
        const softDeleteResponse = await fetch(userUrl, {
          method: "DELETE",
          headers: { authorization: `Bearer ${tokens.get("SUPERADMIN")}` },
        })
        assert.equal(softDeleteResponse.status, 200)
        assert.ok(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "client-00" },
            })
          ).accountDeletedAt,
        )

        const permanentDeleteResponse = await fetch(`${userUrl}/permanent`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${tokens.get("SUPERADMIN")}` },
        })
        assert.equal(permanentDeleteResponse.status, 409)
        assert.equal(
          await prisma.serviceRequest.count({
            where: { clientId: "client-00" },
          }),
          12,
        )
        assert.equal(
          await prisma.project.count({ where: { clientId: "client-00" } }),
          12,
        )
      },
    )
  },
)
