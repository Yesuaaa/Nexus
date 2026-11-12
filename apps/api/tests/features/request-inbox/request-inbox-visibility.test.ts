import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "shared service requests leave other linked departments' inboxes once accepted",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api`

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
