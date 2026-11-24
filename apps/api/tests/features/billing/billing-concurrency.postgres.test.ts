import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test } from "node:test"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { disconnectPrisma, getPrisma } from "../../../src/lib/db.js"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  closeServer,
  listen,
  migrationNames,
  readMigration,
} from "../../support/pglite-app.js"

const target = process.env.BILLING_TEST_DATABASE_URL

test(
  "PostgreSQL serializes billing financial races",
  { timeout: 120_000, skip: !target },
  async (t) => {
    const parsed = new URL(target!)
    assert.equal(parsed.hostname, "127.0.0.1")
    assert.match(parsed.pathname, /^\/billing_test(?:_[a-z0-9]+)?$/)
    assert.equal(parsed.username, "postgres")
    const bootstrap = new pg.Client({ connectionString: target })
    await bootstrap.connect()
    try {
      for (const name of await migrationNames())
        await bootstrap.query(await readMigration(name))
    } finally {
      await bootstrap.end()
    }
    process.env.DATABASE_URL = target
    process.env.DATABASE_POOL_MAX = "10"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const { server, origin } = await listen(createApp())
    t.after(async () => {
      await closeServer(server)
      await disconnectPrisma()
    })
    const admin = await prisma.user.create({
      data: {
        email: "race-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "race-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Race Service", description: "Test" },
    })
    const makeRequest = () =>
      prisma.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          title: "Race",
          workflow: { create: {} },
        },
      })
    const [requestA, requestB, requestC] = await Promise.all([
      makeRequest(),
      makeRequest(),
      makeRequest(),
    ])
    const invoiceData = {
      clientId: client.id,
      description: "Work",
      total: "100.00",
      issueDate: new Date("2026-01-01"),
      dueDate: new Date("2099-01-01"),
      createdById: admin.id,
      status: "ISSUED" as const,
    }
    const first = await prisma.invoice.create({
      data: { ...invoiceData, requestId: requestA.id, invoiceNumber: "RACE-1" },
    })
    const second = await prisma.invoice.create({
      data: { ...invoiceData, requestId: requestB.id, invoiceNumber: "RACE-2" },
    })
    const third = await prisma.invoice.create({
      data: { ...invoiceData, requestId: requestC.id, invoiceNumber: "RACE-3" },
    })
    const fourth = await prisma.invoice.create({
      data: { ...invoiceData, requestId: requestC.id, invoiceNumber: "RACE-4" },
    })
    const fifth = await prisma.invoice.create({
      data: { ...invoiceData, requestId: requestB.id, invoiceNumber: "RACE-5" },
    })
    const workflow = await prisma.workflowPayment.create({
      data: {
        requestId: requestC.id,
        status: "VERIFIED",
        amount: "30.00",
        currency: "PHP",
        verifiedById: admin.id,
      },
    })
    const { token } = await issueSession(admin)
    const post = (id: string, action: string, body: object) =>
      fetch(`${origin}/api/billing/invoices/${id}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    const payment = () => ({
      amount: "80.00",
      paidAt: "2026-11-24",
      idempotencyKey: randomUUID(),
    })
    const payments = await Promise.all([
      post(first.id, "payments", payment()),
      post(first.id, "payments", payment()),
    ])
    assert.deepEqual(
      payments.map((response) => response.status).sort(),
      [201, 409],
    )
    assert.equal(
      await prisma.invoicePayment.count({ where: { invoiceId: first.id } }),
      1,
    )
    const duplicate = payment()
    const replay = await Promise.all([
      post(fifth.id, "payments", duplicate),
      post(fifth.id, "payments", duplicate),
    ])
    assert.deepEqual(
      replay.map((response) => response.status).sort(),
      [200, 201],
    )
    assert.equal(
      await prisma.invoicePayment.count({ where: { invoiceId: fifth.id } }),
      1,
    )
    const race = await Promise.all([
      post(second.id, "payments", payment()),
      post(second.id, "cancel", {}),
    ])
    assert.deepEqual(race.map((response) => response.status).sort(), [
      race.some((response) => response.status === 201) ? 201 : 200,
      409,
    ])
    const allocation = await Promise.all([
      post(third.id, "commencement", { workflowPaymentId: workflow.id }),
      post(fourth.id, "commencement", { workflowPaymentId: workflow.id }),
    ])
    assert.deepEqual(
      allocation.map((response) => response.status).sort(),
      [200, 409],
    )
    assert.equal(
      await prisma.invoice.count({ where: { workflowPaymentId: workflow.id } }),
      1,
    )
    const draft = (requestId: string) =>
      fetch(`${origin}/api/billing/invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          description: "Draft",
          total: "100.00",
          issueDate: "2026-11-01",
          dueDate: "2026-12-01",
        }),
      })
    const created = await Promise.all([draft(requestA.id), draft(requestB.id)])
    assert.deepEqual(
      created.map((response) => response.status),
      [201, 201],
    )
    const bodies = await Promise.all(
      created.map(
        (response) =>
          response.json() as Promise<{
            invoice: { id: string; version: number; invoiceNumber: string }
          }>,
      ),
    )
    assert.notEqual(
      bodies[0].invoice.invoiceNumber,
      bodies[1].invoice.invoiceNumber,
    )
    const swap = (id: string, version: number, requestId: string) =>
      fetch(`${origin}/api/billing/invoices/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          version,
          description: "Draft",
          total: "100.00",
          issueDate: "2026-11-01",
          dueDate: "2026-12-01",
        }),
      })
    const swaps = await Promise.all([
      swap(bodies[0].invoice.id, bodies[0].invoice.version, requestB.id),
      swap(bodies[1].invoice.id, bodies[1].invoice.version, requestA.id),
    ])
    assert.deepEqual(
      swaps.map((response) => response.status),
      [200, 200],
    )
  },
)
