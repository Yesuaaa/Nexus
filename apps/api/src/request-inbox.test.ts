import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"
import type { Role } from "./generated/prisma/client.js"

test(
  "department request inbox enforces current head routing and accepts bookings atomically",
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
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    // This migration is deliberately safe on normalized and previously deployed databases.
    const inboxMigration = await readFile(
      new URL(
        "20261030153000_department_request_inbox/migration.sql",
        migrations,
      ),
      "utf8",
    )
    await database.exec(inboxMigration)
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
    const client = await user("Client", "USER")
    const head = await user("Head", "STAFF")
    const otherHead = await user("OtherHead", "STAFF")
    const staff = await user("Staff", "STAFF")
    const admin = await user("Admin", "ADMIN")
    const superadmin = await user("Superadmin", "SUPERADMIN")
    const design = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const marketing = await prisma.department.create({
      data: { name: "Marketing", headId: otherHead.id },
    })
    await prisma.user.update({
      where: { id: head.id },
      data: { departmentId: design.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Website",
        description: "Website design",
        departments: { connect: { id: design.id } },
      },
    })
    const foreign = await prisma.service.create({
      data: {
        name: "Campaign",
        description: "Campaign",
        departments: { connect: { id: marketing.id } },
      },
    })
    const unassigned = await prisma.service.create({
      data: { name: "Unassigned", description: "Unassigned" },
    })
    const shared = await prisma.service.create({
      data: {
        name: "Shared",
        description: "Shared",
        departments: { connect: [{ id: design.id }, { id: marketing.id }] },
      },
    })
    const booking = await prisma.serviceRequest.create({
      data: {
        referenceNumber: "SR-INBOX-REFERENCE",
        clientId: client.id,
        serviceId: service.id,
        title: "Website request",
        projectGoals: "Reach new customers",
        projectRequirements: "Five pages",
        expectedTimeline: "Six weeks",
        additionalDetails: "Brand guidelines",
        packageName: "Business",
      },
    })
    const foreignBooking = await prisma.serviceRequest.create({
      data: {
        referenceNumber: "SR-FOREIGN-REFERENCE",
        clientId: client.id,
        serviceId: foreign.id,
        title: "Private campaign",
      },
    })
    await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: unassigned.id,
        title: "No route",
      },
    })
    const contested = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: shared.id,
        title: "Shared booking",
      },
    })
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const get = (path: string, actor = head) =>
      fetch(`${base}${path}`, { headers: actor.headers })
    const accept = (id: string, actor = head) =>
      fetch(`${base}/request-inbox/${id}/accept`, {
        method: "POST",
        headers: { ...actor.headers, "content-type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          clientId: "forged",
          departmentId: marketing.id,
        }),
      })

    await t.test(
      "only assigned staff heads have access, with no administrator override",
      async () => {
        assert.equal((await fetch(`${base}/request-inbox`)).status, 401)
        for (const actor of [client, staff, admin, superadmin]) {
          assert.equal((await get("/request-inbox", actor)).status, 403)
          assert.equal(
            (await get(`/request-inbox/${booking.id}`, actor)).status,
            403,
          )
          assert.equal((await accept(booking.id, actor)).status, 403)
        }
        const me = (await (await get("/auth/me")).json()) as {
          user: { headOf: { id: string; name: string } }
        }
        assert.deepEqual(me.user.headOf, { id: design.id, name: "Design" })
      },
    )
    await t.test(
      "list and details are department scoped and use explicit safe fields",
      async () => {
        const response = await get("/request-inbox")
        assert.equal(response.status, 200)
        const list = (await response.json()) as {
          serviceRequests: {
            id: string
            referenceNumber: string | null
            client: object
          }[]
          total: number
          department: object
        }
        assert.equal(list.total, 2)
        assert.deepEqual(
          new Set(list.serviceRequests.map((item) => item.id)),
          new Set([booking.id, contested.id]),
        )
        assert.deepEqual(list.department, { id: design.id, name: "Design" })
        assert.equal(
          list.serviceRequests.find((item) => item.id === booking.id)
            ?.referenceNumber,
          booking.referenceNumber,
        )
        assert.equal(
          list.serviceRequests.find((item) => item.id === contested.id)
            ?.referenceNumber,
          null,
        )
        assert.deepEqual(Object.keys(list.serviceRequests[0]!.client).sort(), [
          "contactNumber",
          "email",
          "fullName",
        ])
        const detailsResponse = await get(`/request-inbox/${booking.id}`)
        assert.equal(detailsResponse.status, 200)
        const { serviceRequest: details } = (await detailsResponse.json()) as {
          serviceRequest: Record<string, unknown>
        }
        assert.equal(details.projectGoals, "Reach new customers")
        assert.equal(details.projectRequirements, "Five pages")
        assert.equal(details.additionalDetails, "Brand guidelines")
        assert.equal(details.referenceNumber, booking.referenceNumber)
        assert.equal("submissionKey" in details, false)
        assert.equal("quotedPrice" in details, false)
        for (const id of [foreignBooking.id, "missing"]) {
          assert.equal((await get(`/request-inbox/${id}`)).status, 404)
          assert.equal((await accept(id)).status, 404)
        }
        for (const query of [
          "page=0",
          "page=100001",
          "page=1.2",
          "search=" + "x".repeat(101),
          "view=COMPLETED",
          "view=pending&view=under-review",
          "search=a&search=b",
        ])
          assert.equal((await get(`/request-inbox?${query}`)).status, 400)
        assert.equal((await get("/request-inbox/bad.id")).status, 400)
        const search = (await (
          await get("/request-inbox?search=business")
        ).json()) as { total: number }
        assert.equal(search.total, 1)
        const referenceSearch = (await (
          await get("/request-inbox?search=sr-inbox-ref")
        ).json()) as { total: number; serviceRequests: { id: string }[] }
        assert.equal(referenceSearch.total, 1)
        assert.equal(referenceSearch.serviceRequests[0]?.id, booking.id)
        const foreignReferenceSearch = (await (
          await get("/request-inbox?search=SR-FOREIGN-REFERENCE")
        ).json()) as { total: number }
        assert.equal(foreignReferenceSearch.total, 0)
        const scoped = (await (
          await get(
            "/request-inbox?search=campaign&departmentId=" + marketing.id,
          )
        ).json()) as { total: number }
        assert.equal(scoped.total, 0)
      },
    )
    await t.test(
      "acceptance changes only the initial status and is visible to the booking client",
      async () => {
        const acceptedResponse = await accept(booking.id)
        assert.equal(acceptedResponse.status, 200)
        const accepted = (await acceptedResponse.json()) as {
          serviceRequest: { referenceNumber: string | null }
        }
        assert.equal(
          accepted.serviceRequest.referenceNumber,
          booking.referenceNumber,
        )
        const stored = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: booking.id },
        })
        assert.equal(stored.status, "UNDER_REVIEW")
        assert.equal(stored.clientId, client.id)
        assert.equal(stored.agreedPrice, null)
        assert.equal((await accept(booking.id)).status, 409)
        const clientBooking = (await (
          await get(`/service-requests/${booking.id}`, client)
        ).json()) as { serviceRequest: { status: string } }
        assert.equal(clientBooking.serviceRequest.status, "UNDER_REVIEW")
        const reviewed = (await (
          await get("/request-inbox?view=under-review")
        ).json()) as { total: number }
        assert.equal(reviewed.total, 1)
        for (const status of [
          "CLOSED",
          "CANCELLED",
          "READY_FOR_QUOTATION",
        ] as const) {
          await prisma.serviceRequest.update({
            where: { id: booking.id },
            data: { status },
          })
          assert.equal((await accept(booking.id)).status, 409)
        }
      },
    )
    await t.test(
      "two department heads cannot both accept a shared request",
      async () => {
        const responses = await Promise.all([
          accept(contested.id),
          accept(contested.id, otherHead),
        ])
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        )
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: contested.id },
            })
          ).status,
          "UNDER_REVIEW",
        )
      },
    )
    await t.test(
      "head handoffs and role/account changes revoke access on the next request",
      async () => {
        await prisma.department.update({
          where: { id: design.id },
          data: { headId: staff.id },
        })
        assert.equal((await get("/request-inbox")).status, 403)
        assert.equal((await accept(booking.id)).status, 403)
        assert.equal((await get("/request-inbox", staff)).status, 200)
        await prisma.user.update({
          where: { id: staff.id },
          data: { role: "ADMIN" },
        })
        assert.equal((await get("/request-inbox", staff)).status, 403)
        await prisma.user.update({
          where: { id: staff.id },
          data: { role: "STAFF", isActive: false },
        })
        assert.equal((await get("/request-inbox", staff)).status, 401)
        await prisma.user.update({
          where: { id: staff.id },
          data: { isActive: true, accountDeletedAt: new Date() },
        })
        assert.equal((await get("/request-inbox", staff)).status, 401)
        await prisma.user.update({
          where: { id: staff.id },
          data: { accountDeletedAt: null },
        })
        await prisma.department.update({
          where: { id: design.id },
          data: { headId: head.id },
        })
      },
    )
    await t.test(
      "pagination is stable and scoped, including empty result pages",
      async () => {
        const createdAt = new Date("2026-10-01T00:00:00Z")
        for (let index = 0; index < 11; index++)
          await prisma.serviceRequest.create({
            data: {
              id: `page-${String(index).padStart(2, "0")}`,
              clientId: client.id,
              serviceId: service.id,
              title: "Page request",
              createdAt,
            },
          })
        const first = (await (
          await get("/request-inbox?search=page-&page=1")
        ).json()) as { total: number; serviceRequests: { id: string }[] }
        const second = (await (
          await get("/request-inbox?search=page-&page=2")
        ).json()) as { total: number; serviceRequests: { id: string }[] }
        assert.equal(first.total, 11)
        assert.deepEqual(
          first.serviceRequests.map((item) => item.id),
          Array.from(
            { length: 10 },
            (_, index) => `page-${String(index).padStart(2, "0")}`,
          ),
        )
        assert.deepEqual(
          second.serviceRequests.map((item) => item.id),
          ["page-10"],
        )
        const empty = (await (
          await get("/request-inbox?search=page-&page=3")
        ).json()) as { total: number; serviceRequests: unknown[] }
        assert.equal(empty.total, 11)
        assert.deepEqual(empty.serviceRequests, [])
      },
    )
    await t.test(
      "normalized SUBMITTED-only initial status works without a PENDING enum label",
      async () => {
        await database.exec(`
      ALTER TABLE "ServiceRequest" ALTER COLUMN "status" DROP DEFAULT;
      ALTER TYPE "ServiceRequestStatus" RENAME TO "LegacyInboxStatus";
      CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED', 'AWAITING_CLIENT_INFO', 'READY_FOR_QUOTATION');
      ALTER TABLE "ServiceRequest" ALTER COLUMN "status" TYPE "ServiceRequestStatus" USING (CASE "status"::text WHEN 'PENDING' THEN 'SUBMITTED' WHEN 'IN_PROGRESS' THEN 'UNDER_REVIEW' WHEN 'COMPLETED' THEN 'CLOSED' ELSE "status"::text END)::"ServiceRequestStatus";
      ALTER TABLE "ServiceRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
      DROP TYPE "LegacyInboxStatus";
    `)
        await database.exec(inboxMigration)
        assert.equal((await get("/request-inbox")).status, 200)
        assert.equal((await accept("page-00")).status, 200)
        assert.equal(
          (
            await prisma.serviceRequest.findUniqueOrThrow({
              where: { id: "page-00" },
            })
          ).status,
          "UNDER_REVIEW",
        )
      },
    )
  },
)
