import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { Role, ServiceRequest } from "../src/generated/prisma/client.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "Booked Services API enforces client scope and its read contracts",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function user(name: string, role: Role) {
      const record = await prisma.user.create({
        data: {
          email: `${name.toLowerCase()}@example.com`,
          fullName: name,
          contactNumber: "09123456789",
          passwordHash: "private-hash",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        record,
        headers: { authorization: `Bearer ${session.token}` },
      }
    }
    const client = await user("BookedClient", "USER")
    const otherClient = await user("OtherClient", "USER")
    const staff = await user("BookedStaff", "STAFF")
    const admin = await user("BookedAdmin", "ADMIN")
    const superadmin = await user("BookedSuperadmin", "SUPERADMIN")
    const service = await prisma.service.create({
      data: { name: "Website design", description: "Web design service" },
    })

    async function booking(
      ownerId: string,
      index: number,
      status: "SUBMITTED" | "UNDER_REVIEW" = "SUBMITTED",
    ) {
      return prisma.serviceRequest.create({
        data: {
          clientId: ownerId,
          serviceId: service.id,
          referenceNumber: `SR-BOOKED-${String(index).padStart(3, "0")}`,
          title: `Website request ${index}`,
          projectGoals: "Reach more customers",
          projectRequirements: "A responsive website",
          expectedTimeline: "Four weeks",
          status,
          createdAt: new Date(Date.UTC(2026, 0, index)),
        },
      })
    }

    const ownBookings: ServiceRequest[] = []
    for (let index = 1; index <= 11; index += 1)
      ownBookings.push(
        await booking(
          client.record.id,
          index,
          index % 2 === 0 ? "UNDER_REVIEW" : "SUBMITTED",
        ),
      )
    const foreignBooking = await booking(otherClient.record.id, 99)

    const get = (path: string, actor?: Awaited<ReturnType<typeof user>>) =>
      fetch(`${base}${path}`, actor ? { headers: actor.headers } : {})

    await t.test(
      "list uses the authenticated owner, server filters, and stable pagination",
      async () => {
        const first = await get("/service-requests?page=1", client)
        assert.equal(first.status, 200)
        const firstBody = (await first.json()) as {
          serviceRequests: { id: string; title: string }[]
          total: number
          page: number
          pageSize: number
        }
        assert.equal(firstBody.total, 11)
        assert.equal(firstBody.page, 1)
        assert.equal(firstBody.pageSize, 10)
        assert.equal(firstBody.serviceRequests.length, 10)
        assert.equal(firstBody.serviceRequests[0]?.id, ownBookings[10]?.id)
        assert.equal(
          firstBody.serviceRequests.some(
            (item) => item.id === foreignBooking.id,
          ),
          false,
        )

        const second = await get("/service-requests?page=2", client)
        assert.equal(second.status, 200)
        const secondBody = (await second.json()) as {
          serviceRequests: { id: string; title: string }[]
          total: number
          page: number
          pageSize: number
        }
        assert.equal(secondBody.total, 11)
        assert.equal(secondBody.serviceRequests.length, 1)
        assert.equal(secondBody.serviceRequests[0]?.id, ownBookings[0]?.id)

        const combined = await get(
          "/service-requests?search=SR-BOOKED-010&status=UNDER_REVIEW",
          client,
        )
        assert.equal(combined.status, 200)
        const combinedBody = (await combined.json()) as {
          serviceRequests: { id: string }[]
          total: number
        }
        assert.equal(combinedBody.total, 1)
        assert.equal(combinedBody.serviceRequests[0]?.id, ownBookings[9]?.id)

        const otherList = await get("/service-requests", otherClient)
        assert.equal(otherList.status, 200)
        const otherBody = (await otherList.json()) as {
          serviceRequests: { id: string }[]
          total: number
        }
        assert.equal(otherBody.total, 1)
        assert.deepEqual(
          otherBody.serviceRequests.map((item) => item.id),
          [foreignBooking.id],
        )
      },
    )

    await t.test(
      "direct reads are authenticated and restricted to USER accounts",
      async () => {
        for (const path of [
          "/service-requests",
          `/service-requests/${ownBookings[0]!.id}`,
        ]) {
          assert.equal((await get(path)).status, 401)
          for (const actor of [staff, admin, superadmin])
            assert.equal((await get(path, actor)).status, 403)
        }
      },
    )

    await t.test(
      "details are owner-scoped and return only the booked-service projection",
      async () => {
        const own = await get(`/service-requests/${ownBookings[0]!.id}`, client)
        assert.equal(own.status, 200)
        const body = (await own.json()) as {
          serviceRequest: Record<string, unknown>
        }
        assert.equal(body.serviceRequest.id, ownBookings[0]!.id)
        assert.equal(body.serviceRequest.projectGoals, "Reach more customers")
        assert.equal("clientId" in body.serviceRequest, false)
        assert.equal("submissionKey" in body.serviceRequest, false)
        assert.equal(
          (await get(`/service-requests/${foreignBooking.id}`, client)).status,
          404,
        )
        assert.equal(
          (await get(`/service-requests/${ownBookings[0]!.id}`, otherClient))
            .status,
          404,
        )
        assert.equal(
          (await get("/service-requests/missing", client)).status,
          404,
        )
      },
    )

    await t.test("invalid filters and malformed IDs return 400", async () => {
      for (const query of [
        "page=0",
        "page=100001",
        "status=INVALID",
        `search=${"x".repeat(101)}`,
        "search=a&search=b",
      ])
        assert.equal(
          (await get(`/service-requests?${query}`, client)).status,
          400,
          query,
        )
      assert.equal((await get("/service-requests/bad.id", client)).status, 400)
    })

    await t.test(
      "list projection includes the generated client-facing reference number",
      async () => {
        const response = await get(
          "/service-requests?search=SR-BOOKED-001",
          client,
        )
        assert.equal(response.status, 200)
        const body = (await response.json()) as {
          serviceRequests: { referenceNumber?: string | null }[]
        }
        assert.equal(body.serviceRequests[0]?.referenceNumber, "SR-BOOKED-001")
      },
    )

    await t.test(
      "detail projection includes the generated client-facing reference number",
      async () => {
        const response = await get(
          `/service-requests/${ownBookings[0]!.id}`,
          client,
        )
        assert.equal(response.status, 200)
        const body = (await response.json()) as {
          serviceRequest: { referenceNumber?: string | null }
        }
        assert.equal(body.serviceRequest.referenceNumber, "SR-BOOKED-001")
      },
    )

    await t.test(
      "a client can open the documented waiting state before request acceptance",
      async () => {
        const response = await get(
          `/request-conversations/${ownBookings[0]!.id}`,
          client,
        )
        assert.equal(response.status, 200)
        const body = (await response.json()) as {
          conversation: null
          canSend: boolean
          messages: unknown[]
        }
        assert.equal(body.conversation, null)
        assert.equal(body.canSend, false)
        assert.deepEqual(body.messages, [])
      },
    )
  },
)
