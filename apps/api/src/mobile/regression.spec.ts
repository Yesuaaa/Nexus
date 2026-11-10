import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../app.js"
import { issueSession } from "../features/auth/auth.service.js"
import type { Role } from "../generated/prisma/client.js"
import { getPrisma } from "../lib/db.js"

test(
  "mobile regression: native client API journey and isolation",
  { timeout: 180_000 },
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
    const streamSubscribers = new Map<
      string,
      Set<{ onChange: () => void; onStatus: (connected: boolean) => void }>
    >()
    function notifyStream(conversationId: string) {
      for (const sub of streamSubscribers.get(conversationId) ?? [])
        sub.onChange()
    }
    const server = createApp({
      conversationRealtime: {
        async subscribe(conversationId, onChange, onStatus) {
          let set = streamSubscribers.get(conversationId)
          if (!set) {
            set = new Set()
            streamSubscribers.set(conversationId, set)
          }
          const entry = { onChange, onStatus }
          set.add(entry)
          onStatus(true)
          return async () => {
            set?.delete(entry)
          }
        },
      },
    }).listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    async function requestMethod(
      method: string,
      path: string,
      token?: string,
      body?: unknown,
    ) {
      const response = await fetch(base + path, {
        method,
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
    async function request(path: string, token?: string, body?: unknown) {
      return requestMethod(
        body === undefined ? "GET" : "POST",
        path,
        token,
        body,
      )
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
      "query shapes are validated at the HTTP boundary",
      async () => {
        for (const query of [
          "page=1&page=2",
          "search=a&search=b",
          "status=SUBMITTED&status=CLOSED",
          "sortOrder=asc&sortOrder=desc",
          "page[foo]=1",
          "search[foo]=x",
          "status[]=SUBMITTED",
          "sortOrder[foo]=asc",
          "page=",
          "page=0",
          "page=-1",
          "page=1.5",
          "page=1e2",
          "page=1000001",
          "page=9007199254740992",
          "status=UNKNOWN",
          "sortOrder=sideways",
          `search=${"x".repeat(101)}`,
        ]) {
          assert.equal(
            (await request(`/client/service-requests?${query}`, client.token))
              .status,
            400,
            query,
          )
        }
        for (const query of [
          "page[x]=1",
          "search[]=x",
          "status[x]=SUBMITTED",
          "page=1&page=2",
          "page=100001",
        ]) {
          assert.equal(
            (await request(`/service-requests?${query}`, client.token)).status,
            400,
            query,
          )
        }
        for (const query of ["search=&status=&sortOrder=", "page=1000000"]) {
          const response = await request(
            `/client/service-requests?${query}`,
            client.token,
          )
          assert.equal(response.status, 200, query)
        }
      },
    )

    await t.test(
      "concurrent booking retries and client keys are isolated",
      async () => {
        const payload = { ...draft, submissionKey: randomUUID() }
        const responses = await Promise.all([
          request("/client/service-requests", client.token, payload),
          request("/client/service-requests", client.token, payload),
        ])
        assert.deepEqual(
          responses.map((r) => r.status),
          [201, 201],
        )
        assert.deepEqual(await responses[0].json(), await responses[1].json())
        assert.equal(
          await prisma.serviceRequest.count({
            where: {
              clientId: client.user.id,
              submissionKey: payload.submissionKey,
            },
          }),
          1,
        )
        assert.equal(
          (await request("/client/service-requests", other.token, payload))
            .status,
          201,
        )
        assert.equal(
          (
            await request("/client/service-requests", client.token, {
              ...payload,
              goals: "Changed goals",
            })
          ).status,
          409,
        )
        const competing = { ...draft, submissionKey: randomUUID() }
        const conflicts = await Promise.all([
          request("/client/service-requests", client.token, competing),
          request("/client/service-requests", client.token, {
            ...competing,
            goals: "Different concurrent goals",
          }),
        ])
        assert.deepEqual(conflicts.map((r) => r.status).sort(), [201, 409])
        await prisma.service.update({
          where: { id: service.id },
          data: { isActive: false },
        })
        assert.equal(
          (await request("/client/service-requests", client.token, payload))
            .status,
          201,
        )
        await prisma.service.update({
          where: { id: service.id },
          data: { isActive: true },
        })
      },
    )

    await t.test(
      "safe projections exclude credentials, storage paths and booking secrets",
      async () => {
        const forbidden = new Set([
          "passwordHash",
          "tokenHash",
          "refreshTokens",
          "sessions",
          "submissionKey",
          "agreedPrice",
          "profileImagePath",
          "profileBannerPath",
          "clientId",
        ])
        function inspect(value: unknown): void {
          if (!value || typeof value !== "object") return
          for (const [key, child] of Object.entries(value)) {
            assert.equal(forbidden.has(key), false, key)
            inspect(child)
          }
        }
        for (const path of [
          "/auth/me",
          "/auth/profile",
          "/client/service-requests",
          `/service-requests/${requestId}`,
        ]) {
          const response = await request(path, client.token)
          assert.equal(response.status, 200)
          inspect(await response.json())
        }
      },
    )

    await t.test(
      "current role and account status override existing bearer credentials",
      async () => {
        for (const data of [
          { role: "STAFF" as const },
          { isActive: false },
          { accountDeletedAt: new Date() },
        ]) {
          await prisma.user.update({ where: { id: other.user.id }, data })
          assert.equal(
            (await request("/client/services", other.token)).status,
            "role" in data ? 403 : 401,
          )
          await prisma.user.update({
            where: { id: other.user.id },
            data: { role: "USER", isActive: true, accountDeletedAt: null },
          })
        }
      },
    )

    await t.test(
      "duplicate direct cancellation cannot repeat a transition",
      async () => {
        assert.equal(
          (
            await request(
              `/client/service-requests/${requestId}/cancel`,
              client.token,
              {},
            )
          ).status,
          409,
        )
      },
    )

    async function createInternalActor(name: string, role: Role) {
      const record = await prisma.user.create({
        data: {
          email: `${name.toLowerCase()}@example.com`,
          fullName: name,
          passwordHash: "private",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        user: record,
        token: session.token,
      }
    }

    const head = await createInternalActor("MobileHead", "STAFF")
    const otherHead = await createInternalActor("OtherMobileHead", "STAFF")
    const staffMember = await createInternalActor("MobileStaff", "STAFF")
    const adminApprover = await createInternalActor("MobileApprover", "ADMIN")
    const department = await prisma.department.create({
      data: { name: "Mobile Engineering", headId: head.user.id },
    })
    const otherDepartment = await prisma.department.create({
      data: { name: "Mobile Operations", headId: null },
    })
    const staffEmployee = await prisma.employee.create({
      data: {
        employeeId: "EMP-MOB-1",
        userId: staffMember.user.id,
        fullName: "Mobile Staff Specialist",
        email: staffMember.user.email,
        position: "Mobile Developer",
        status: "ACTIVE",
        departmentId: department.id,
      },
    })
    const customService = await prisma.service.create({
      data: {
        name: "Custom Mobile Platform",
        description: "End-to-end mobile workflow service",
        clientRequirements: ["Brand kit"],
        requiresConsultation: false,
        requiresQuotationApproval: true,
        requiresAgreement: true,
        requiresPayment: true,
        departments: {
          connect: [{ id: department.id }, { id: otherDepartment.id }],
        },
      },
    })
    await prisma.service.update({
      where: { id: service.id },
      data: { departments: { connect: [{ id: department.id }] } },
    })

    let activeBookingId = ""
    let conversationId = ""

    await t.test(
      "conversations: active/archived listing, cursor pagination, unread totals, read updates, and deleted archive behavior",
      async () => {
        const created = await request(
          "/client/service-requests",
          client.token,
          {
            ...draft,
            serviceId: customService.id,
            packageId: null,
            submissionKey: randomUUID(),
          },
        )
        assert.equal(created.status, 201)
        activeBookingId = (
          (await created.json()) as { serviceRequest: { id: string } }
        ).serviceRequest.id

        const accepted = await request(
          `/request-inbox/${activeBookingId}/accept`,
          head.token,
          {},
        )
        assert.equal(accepted.status, 200)

        const listRes = await request("/request-conversations", client.token)
        assert.equal(listRes.status, 200)
        const listData = (await listRes.json()) as {
          conversations: { id: string; status: string; unreadCount: number }[]
          nextCursor: string | null
          unreadCount: number
        }
        assert.equal(listData.conversations.length, 1)
        conversationId = listData.conversations[0]!.id
        assert.equal(listData.conversations[0]!.status, "ACTIVE")
        assert.equal(listData.unreadCount, 0)

        for (const badQuery of [
          "view=invalid",
          "view=active&view=archived",
          "before=invalid/cursor!",
          "before=a&before=b",
        ]) {
          assert.equal(
            (await request(`/request-conversations?${badQuery}`, client.token))
              .status,
            400,
            badQuery,
          )
        }

        const msgRes = await request(
          `/request-conversations/${conversationId}/messages`,
          head.token,
          {
            body: "Welcome to your mobile project thread",
            clientMessageId: randomUUID(),
            bookingId: activeBookingId,
          },
        )
        assert.equal(msgRes.status, 201)

        const unreadList = (await (
          await request("/request-conversations", client.token)
        ).json()) as {
          conversations: { id: string; unreadCount: number }[]
          unreadCount: number
        }
        assert.equal(unreadList.unreadCount, 1)
        assert.equal(unreadList.conversations[0]!.unreadCount, 1)

        const markRead = await requestMethod(
          "PATCH",
          `/request-conversations/${conversationId}/read`,
          client.token,
        )
        assert.equal(markRead.status, 200)
        assert.deepEqual(await markRead.json(), {
          ok: true,
          unreadCount: 0,
          conversationUnreadCount: 0,
          conversationId,
        })

        // Seed 31 archived conversations across extra departments to verify cursor pagination & archive behavior
        const extraConvIds: string[] = []
        for (let i = 0; i < 31; i++) {
          const dep = await prisma.department.create({
            data: {
              name: `Archive Dept ${i}`,
              headId: i === 0 ? otherHead.user.id : null,
            },
          })
          const conv = await prisma.requestConversation.create({
            data: {
              clientId: client.user.id,
              departmentId: dep.id,
              updatedAt: new Date(Date.now() - (31 - i) * 1000),
            },
          })
          await prisma.serviceRequest.create({
            data: {
              clientId: client.user.id,
              serviceId: customService.id,
              title: `Archived Request ${i}`,
              status: i % 2 === 0 ? "CLOSED" : "CANCELLED",
              acceptedDepartmentId: dep.id,
              acceptedById: head.user.id,
              acceptedAt: new Date(),
              conversationId: conv.id,
            },
          })
          await prisma.serviceRequestMessage.create({
            data: {
              conversationId: conv.id,
              senderId: head.user.id,
              body: `Archived message ${i}`,
              clientMessageId: randomUUID(),
            },
          })
          extraConvIds.push(conv.id)
        }

        // Archived unread messages must not inflate active unread totals
        const activeListAfterArchiveSeed = (await (
          await request("/request-conversations?view=active", client.token)
        ).json()) as {
          conversations: { id: string }[]
          unreadCount: number
        }
        assert.equal(activeListAfterArchiveSeed.conversations.length, 1)
        assert.equal(activeListAfterArchiveSeed.unreadCount, 0)

        const page1 = (await (
          await request("/request-conversations?view=archived", client.token)
        ).json()) as {
          conversations: { id: string; status: string }[]
          nextCursor: string | null
        }
        assert.equal(page1.conversations.length, 30)
        assert.ok(page1.conversations.every((c) => c.status === "ARCHIVED"))
        assert.ok(page1.nextCursor)

        const page2 = (await (
          await request(
            `/request-conversations?view=archived&before=${page1.nextCursor}`,
            client.token,
          )
        ).json()) as {
          conversations: { id: string }[]
          nextCursor: string | null
        }
        assert.equal(page2.conversations.length, 1)
        assert.equal(page2.nextCursor, null)
        assert.equal(
          new Set([
            ...page1.conversations.map((c) => c.id),
            ...page2.conversations.map((c) => c.id),
          ]).size,
          31,
        )

        // Cannot delete active conversation
        assert.equal(
          (
            await requestMethod(
              "DELETE",
              `/request-conversations/${conversationId}`,
              client.token,
            )
          ).status,
          409,
        )

        // Deleting an archived conversation hides it only for the deleting participant and is idempotent
        const targetArchiveId = extraConvIds[0]!
        for (let attempt = 0; attempt < 2; attempt++) {
          const del = await requestMethod(
            "DELETE",
            `/request-conversations/${targetArchiveId}`,
            client.token,
          )
          assert.equal(del.status, 200)
        }
        assert.equal(
          (
            await request(
              `/request-conversations/${targetArchiveId}`,
              client.token,
            )
          ).status,
          404,
        )
        assert.equal(
          (
            await request(
              `/request-conversations/${targetArchiveId}`,
              otherHead.token,
            )
          ).status,
          200,
        )
      },
    )

    await t.test(
      "conversations: message pagination, clientMessageId idempotency, edit/delete authorization, and archived read-only enforcement",
      async () => {
        const stableId = randomUUID()
        const firstSend = await request(
          `/request-conversations/${conversationId}/messages`,
          client.token,
          {
            body: "Idempotent client reply",
            clientMessageId: stableId,
            bookingId: activeBookingId,
          },
        )
        assert.equal(firstSend.status, 201)
        const firstMsg = (
          (await firstSend.json()) as { message: { id: string; body: string } }
        ).message

        // Retry with same clientMessageId + body returns identical message without duplicating
        const retrySend = await request(
          `/request-conversations/${conversationId}/messages`,
          client.token,
          {
            body: "Idempotent client reply",
            clientMessageId: stableId,
            bookingId: activeBookingId,
          },
        )
        assert.equal(retrySend.status, 201)
        assert.equal(
          ((await retrySend.json()) as { message: { id: string } }).message.id,
          firstMsg.id,
        )

        // Reusing clientMessageId with altered text or bookingId fails with 409
        assert.equal(
          (
            await request(
              `/request-conversations/${conversationId}/messages`,
              client.token,
              {
                body: "Changed text with same ID",
                clientMessageId: stableId,
                bookingId: activeBookingId,
              },
            )
          ).status,
          409,
        )

        // Seed 52 additional messages for message cursor pagination (> 50 page size)
        for (let i = 0; i < 52; i++) {
          await prisma.serviceRequestMessage.create({
            data: {
              conversationId,
              senderId: i % 2 === 0 ? client.user.id : head.user.id,
              body: `Paginated message ${i}`,
              clientMessageId: randomUUID(),
              createdAt: new Date(Date.now() + (i + 1) * 10),
            },
          })
        }

        const historyPage1 = (await (
          await request(
            `/request-conversations/${conversationId}`,
            client.token,
          )
        ).json()) as {
          archived: boolean
          canSend: boolean
          messages: { id: string; body: string }[]
          nextCursor: string | null
        }
        assert.equal(historyPage1.archived, false)
        assert.equal(historyPage1.canSend, true)
        assert.equal(historyPage1.messages.length, 50)
        assert.ok(historyPage1.nextCursor)

        const historyPage2 = (await (
          await request(
            `/request-conversations/${conversationId}?before=${historyPage1.nextCursor}`,
            client.token,
          )
        ).json()) as {
          messages: { id: string; body: string }[]
          nextCursor: string | null
        }
        assert.equal(historyPage2.messages.length, 4)
        assert.equal(historyPage2.nextCursor, null)

        // Edit/delete authorization: clients cannot edit or delete any message (403)
        assert.equal(
          (
            await requestMethod(
              "PATCH",
              `/request-conversations/${conversationId}/messages/${firstMsg.id}`,
              client.token,
              { body: "Client edit attempt" },
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await requestMethod(
              "DELETE",
              `/request-conversations/${conversationId}/messages/${firstMsg.id}`,
              client.token,
            )
          ).status,
          403,
        )

        // Department head cannot edit/delete client's message (404), but can edit/delete own message
        assert.equal(
          (
            await requestMethod(
              "PATCH",
              `/request-conversations/${conversationId}/messages/${firstMsg.id}`,
              head.token,
              { body: "Head editing client message" },
            )
          ).status,
          404,
        )
        const headMsgRes = await request(
          `/request-conversations/${conversationId}/messages`,
          head.token,
          {
            body: "Head message before edit",
            clientMessageId: randomUUID(),
          },
        )
        const headMsg = (
          (await headMsgRes.json()) as { message: { id: string } }
        ).message
        const editedRes = await requestMethod(
          "PATCH",
          `/request-conversations/${conversationId}/messages/${headMsg.id}`,
          head.token,
          { body: "Head message after edit" },
        )
        assert.equal(editedRes.status, 200)
        const editedPayload = (await editedRes.json()) as {
          message: { body: string; editedAt: string | null }
        }
        assert.equal(editedPayload.message.body, "Head message after edit")
        assert.ok(editedPayload.message.editedAt)

        const deletedRes = await requestMethod(
          "DELETE",
          `/request-conversations/${conversationId}/messages/${headMsg.id}`,
          head.token,
        )
        assert.equal(deletedRes.status, 200)
        const deletedPayload = (await deletedRes.json()) as {
          message: {
            body: string | null
            deletedAt: string | null
            purgeAt: string | null
          }
        }
        assert.equal(deletedPayload.message.body, null)
        assert.ok(deletedPayload.message.deletedAt)
        assert.ok(deletedPayload.message.purgeAt)

        // Editing a soft-deleted message fails with 409; deleting again is idempotent 200
        assert.equal(
          (
            await requestMethod(
              "PATCH",
              `/request-conversations/${conversationId}/messages/${headMsg.id}`,
              head.token,
              { body: "Cannot edit deleted" },
            )
          ).status,
          409,
        )
        assert.equal(
          (
            await requestMethod(
              "DELETE",
              `/request-conversations/${conversationId}/messages/${headMsg.id}`,
              head.token,
            )
          ).status,
          200,
        )

        // Non-participants (other client, other head, ordinary staff, admin) are strictly isolated (404)
        for (const actorToken of [
          other.token,
          otherHead.token,
          staffMember.token,
          adminApprover.token,
        ]) {
          assert.equal(
            (
              await request(
                `/request-conversations/${conversationId}`,
                actorToken,
              )
            ).status,
            404,
          )
          assert.equal(
            (
              await request(
                `/request-conversations/${conversationId}/messages`,
                actorToken,
                { body: "Unauthorized", clientMessageId: randomUUID() },
              )
            ).status,
            404,
          )
        }

        // Archived read-only enforcement when all bookings in conversation are closed/cancelled
        await prisma.serviceRequest.update({
          where: { id: activeBookingId },
          data: { status: "CLOSED" },
        })
        try {
          const archivedDetail = (await (
            await request(
              `/request-conversations/${conversationId}`,
              client.token,
            )
          ).json()) as { archived: boolean; canSend: boolean }
          assert.equal(archivedDetail.archived, true)
          assert.equal(archivedDetail.canSend, false)
          assert.equal(
            (
              await request(
                `/request-conversations/${conversationId}/messages`,
                client.token,
                { body: "Blocked send", clientMessageId: randomUUID() },
              )
            ).status,
            409,
          )
        } finally {
          await prisma.serviceRequest.update({
            where: { id: activeBookingId },
            data: { status: "UNDER_REVIEW" },
          })
        }
      },
    )

    await t.test(
      "conversations: SSE reconnect, missed-event history recovery, session revocation, and authorization changes",
      async (subtest) => {
        // Unauthorized and non-participant SSE stream requests are rejected
        assert.equal(
          (await request(`/request-conversations/${conversationId}/events`))
            .status,
          401,
        )
        assert.equal(
          (
            await request(
              `/request-conversations/${conversationId}/events`,
              other.token,
            )
          ).status,
          404,
        )

        const controller = new AbortController()
        subtest.after(() => controller.abort())
        const streamRes = await fetch(
          `${base}/request-conversations/${conversationId}/events`,
          {
            headers: { authorization: `Bearer ${head.token}` },
            signal: controller.signal,
          },
        )
        assert.equal(streamRes.status, 200)
        const reader = streamRes.body!.getReader()
        let buffer = ""
        async function readUntil(predicate: () => boolean) {
          while (!predicate()) {
            const next = await reader.read()
            assert.equal(next.done, false)
            buffer += new TextDecoder().decode(next.value)
          }
        }
        await readUntil(
          () =>
            buffer.includes("event: connected") &&
            buffer.includes("event: messages-changed"),
        )
        buffer = ""

        // Send a message while stream is open and notify realtime bus
        const liveMsgId = randomUUID()
        assert.equal(
          (
            await request(
              `/request-conversations/${conversationId}/messages`,
              client.token,
              {
                body: "Realtime mobile message",
                clientMessageId: liveMsgId,
              },
            )
          ).status,
          201,
        )
        notifyStream(conversationId)
        await readUntil(() => buffer.includes("event: messages-changed"))
        buffer = ""

        // Reassign department head -> stream emits access-revoked and closes
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        try {
          notifyStream(conversationId)
          await readUntil(() => buffer.includes("event: access-revoked"))
          assert.equal((await reader.read()).done, true)
        } finally {
          await prisma.department.update({
            where: { id: department.id },
            data: { headId: head.user.id },
          })
          await reader.cancel()
        }

        // Session revocation on SSE stream emits access-revoked
        const tempClient = await register("mobile.sse.revoke@example.com")
        await prisma.requestConversation.update({
          where: { id: conversationId },
          data: { clientId: tempClient.user.id },
        })
        const revokeController = new AbortController()
        subtest.after(() => revokeController.abort())
        try {
          const clientStream = await fetch(
            `${base}/request-conversations/${conversationId}/events`,
            {
              headers: { authorization: `Bearer ${tempClient.token}` },
              signal: revokeController.signal,
            },
          )
          assert.equal(clientStream.status, 200)
          const clientReader = clientStream.body!.getReader()
          let clientBuffer = ""
          while (!clientBuffer.includes("event: messages-changed")) {
            const chunk = await clientReader.read()
            assert.equal(chunk.done, false)
            clientBuffer += new TextDecoder().decode(chunk.value)
          }
          await request("/auth/logout", tempClient.token, {})
          notifyStream(conversationId)
          while (!clientBuffer.includes("event: access-revoked")) {
            const chunk = await clientReader.read()
            if (chunk.done) break
            clientBuffer += new TextDecoder().decode(chunk.value)
          }
          assert.match(clientBuffer, /event: access-revoked/)
          await clientReader.cancel()
        } finally {
          await prisma.requestConversation.update({
            where: { id: conversationId },
            data: { clientId: client.user.id },
          })
        }
      },
    )

    let activatedProjectId = ""
    let milestoneId = ""

    await t.test(
      "workflow & files: client snapshot sanitization, versioned idempotent actions, and file validation/headers/scoping",
      async () => {
        // Upload validation: empty, oversized, mismatched extension/magic bytes rejected with 400
        for (const invalidFile of [
          {
            uploadId: randomUUID(),
            name: "empty.pdf",
            mimeType: "application/pdf",
            content: "",
          },
          {
            uploadId: randomUUID(),
            name: "mismatch.pdf",
            mimeType: "image/png",
            content: Buffer.from("%PDF-1.7 sample").toString("base64"),
          },
          {
            uploadId: randomUUID(),
            name: "spoofed.pdf",
            mimeType: "application/pdf",
            content: Buffer.from("not-a-pdf").toString("base64"),
          },
          {
            uploadId: randomUUID(),
            name: "nullbyte.txt",
            mimeType: "text/plain",
            content: Buffer.from("hello\u0000world").toString("base64"),
          },
        ]) {
          assert.equal(
            (
              await request(
                `/request-workflows/${activeBookingId}/files`,
                client.token,
                invalidFile,
              )
            ).status,
            400,
            invalidFile.name,
          )
        }

        // Valid client PDF upload + idempotent retry + conflict on altered content
        const clientUploadId = randomUUID()
        const pdfBase64 = Buffer.from("%PDF-1.7 client brand kit").toString(
          "base64",
        )
        const upload1 = await request(
          `/request-workflows/${activeBookingId}/files`,
          client.token,
          {
            uploadId: clientUploadId,
            name: "brand-kit.pdf",
            mimeType: "application/pdf",
            content: pdfBase64,
          },
        )
        assert.equal(upload1.status, 201)
        const clientFile = ((await upload1.json()) as { file: { id: string } })
          .file

        const uploadRetry = await request(
          `/request-workflows/${activeBookingId}/files`,
          client.token,
          {
            uploadId: clientUploadId,
            name: "brand-kit.pdf",
            mimeType: "application/pdf",
            content: pdfBase64,
          },
        )
        assert.equal(uploadRetry.status, 201)
        assert.equal(
          ((await uploadRetry.json()) as { file: { id: string } }).file.id,
          clientFile.id,
        )

        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/files`,
              client.token,
              {
                uploadId: clientUploadId,
                name: "brand-kit.pdf",
                mimeType: "application/pdf",
                content: Buffer.from("%PDF-1.7 different").toString("base64"),
              },
            )
          ).status,
          409,
        )

        // Assign approvers first so adminApprover can upload an internal-only verification document
        let wf = (await (
          await request(`/request-workflows/${activeBookingId}`, client.token)
        ).json()) as {
          version: number
          state: string
          requirements: { id: string; status: string }[]
          internal?: unknown
        }
        assert.equal("internal" in wf, false)
        const assignApproversEarly = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "ASSIGN_APPROVERS",
            quotationApproverId: adminApprover.user.id,
            paymentVerifierId: adminApprover.user.id,
          },
        )
        assert.equal(assignApproversEarly.status, 200)
        wf = (await assignApproversEarly.json()) as typeof wf

        // Internal-only file uploaded by payment verifier is hidden from client snapshot and download
        const internalUploadRes = await request(
          `/request-workflows/${activeBookingId}/files`,
          adminApprover.token,
          {
            uploadId: randomUUID(),
            name: "internal-costing.pdf",
            mimeType: "application/pdf",
            content: Buffer.from("%PDF-1.7 internal only").toString("base64"),
          },
        )
        assert.equal(internalUploadRes.status, 201)
        const internalFileId = (
          (await internalUploadRes.json()) as { file: { id: string } }
        ).file.id

        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/files/${internalFileId}`,
              client.token,
            )
          ).status,
          404,
        )
        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/files/${clientFile.id}`,
              other.token,
            )
          ).status,
          404,
        )

        // Download headers on client-visible file
        const downloadRes = await request(
          `/request-workflows/${activeBookingId}/files/${clientFile.id}`,
          client.token,
        )
        assert.equal(downloadRes.status, 200)
        assert.equal(
          downloadRes.headers.get("x-content-type-options"),
          "nosniff",
        )
        assert.match(
          downloadRes.headers.get("content-disposition") ?? "",
          /^attachment; filename="download\.pdf"; filename\*=UTF-8''brand-kit\.pdf$/,
        )
        assert.match(
          downloadRes.headers.get("content-security-policy") ?? "",
          /sandbox; default-src 'none'/,
        )

        // Client cannot invoke staff-only workflow actions (403)
        wf = (await (
          await request(`/request-workflows/${activeBookingId}`, client.token)
        ).json()) as typeof wf
        assert.equal("internal" in wf, false)
        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/actions`,
              client.token,
              {
                actionId: randomUUID(),
                expectedVersion: wf.version,
                type: "ASSIGN_APPROVERS",
                quotationApproverId: adminApprover.user.id,
                paymentVerifierId: adminApprover.user.id,
              },
            )
          ).status,
          403,
        )

        // Request, submit & approve requirement idempotently
        const requestReqRes = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "REQUEST_REQUIREMENT",
            title: "Brand Kit Document",
            details: "Upload your brand guidelines PDF",
            mandatory: true,
          },
        )
        assert.equal(requestReqRes.status, 200)
        wf = (await requestReqRes.json()) as typeof wf
        const reqId = wf.requirements[0]!.id
        const submitReqActionId = randomUUID()
        const submitReqBody = {
          actionId: submitReqActionId,
          expectedVersion: wf.version,
          type: "SUBMIT_REQUIREMENT",
          requirementId: reqId,
          submission: "Attached brand kit PDF",
          fileIds: [clientFile.id],
        }
        const submit1 = await request(
          `/request-workflows/${activeBookingId}/actions`,
          client.token,
          submitReqBody,
        )
        assert.equal(submit1.status, 200)
        const submitReplay = await request(
          `/request-workflows/${activeBookingId}/actions`,
          client.token,
          submitReqBody,
        )
        assert.equal(submitReplay.status, 200)
        // Reusing actionId with different submission text returns 409
        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/actions`,
              client.token,
              { ...submitReqBody, submission: "Mutated submission" },
            )
          ).status,
          409,
        )
        // Stale expectedVersion with new actionId returns 409
        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/actions`,
              client.token,
              {
                ...submitReqBody,
                actionId: randomUUID(),
                expectedVersion: wf.version,
              },
            )
          ).status,
          409,
        )

        wf = (await submitReplay.json()) as typeof wf
        const reviewReq = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "REVIEW_REQUIREMENT",
            requirementId: reqId,
            approve: true,
            note: "Brand kit approved",
          },
        )
        assert.equal(reviewReq.status, 200)
        wf = (await reviewReq.json()) as typeof wf

        const prepQuote = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "PREPARE_QUOTATION",
          },
        )
        assert.equal(prepQuote.status, 200)
        wf = (await prepQuote.json()) as typeof wf

        const createQuote = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "CREATE_QUOTATION",
            scope: "Native iOS and Android apps",
            deliverables: ["Architecture & UI", "Release build"],
            lineItems: [
              {
                description: "Mobile development",
                quantity: 1,
                unitPrice: "5000.00",
              },
            ],
            currency: "PHP",
            timeline: "6 weeks",
            paymentTerms: "Full payment before kickoff",
            paymentDue: "5000.00",
            validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          },
        )
        assert.equal(createQuote.status, 200)
        const headSnapshot = (await createQuote.json()) as {
          version: number
          quotations: { id: string }[]
          internal?: unknown
        }
        assert.ok(headSnapshot.internal)
        const quoteId = headSnapshot.quotations[0]!.id

        // Unpublished quotation & internal staffing/approvers must NOT be visible to client
        const clientBeforePublish = (await (
          await request(`/request-workflows/${activeBookingId}`, client.token)
        ).json()) as {
          quotations: unknown[]
          files: { id: string }[]
          project: unknown
          internal?: unknown
        }
        assert.equal(clientBeforePublish.quotations.length, 0)
        assert.deepEqual(
          clientBeforePublish.files.map((f) => f.id),
          [clientFile.id],
        )
        assert.equal(clientBeforePublish.project, null)
        assert.equal("internal" in clientBeforePublish, false)

        // Internal approval publishes quotation to client
        const approveInternal = await request(
          `/request-workflows/${activeBookingId}/actions`,
          adminApprover.token,
          {
            actionId: randomUUID(),
            expectedVersion: headSnapshot.version,
            type: "APPROVE_QUOTATION",
            quotationId: quoteId,
          },
        )
        assert.equal(approveInternal.status, 200)
        wf = (await approveInternal.json()) as typeof wf

        // Client accepts quotation idempotently (which also creates PLANNED project hidden from client until activation)
        const acceptQuoteActionId = randomUUID()
        const acceptQuoteBody = {
          actionId: acceptQuoteActionId,
          expectedVersion: wf.version,
          type: "RESPOND_QUOTATION",
          quotationId: quoteId,
          decision: "ACCEPT",
          note: "Approved from mobile",
        }
        const acceptQuote = await request(
          `/request-workflows/${activeBookingId}/actions`,
          client.token,
          acceptQuoteBody,
        )
        assert.equal(acceptQuote.status, 200)
        const acceptQuoteReplay = await request(
          `/request-workflows/${activeBookingId}/actions`,
          client.token,
          acceptQuoteBody,
        )
        assert.equal(acceptQuoteReplay.status, 200)
        const afterAcceptClient = (await acceptQuoteReplay.json()) as {
          version: number
          project: unknown
          approval: { quotationId: string } | null
        }
        assert.equal(afterAcceptClient.approval?.quotationId, quoteId)
        // Project is still PLANNED (startDate === null), so client snapshot must keep project === null
        assert.equal(afterAcceptClient.project, null)

        const plannedProject = await prisma.project.findFirstOrThrow({
          where: { requestId: activeBookingId },
          include: { milestones: true },
        })
        activatedProjectId = plannedProject.id
        milestoneId = plannedProject.milestones[0]!.id

        // Client cannot read PLANNED project directly before activation
        assert.equal(
          (await request(`/projects/${activatedProjectId}`, client.token))
            .status,
          404,
        )

        // Submit payment evidence idempotently and verify payment with internal note
        const submitPayActionId = randomUUID()
        const submitPayBody = {
          actionId: submitPayActionId,
          expectedVersion: afterAcceptClient.version,
          type: "SUBMIT_PAYMENT",
          reference: "MOB-PAY-001",
          fileId: clientFile.id,
        }
        const submitPay = await request(
          `/request-workflows/${activeBookingId}/actions`,
          client.token,
          submitPayBody,
        )
        assert.equal(submitPay.status, 200)
        assert.equal(
          (
            await request(
              `/request-workflows/${activeBookingId}/actions`,
              client.token,
              submitPayBody,
            )
          ).status,
          200,
        )
        wf = (await submitPay.json()) as typeof wf

        const verifyPay = await request(
          `/request-workflows/${activeBookingId}/actions`,
          adminApprover.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "VERIFY_PAYMENT",
            approve: true,
            note: "CONFIDENTIAL-TREASURY-AUDIT-NOTE",
          },
        )
        assert.equal(verifyPay.status, 200)
        wf = (await verifyPay.json()) as typeof wf

        // Assign staff and activate project
        const assignStaff = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "STAFF_PROJECT",
            employeeIds: [staffEmployee.id],
          },
        )
        assert.equal(assignStaff.status, 200)
        wf = (await assignStaff.json()) as typeof wf

        const activateProj = await request(
          `/request-workflows/${activeBookingId}/actions`,
          head.token,
          {
            actionId: randomUUID(),
            expectedVersion: wf.version,
            type: "ACTIVATE_PROJECT",
          },
        )
        assert.equal(activateProj.status, 200)

        const activeClientSnapshotRes = await request(
          `/request-workflows/${activeBookingId}`,
          client.token,
        )
        assert.equal(activeClientSnapshotRes.status, 200)
        const activeClientBodyText = await activeClientSnapshotRes.text()
        assert.equal(
          activeClientBodyText.includes("CONFIDENTIAL-TREASURY-AUDIT-NOTE"),
          false,
        )
        assert.equal(
          activeClientBodyText.includes("Internal margin verified"),
          false,
        )
        const activeClientSnapshot = JSON.parse(activeClientBodyText) as {
          state: string
          project: { id: string; status: string } | null
          internal?: unknown
        }
        assert.equal(activeClientSnapshot.state, "ACTIVE_PROJECT")
        assert.equal(activeClientSnapshot.project?.id, activatedProjectId)
        assert.equal(activeClientSnapshot.project?.status, "IN_PROGRESS")
        assert.equal("internal" in activeClientSnapshot, false)
      },
    )

    await t.test(
      "notifications & projects: access filtering, deep-link identifiers, activated project ownership, and milestone guards",
      async () => {
        // Activated project is now readable by owning client with canManage: false and internal milestones hidden
        const clientProjRes = await request(
          `/projects/${activatedProjectId}`,
          client.token,
        )
        assert.equal(clientProjRes.status, 200)
        const clientProj = (await clientProjRes.json()) as {
          id: string
          canManage: boolean
          milestones: { id: string; completedAt: string | null }[]
          deliverables: { id: string }[]
        }
        assert.equal(clientProj.id, activatedProjectId)
        assert.equal(clientProj.canManage, false)
        assert.deepEqual(clientProj.milestones, [])
        assert.deepEqual(clientProj.deliverables, [])

        // Assigned staff sees internal milestones and canManage: true
        const staffProj = (await (
          await request(`/projects/${activatedProjectId}`, staffMember.token)
        ).json()) as {
          canManage: boolean
          milestones: { id: string; completedAt: string | null }[]
        }
        assert.equal(staffProj.canManage, true)
        assert.equal(staffProj.milestones.length, 2)

        // Client cannot mutate milestones (404)
        assert.equal(
          (
            await requestMethod(
              "PATCH",
              `/projects/${activatedProjectId}/milestones/${milestoneId}`,
              client.token,
              { completed: true },
            )
          ).status,
          404,
        )

        // Other client cannot read the project or workflow (404)
        assert.equal(
          (await request(`/projects/${activatedProjectId}`, other.token))
            .status,
          404,
        )
        assert.equal(
          (await request(`/request-workflows/${activeBookingId}`, other.token))
            .status,
          404,
        )

        // Cancelled-before-activation standalone or workflow project is inaccessible to client (404)
        const cancelledPreActivation = await prisma.project.create({
          data: {
            name: "Cancelled Draft Project",
            clientId: client.user.id,
            status: "CANCELLED",
            startDate: null,
          },
        })
        assert.equal(
          (
            await request(
              `/projects/${cancelledPreActivation.id}`,
              client.token,
            )
          ).status,
          404,
        )

        // Assigned staff can complete milestone, which emits a client notification with requestId deep link
        const staffToggle = await requestMethod(
          "PATCH",
          `/projects/${activatedProjectId}/milestones/${milestoneId}`,
          staffMember.token,
          { completed: true },
        )
        assert.equal(staffToggle.status, 200)

        const notifRes = await request(
          "/request-workflows/notifications",
          client.token,
        )
        assert.equal(notifRes.status, 200)
        const notifData = (await notifRes.json()) as {
          notifications: {
            id: string
            requestId: string
            readAt: string | null
            summary: string
            type: string
          }[]
        }
        assert.ok(notifData.notifications.length > 0)
        assert.ok(
          notifData.notifications.every((n) => n.requestId === activeBookingId),
        )
        assert.equal(
          notifData.notifications.some((n) =>
            n.summary.includes("CONFIDENTIAL-TREASURY-AUDIT-NOTE"),
          ),
          false,
        )

        // Other client sees zero notifications for this request and cannot mark client's notification read
        const otherNotifs = (await (
          await request("/request-workflows/notifications", other.token)
        ).json()) as { notifications: unknown[] }
        assert.equal(otherNotifs.notifications.length, 0)

        const firstNotifId = notifData.notifications[0]!.id
        assert.equal(
          (
            await requestMethod(
              "PATCH",
              `/request-workflows/notifications/${firstNotifId}/read`,
              other.token,
            )
          ).status,
          404,
        )

        // Mark one notification read, then mark all notifications read
        const markOne = await requestMethod(
          "PATCH",
          `/request-workflows/notifications/${firstNotifId}/read`,
          client.token,
        )
        assert.equal(markOne.status, 200)

        const markAll = await requestMethod(
          "PATCH",
          "/request-workflows/notifications/read-all",
          client.token,
        )
        assert.equal(markAll.status, 200)

        const afterReadAll = (await (
          await request("/request-workflows/notifications", client.token)
        ).json()) as {
          notifications: { readAt: string | null }[]
        }
        assert.ok(afterReadAll.notifications.every((n) => n.readAt !== null))
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
