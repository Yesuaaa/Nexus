import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"
import { seedBilling } from "./support/pg016-billing-fixture.js"

test(
  "[PG-016-F001-A004-T001] billing filters status and projects client-visible financial records",
  { timeout: 120000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedBilling(prisma)
    const verifier = await f.account("verifier", "ADMIN")
    await f.payment(f.a.user.id, "zero", { amount: "0.00" })
    await f.payment(f.a.user.id, "cancel-submitted", {
      requestStatus: "CANCELLED",
    })
    const retained = await f.payment(f.a.user.id, "cancel-verified", {
      requestStatus: "CANCELLED",
      status: "VERIFIED",
      verifiedAt: new Date("2026-11-12Z"),
    })
    const sandbox = await f.payment(f.a.user.id, "sandbox", {
      status: "VERIFIED",
      reference: "XENDIT-SANDBOX-TEST",
      verifiedAt: new Date("2026-11-13Z"),
    })
    const real = await f.payment(f.a.user.id, "real", {
      status: "VERIFIED",
      reference: "XENDIT-SANDBOX-TEST",
      verifiedById: verifier.user.id,
      verifiedAt: new Date("2026-11-14Z"),
    })
    const hidden = await f.payment(f.a.user.id, "hidden", { visible: false })
    const pending = await f.payment(f.a.user.id, "pending", {
      status: "PENDING",
    })
    const items = [{ description: "Design", quantity: 1, unitPrice: "125.07" }]
    const quote = await prisma.workflowQuotation.create({
      data: {
        requestId: pending.request.id,
        version: 1,
        scope: "Synthetic quotation",
        deliverables: ["Design"],
        lineItems: items,
        total: "125.07",
        currency: "PHP",
        timeline: "One week",
        paymentTerms: "Fixture",
        paymentDue: "125.07",
        validUntil: new Date("2026-12-01Z"),
        createdById: verifier.user.id,
      },
    })
    await prisma.workflowApproval.create({
      data: {
        requestId: pending.request.id,
        quotationId: quote.id,
        amount: "125.07",
        currency: "PHP",
        approvedById: f.a.user.id,
        approvedAt: new Date("2026-11-10T08:00:00Z"),
      },
    })
    for (const [internal, createdAt] of [
      [false, "2026-11-10T09:00:00Z"],
      [false, "2026-11-11T09:00:00Z"],
      [true, "2026-11-12T09:00:00Z"],
    ] as const) {
      await prisma.workflowEvent.create({
        data: {
          requestId: pending.request.id,
          type: "PAYMENT_SUBMITTED",
          summary: "Synthetic event",
          internal,
          createdAt: new Date(createdAt),
        },
      })
    }
    const before = await prisma.workflowPayment.findMany({
      orderBy: { id: "asc" },
    })
    async function billing(token: string) {
      const response = await fetch(origin + "/api/request-workflows/billing", {
        headers: { Authorization: "Bearer " + token },
      })
      assert.equal(response.status, 200)
      return (await response.json()) as {
        id: string
        requestId: string
        amount: string
        sandbox: boolean
        proofFile: unknown
        lineItems: unknown
        submittedAt: string | null
      }[]
    }
    const result = await billing(f.a.token)
    assert.deepEqual(
      result.map(({ id }) => id),
      [
        real.payment.id,
        sandbox.payment.id,
        retained.payment.id,
        ...[f.own.payment.id, hidden.payment.id, pending.payment.id]
          .sort()
          .reverse(),
      ],
    )
    assert.equal(
      result.find(({ id }) => id === sandbox.payment.id)?.sandbox,
      true,
    )
    assert.equal(
      result.find(({ id }) => id === real.payment.id)?.sandbox,
      false,
    )
    assert.equal(
      result.find(({ id }) => id === hidden.payment.id)?.proofFile,
      null,
    )
    const projected = result.find(({ id }) => id === pending.payment.id)!
    assert.equal(projected.amount, "125.07")
    assert.deepEqual(projected.lineItems, items)
    assert.equal(projected.submittedAt, "2026-11-11T09:00:00.000Z")
    assert.deepEqual(
      Object.keys(projected).sort(),
      [
        "amount",
        "approvedAt",
        "bookingReference",
        "currency",
        "id",
        "lineItems",
        "proofFile",
        "reference",
        "requestId",
        "sandbox",
        "serviceName",
        "status",
        "submittedAt",
        "verifiedAt",
      ].sort(),
    )
    const otherClientRecords = await billing(f.b.token)
    assert.deepEqual(
      otherClientRecords.map(({ id }) => id),
      [f.foreign.payment.id],
    )
    assert.deepEqual(
      await prisma.workflowPayment.findMany({ orderBy: { id: "asc" } }),
      before,
    )
    await prisma.workflowQuotation.update({
      where: { id: quote.id },
      data: { total: "125.08" },
    })
    assert.equal(
      (await billing(f.a.token)).find(({ id }) => id === pending.payment.id)
        ?.lineItems,
      null,
    )
  },
)

test(
  "[PG-016-F001-A010-T002] billing and proof enforce bearer activity independently of role",
  { timeout: 120000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedBilling(prisma)
    const expired = await f.account("expired")
    const revoked = await f.account("revoked")
    const inactive = await f.account("inactive")
    await prisma.session.updateMany({
      where: { userId: expired.user.id },
      data: { expiresAt: new Date(0) },
    })
    await prisma.session.deleteMany({ where: { userId: revoked.user.id } })
    await prisma.user.update({
      where: { id: inactive.user.id },
      data: { isActive: false },
    })
    const paths = [
      "/billing",
      "/" + f.own.request.id + "/files/" + f.own.file.id,
    ]
    for (const path of paths)
      for (const token of [
        undefined,
        "invalid",
        expired.token,
        revoked.token,
        inactive.token,
      ]) {
        const response = await fetch(origin + "/api/request-workflows" + path, {
          headers: token ? { Authorization: "Bearer " + token } : {},
        })
        assert.equal(response.status, 401)
        assert.deepEqual(Object.keys((await response.json()) as object), [
          "error",
        ])
      }
    for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
      const actor = await f.account(role.toLowerCase(), role)
      const response = await fetch(origin + "/api/request-workflows/billing", {
        headers: { Authorization: "Bearer " + actor.token },
      })
      assert.equal(response.status, 403)
      assert.deepEqual(await response.json(), {
        error: "Billing Logs are available to clients",
      })
    }
    assert.equal(
      (
        await fetch(origin + "/api/request-workflows/billing", {
          headers: { Authorization: "Bearer " + f.a.token },
        })
      ).status,
      200,
    )
    const foreign = await fetch(
      origin +
        "/api/request-workflows/" +
        f.foreign.request.id +
        "/files/" +
        f.foreign.file.id,
      { headers: { Authorization: "Bearer " + f.a.token } },
    )
    assert.equal(foreign.status, 404)
    assert.deepEqual(await foreign.json(), { error: "Workflow not found" })
  },
)
