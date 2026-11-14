import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "Billing Logs preserves Decimal precision and ignores client ownership query overrides",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const client = await prisma.user.create({
      data: {
        email: "p19-billing-client@example.test",
        fullName: "Page 19 Billing Client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const otherClient = await prisma.user.create({
      data: {
        email: "p19-billing-other@example.test",
        fullName: "Page 19 Other Client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const service = await prisma.service.create({
      data: {
        name: "Page 19 Billing Service",
        description: "Isolated financial projection fixture.",
      },
    })

    async function booking(ownerId: string, referenceNumber: string) {
      return prisma.serviceRequest.create({
        data: {
          clientId: ownerId,
          serviceId: service.id,
          title: `Billing request ${referenceNumber}`,
          referenceNumber,
          workflow: { create: {} },
        },
      })
    }

    const ownedRequest = await booking(client.id, "P19-OWNED-001")
    const foreignRequest = await booking(otherClient.id, "P19-FOREIGN-001")
    const ownedPayment = await prisma.workflowPayment.create({
      data: {
        requestId: ownedRequest.id,
        amount: "9999999999.99",
        currency: "PHP",
        status: "PENDING",
        reference: "P19-OWNED-REFERENCE",
      },
    })
    const foreignPayment = await prisma.workflowPayment.create({
      data: {
        requestId: foreignRequest.id,
        amount: "125.40",
        currency: "PHP",
        status: "PENDING",
        reference: "P19-FOREIGN-REFERENCE",
      },
    })
    const before = await prisma.workflowPayment.findMany({
      where: { id: { in: [ownedPayment.id, foreignPayment.id] } },
      orderBy: { id: "asc" },
    })
    const session = await issueSession(client)
    const response = await fetch(
      `${origin}/api/request-workflows/billing?clientId=${encodeURIComponent(otherClient.id)}`,
      { headers: { authorization: `Bearer ${session.token}` } },
    )

    assert.equal(response.status, 200)
    const records = (await response.json()) as {
      id: string
      requestId: string
      amount: string
      currency: string
      status: string
      reference: string | null
      serviceName: string
      bookingReference: string | null
      proofFile: unknown
    }[]
    assert.deepEqual(
      records.map(({ id }) => id),
      [ownedPayment.id],
    )
    assert.deepEqual(
      {
        requestId: records[0]?.requestId,
        amount: records[0]?.amount,
        currency: records[0]?.currency,
        status: records[0]?.status,
        reference: records[0]?.reference,
        serviceName: records[0]?.serviceName,
        bookingReference: records[0]?.bookingReference,
        proofFile: records[0]?.proofFile,
      },
      {
        requestId: ownedRequest.id,
        amount: "9999999999.99",
        currency: "PHP",
        status: "PENDING",
        reference: "P19-OWNED-REFERENCE",
        serviceName: service.name,
        bookingReference: "P19-OWNED-001",
        proofFile: null,
      },
    )
    const after = await prisma.workflowPayment.findMany({
      where: { id: { in: [ownedPayment.id, foreignPayment.id] } },
      orderBy: { id: "asc" },
    })
    assert.deepEqual(
      after.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        status: payment.status,
        reference: payment.reference,
      })),
      before.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        status: payment.status,
        reference: payment.reference,
      })),
    )
  },
)
