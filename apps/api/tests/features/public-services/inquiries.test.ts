import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { startPgliteDatabase } from "../../support/pglite-app.js"
import { publicServicesService } from "../../../src/features/public-services/public-services.service.js"

test("inquiry search and pagination retain global status counts", async (t) => {
  const { prisma } = await startPgliteDatabase(t)
  await prisma.service.create({
    data: { id: "design", name: "Graphic Design", description: "Design" },
  })
  for (let index = 0; index < 12; index++) {
    await prisma.serviceInquiry.create({
      data: {
        serviceId: "design",
        fullName: `Guest ${index}`,
        email: `guest${index}@example.com`,
        contactNumber: "09123456789",
        subject: index === 0 ? "Special project" : "General inquiry",
        message: "A complete inquiry message",
        submissionKey: randomUUID(),
        fingerprint: String(index),
        status: index === 0 ? "CONTACTED" : "PENDING",
      },
    })
  }
  const all = await publicServicesService.listInquiries("1", "ALL", "")
  assert.equal(all.pageSize, 10)
  assert.equal(all.inquiries.length, 10)
  assert.deepEqual(all.counts, {
    total: 12,
    PENDING: 11,
    CONTACTED: 1,
    CLOSED: 0,
    SPAM: 0,
  })
  const found = await publicServicesService.listInquiries(
    "1",
    "CONTACTED",
    "special",
  )
  assert.equal(found.total, 1)
  assert.equal(found.inquiries[0]?.subject, "Special project")
  assert.deepEqual(found.counts, all.counts)
  assert.equal(
    (await publicServicesService.listInquiries("1", "ALL", "graphic design"))
      .total,
    12,
  )
  assert.equal(
    (
      await publicServicesService.listInquiries(
        "1",
        "ALL",
        "guest0@example.com",
      )
    ).total,
    1,
  )
})
