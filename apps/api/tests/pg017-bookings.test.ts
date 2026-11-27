import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"
import { seedPg017 } from "./support/pg017-booking-fixture.js"

test(
  "[PG-017-F001-A002-T002] booked search treats wildcard characters literally",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const fixture = await seedPg017(prisma)
    for (const [index, [needle, decoy]] of [
      ["%", "percent"],
      ["_", "underscore"],
      ["\\", "slash"],
    ].entries()) {
      const row = await prisma.serviceRequest.create({
        data: {
          clientId: fixture.a.user.id,
          serviceId: fixture.service.id,
          title: `Literal ${needle} title ${index}`,
        },
      })
      await prisma.serviceRequest.create({
        data: {
          clientId: fixture.a.user.id,
          serviceId: fixture.service.id,
          title: `Literal ${decoy} title ${index}`,
        },
      })
      const response = await fetch(
        `${base}/service-requests?search=${encodeURIComponent(needle!)}`,
        { headers: { authorization: `Bearer ${fixture.a.token}` } },
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        total: number
        serviceRequests: { id: string }[]
      }
      assert.equal(body.total, 1)
      assert.deepEqual(
        body.serviceRequests.map(({ id }) => id),
        [row.id],
      )
    }
  },
)

test(
  "[PG-017-F001-A014-T002] inactive client sessions cannot read booking lists or details",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const fixture = await seedPg017(prisma)
    await prisma.user.update({
      where: { id: fixture.a.user.id },
      data: { isActive: false },
    })
    for (const path of [
      "/service-requests",
      `/service-requests/${fixture.own.id}`,
    ]) {
      const response = await fetch(base + path, {
        headers: { authorization: `Bearer ${fixture.a.token}` },
      })
      assert.equal(response.status, 401)
    }
    assert.equal(
      (
        await fetch(base + "/service-requests", {
          headers: { authorization: `Bearer ${fixture.b.token}` },
        })
      ).status,
      200,
    )
  },
)
