import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../app.js"
import { getPrisma } from "../lib/db.js"

test(
  "mobile regression: native client API journey and isolation",
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
    const migrations = new URL("../../prisma/migrations/", import.meta.url)
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
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    async function request(path: string, token?: string, body?: unknown) {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "user-agent": "Nexus-Mobile-Regression",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      assert.equal(response.headers.get("set-cookie"), null)
      assert.equal(response.headers.get("cache-control"), "no-store")
      return response
    }
    type Session = {
      token: string
      refreshToken: string
      expiresIn: number
      user: { id: string; role: string; isActive: boolean; email: string }
    }
    const password = "MobileRegression123!"
    async function register(email: string): Promise<Session> {
      const response = await request("/auth/register", undefined, {
        email,
        password,
        fullName: "Mobile Client",
        contactNumber: "09123456789",
        role: "SUPERADMIN",
      })
      assert.equal(response.status, 201)
      const session = (await response.json()) as Session
      assert.equal(session.user.role, "USER")
      assert.equal(session.user.isActive, true)
      assert.equal(typeof session.token, "string")
      assert.equal(typeof session.refreshToken, "string")
      assert.ok(session.expiresIn > 0)
      assert.equal("passwordHash" in session.user, false)
      return session
    }
    const client = await register("mobile.one@example.com")
    const other = await register("mobile.two@example.com")
    const service = await prisma.service.create({
      data: {
        name: "Mobile design",
        description: "Mobile regression service",
        packages: {
          create: {
            name: "Starter",
            description: "Starter package",
            pricingModel: "FIXED",
            amount: "1500",
            isPricingPublic: true,
          },
        },
      },
      include: { packages: true },
    })
    const inactive = await prisma.service.create({
      data: {
        name: "Retired service",
        description: "Retired",
        isActive: false,
      },
    })
    const draft = {
      serviceId: service.id,
      packageId: service.packages[0].id,
      preferredSpecialistId: null,
      submissionKey: randomUUID(),
      goals: "Reach mobile clients",
      requirements: "Accessible mobile booking",
      expectedTimeline: "Six weeks",
      additionalDetails: "Portrait and landscape",
    }
    let requestId = ""

    await t.test(
      "native bearer restores the registered account without browser cookies",
      async () => {
        const response = await request("/auth/me", client.token)
        assert.equal(response.status, 200)
        assert.equal(
          ((await response.json()) as { user: { id: string } }).user.id,
          client.user.id,
        )
        const login = await request("/auth/login", undefined, {
          email: client.user.email,
          password,
        })
        assert.equal(login.status, 200)
        assert.equal(((await login.json()) as Session).user.id, client.user.id)
      },
    )
    for (const path of [
      "/auth/me",
      "/client/services",
      "/client/service-requests",
    ]) {
      await t.test(
        `${path} rejects missing and invalid bearer credentials`,
        async () => {
          for (const token of [undefined, "invalid-token"])
            assert.equal((await request(path, token)).status, 401)
        },
      )
    }
    await t.test(
      "catalog and details expose only active services with mobile package fields",
      async () => {
        const response = await request("/client/services", client.token)
        assert.equal(response.status, 200)
        const catalog = (await response.json()) as {
          services: { id: string; packages: { id: string; amount: string }[] }[]
        }
        assert.deepEqual(
          catalog.services.map((row) => row.id),
          [service.id],
        )
        assert.equal(catalog.services[0].packages[0].amount, "1500")
        assert.equal(
          (await request(`/client/services/${service.id}`, client.token))
            .status,
          200,
        )
        assert.equal(
          (await request(`/client/services/${inactive.id}`, client.token))
            .status,
          404,
        )
        const specialists = await request(
          `/client/services/${service.id}/specialists`,
          client.token,
        )
        assert.equal(specialists.status, 200)
        assert.deepEqual(await specialists.json(), { specialists: [] })
      },
    )
    await t.test(
      "invalid booking is rejected without persistence",
      async () => {
        for (const changes of [
          { goals: "" },
          { requirements: "" },
          { expectedTimeline: "" },
          { submissionKey: "bad" },
        ]) {
          assert.equal(
            (
              await request("/client/service-requests", client.token, {
                ...draft,
                ...changes,
              })
            ).status,
            400,
          )
        }
        assert.equal(await prisma.serviceRequest.count(), 0)
      },
    )
    await t.test(
      "retrying the same mobile submission creates exactly one owned request",
      async () => {
        const response = await request(
          "/client/service-requests",
          client.token,
          { ...draft, clientId: other.user.id },
        )
        assert.equal(response.status, 201)
        const receipt = (await response.json()) as {
          serviceRequest: {
            id: string
            status: string
            referenceNumber: string
          }
        }
        requestId = receipt.serviceRequest.id
        assert.equal(receipt.serviceRequest.status, "SUBMITTED")
        assert.ok(receipt.serviceRequest.referenceNumber)
        const replay = await request(
          "/client/service-requests",
          client.token,
          draft,
        )
        assert.equal(replay.status, 201)
        assert.deepEqual(await replay.json(), receipt)
        assert.equal(await prisma.serviceRequest.count(), 1)
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: requestId },
            })
          ).clientId,
          client.user.id,
        )
      },
    )
    await t.test(
      "history, search and KPIs remain scoped to the signed-in account",
      async () => {
        for (const [token, count] of [
          [client.token, 1],
          [other.token, 0],
        ] as const) {
          const response = await request(
            `/client/service-requests?clientId=${client.user.id}&sortOrder=asc&page=1`,
            token,
          )
          assert.equal(response.status, 200)
          const page = (await response.json()) as {
            total: number
            summary: { total: number }
            requests: { id: string }[]
          }
          assert.equal(page.total, count)
          assert.equal(page.summary.total, count)
          assert.equal(page.requests.length, count)
        }
        const response = await request(
          "/client/service-requests?search=nonexistent-mobile-title",
          client.token,
        )
        assert.equal(response.status, 200)
        assert.equal(((await response.json()) as { total: number }).total, 0)
      },
    )
    await t.test(
      "another account cannot read or cancel the mobile request",
      async () => {
        for (const body of [undefined, {}]) {
          const response = await request(
            `/${body ? "client/" : ""}service-requests/${requestId}${body ? "/cancel" : ""}`,
            other.token,
            body,
          )
          assert.equal(response.status, body ? 409 : 404)
        }
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: requestId },
            })
          ).status,
          "SUBMITTED",
        )
      },
    )
    await t.test(
      "detail and direct cancellation update the database and history",
      async () => {
        assert.equal(
          (await request(`/service-requests/${requestId}`, client.token))
            .status,
          200,
        )
        const cancelled = await request(
          `/client/service-requests/${requestId}/cancel`,
          client.token,
          {},
        )
        assert.equal(cancelled.status, 200)
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: requestId },
            })
          ).status,
          "CANCELLED",
        )
        const response = await request(
          "/client/service-requests?status=CANCELLED",
          client.token,
        )
        assert.equal(response.status, 200)
        const page = (await response.json()) as {
          total: number
          summary: { cancelled: number }
        }
        assert.equal(page.total, 1)
        assert.equal(page.summary.cancelled, 1)
      },
    )
    await t.test(
      "refresh and logout revoke the mobile credentials",
      async () => {
        const response = await request("/auth/refresh", undefined, {
          refreshToken: client.refreshToken,
        })
        assert.equal(response.status, 200)
        const rotated = (await response.json()) as Session
        assert.notEqual(rotated.refreshToken, client.refreshToken)
        assert.equal((await request("/auth/me", rotated.token)).status, 200)
        assert.equal(
          (await request("/auth/logout", rotated.token, {})).status,
          204,
        )
        assert.equal((await request("/auth/me", rotated.token)).status, 401)
        assert.equal(
          (
            await request("/auth/refresh", undefined, {
              refreshToken: rotated.refreshToken,
            })
          ).status,
          401,
        )
        assert.equal((await request("/auth/me", other.token)).status, 200)
      },
    )
  },
)
