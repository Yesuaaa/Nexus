import assert from "node:assert/strict"
import { test } from "node:test"
import { Prisma, Role } from "../../../src/generated/prisma/client.js"
import { invoiceSummary } from "../../../src/features/billing/billing-summary.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "billing invoice list is restricted to Admin and Superadmin",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const user = await prisma.user.create({
      data: {
        email: "billing-api@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const { token } = await issueSession(user)
    const list = () =>
      fetch(`${base}/billing/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    for (const [role, expected] of [
      [Role.ADMIN, 200],
      [Role.SUPERADMIN, 200],
      [Role.STAFF, 403],
      [Role.USER, 403],
    ] as const) {
      await prisma.user.update({ where: { id: user.id }, data: { role } })
      const response = await list()
      assert.equal(response.status, expected, role)
      const report = await fetch(
        `${base}/billing/reports/revenue/dashboard?from=2026-01-01&to=2026-12-31`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert.equal(report.status, expected, `report ${role}`)
      if (expected === 200)
        assert.deepEqual(await response.json(), {
          rows: [],
          total: 0,
          page: 1,
          pageSize: 10,
        })
    }
  },
)

test(
  "invoice list returns persisted amounts and supports search",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "billing-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "billing-client@example.test",
        passwordHash: "test-only",
        fullName: "Example Client",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Billing Test Service", description: "Test service" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Example Request",
      },
    })
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-TEST-001",
        clientId: client.id,
        requestId: request.id,
        description: "Test engagement",
        total: "100.00",
        issueDate: new Date("2026-01-01T00:00:00Z"),
        dueDate: new Date("2099-01-01T00:00:00Z"),
        createdById: admin.id,
        status: "ISSUED",
      },
    })
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: "25.50",
        paidAt: new Date(),
        createdById: admin.id,
        idempotencyKey: "d61ba021-8fe6-41f2-831b-86ac4d7fb413",
      },
    })
    const { token } = await issueSession(admin)
    const response = await fetch(`${base}/billing/invoices?search=INV-TEST`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      total: number
      rows: {
        total: string
        collected: string
        outstanding: string
        displayStatus: string
        client: { fullName: string }
        request: { title: string }
      }[]
    }
    assert.equal(body.total, 1)
    assert.equal(body.rows[0].total, "100.00")
    assert.equal(body.rows[0].collected, "25.50")
    assert.equal(body.rows[0].outstanding, "74.50")
    assert.equal(body.rows[0].displayStatus, "PARTIALLY_PAID")
    assert.equal(body.rows[0].client.fullName, "Example Client")
    assert.equal(body.rows[0].request.title, "Example Request")
  },
)

test(
  "clients read only their own issued invoices",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "client-billing-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "client-billing-a@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const other = await prisma.user.create({
      data: {
        email: "client-billing-b@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Client Billing Service", description: "Test" },
    })
    const first = await prisma.serviceRequest.create({
      data: { clientId: client.id, serviceId: service.id, title: "First" },
    })
    const second = await prisma.serviceRequest.create({
      data: { clientId: other.id, serviceId: service.id, title: "Second" },
    })
    const common = {
      description: "Work",
      total: "100.00",
      issueDate: new Date("2026-01-01"),
      dueDate: new Date("2099-01-01"),
      createdById: admin.id,
    }
    await prisma.invoice.create({
      data: {
        ...common,
        invoiceNumber: "CLIENT-ISSUED",
        clientId: client.id,
        requestId: first.id,
        status: "ISSUED",
      },
    })
    await prisma.invoice.create({
      data: {
        ...common,
        invoiceNumber: "CLIENT-DRAFT",
        clientId: client.id,
        requestId: first.id,
      },
    })
    await prisma.invoice.create({
      data: {
        ...common,
        invoiceNumber: "OTHER-ISSUED",
        clientId: other.id,
        requestId: second.id,
        status: "ISSUED",
      },
    })
    const { token } = await issueSession(client)
    const response = await fetch(`${base}/request-workflows/billing/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(response.status, 200)
    const data = (await response.json()) as {
      invoiceNumber: string
      outstanding: string
    }[]
    assert.deepEqual(
      data.map((row) => row.invoiceNumber),
      ["CLIENT-ISSUED"],
    )
    assert.equal(data[0].outstanding, "100.00")
  },
)

test(
  "payments list keeps commencement and manual collections distinct",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "payments-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "payments-client@example.test",
        passwordHash: "test-only",
        fullName: "Payments Client",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Payments Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Work",
        workflow: { create: {} },
      },
    })
    const workflow = await prisma.workflowPayment.create({
      data: {
        requestId: request.id,
        amount: "30.00",
        currency: "PHP",
        status: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date("2026-11-01"),
      },
    })
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "PAY-1",
        clientId: client.id,
        requestId: request.id,
        workflowPaymentId: workflow.id,
        description: "Work",
        total: "100.00",
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2099-01-01"),
        createdById: admin.id,
        status: "ISSUED",
      },
    })
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: "25.00",
        paidAt: new Date("2026-11-02"),
        createdById: admin.id,
        idempotencyKey: "3e6d6842-17bf-4ef0-9d41-8b13e9ec797b",
      },
    })
    const { token } = await issueSession(admin)
    const fetchPayments = (query = "") =>
      fetch(`${base}/billing/payments${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    const response = await fetchPayments("?search=Payments%20Client")
    assert.equal(response.status, 200)
    const result = (await response.json()) as {
      total: number
      rows: { source: string; amount: string; invoiceNumber: string }[]
    }
    assert.equal(result.total, 2)
    assert.deepEqual(
      result.rows.map((row) => row.source),
      ["INVOICE", "COMMENCEMENT"],
    )
    assert.deepEqual(
      result.rows.map((row) => row.amount),
      ["25.00", "30.00"],
    )
    const filtered = await fetchPayments("?source=COMMENCEMENT")
    assert.equal(((await filtered.json()) as { total: number }).total, 1)
  },
)

test(
  "finance overview excludes drafts and counts each collection once",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "overview-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "overview-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Overview Service", description: "Test" },
    })
    const first = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "First",
        workflow: { create: {} },
      },
    })
    const second = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Second",
        workflow: { create: {} },
      },
    })
    const sandboxRequest = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Sandbox",
        workflow: { create: {} },
      },
    })
    await prisma.workflowPayment.create({
      data: {
        requestId: sandboxRequest.id,
        amount: "500.00",
        currency: "PHP",
        status: "VERIFIED",
        reference: "XENDIT-SANDBOX-EXAMPLE",
      },
    })
    const workflow = await prisma.workflowPayment.create({
      data: {
        requestId: first.id,
        amount: "20.00",
        currency: "PHP",
        status: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date(),
      },
    })
    await prisma.workflowPayment.create({
      data: {
        requestId: second.id,
        amount: "15.00",
        currency: "PHP",
        status: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date(),
      },
    })
    const baseData = {
      clientId: client.id,
      requestId: first.id,
      description: "Work",
      issueDate: new Date("2020-01-01"),
      dueDate: new Date("2020-02-01"),
      createdById: admin.id,
    }
    const issued = await prisma.invoice.create({
      data: {
        ...baseData,
        invoiceNumber: "OV-ISSUED",
        total: "100.00",
        status: "ISSUED",
        workflowPaymentId: workflow.id,
      },
    })
    await prisma.invoice.create({
      data: { ...baseData, invoiceNumber: "OV-DRAFT", total: "900.00" },
    })
    await prisma.invoice.create({
      data: {
        ...baseData,
        invoiceNumber: "OV-CANCELLED",
        total: "800.00",
        status: "CANCELLED",
      },
    })
    await prisma.invoicePayment.create({
      data: {
        invoiceId: issued.id,
        amount: "10.00",
        paidAt: new Date(),
        createdById: admin.id,
        idempotencyKey: "9d804d07-11a1-45a2-9999-4d5bf2e99897",
      },
    })
    await prisma.expense.create({
      data: {
        description: "Overview hosting",
        category: "Hosting",
        amount: "5.25",
        expenseDate: new Date(),
        createdById: admin.id,
      },
    })
    const { token } = await issueSession(admin)
    const response = await fetch(`${base}/billing/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(response.status, 200)
    const data = (await response.json()) as {
      totals: {
        invoiced: string
        collected: string
        outstanding: string
        overdue: string
      }
      unallocated: unknown[]
      aging: string[]
      activity: { type: string }[]
      performance: { collections: string; expenses: string }[]
    }
    assert.deepEqual(data.totals, {
      invoiced: "100.00",
      collected: "45.00",
      outstanding: "70.00",
      overdue: "70.00",
      current: "0.00",
      unallocated: "15.00",
      expenses: "5.25",
      netCollections: "39.75",
      monthlyExpenses: "5.25",
    })
    assert.equal(data.unallocated.length, 1)
    assert.deepEqual(data.aging, ["0.00", "0.00", "0.00", "70.00"])
    assert.ok(data.activity.some((row) => row.type === "Expense"))
    assert.ok(data.activity.some((row) => row.type === "Invoice"))
    assert.ok(data.activity.some((row) => row.type === "Payment"))
    assert.equal(data.performance.at(-1)?.collections, "45.00")
    assert.equal(data.performance.at(-1)?.expenses, "5.25")
  },
)

test(
  "finance reports aggregate actual issued invoices, collections and expenses by date",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "report-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "report-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Report Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Work",
        workflow: { create: {} },
      },
    })
    const data = {
      clientId: client.id,
      requestId: request.id,
      description: "Work",
      issueDate: new Date("2026-11-01"),
      dueDate: new Date("2099-01-01"),
      createdById: admin.id,
    }
    const invoice = await prisma.invoice.create({
      data: {
        ...data,
        invoiceNumber: "REPORT-ISSUED",
        total: "100.00",
        status: "ISSUED",
      },
    })
    await prisma.invoice.create({
      data: { ...data, invoiceNumber: "REPORT-DRAFT", total: "900.00" },
    })
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: "25.00",
        paidAt: new Date("2026-11-10"),
        createdById: admin.id,
        idempotencyKey: "67385a28-bb31-4812-9818-1142bd2c69ab",
      },
    })
    await prisma.expense.create({
      data: {
        description: "Service fee",
        category: "Software",
        amount: "10.00",
        expenseDate: new Date("2026-11-10"),
        createdById: admin.id,
      },
    })
    await prisma.workflowPayment.create({
      data: {
        requestId: request.id,
        amount: "5.00",
        currency: "PHP",
        status: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date("2026-10-31T16:00:00Z"),
      },
    })
    const sandboxRequest = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Sandbox report",
        workflow: { create: {} },
      },
    })
    await prisma.workflowPayment.create({
      data: {
        requestId: sandboxRequest.id,
        amount: "500.00",
        currency: "PHP",
        status: "VERIFIED",
        reference: "XENDIT-SANDBOX-EXAMPLE",
        verifiedAt: new Date("2026-11-05T00:00:00Z"),
      },
    })
    const { token } = await issueSession(admin)
    const get = async (kind: string) => {
      const response = await fetch(
        `${base}/billing/reports/${kind}?from=2026-11-01&to=2026-11-30`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert.equal(response.status, 200)
      return response.json() as Promise<{ total: string }>
    }
    assert.equal((await get("revenue")).total, "100.00")
    assert.equal((await get("collections")).total, "30.00")
    assert.equal((await get("expense-summary")).total, "10.00")
    const dashboard = async (
      kind: string,
      dates = "from=2026-11-01&to=2026-11-30",
    ) => {
      const response = await fetch(
        `${base}/billing/reports/${kind}/dashboard?${dates}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert.equal(response.status, 200)
      return response.json() as Promise<{
        metrics: { label: string; value: string }[]
        rows: { cells: string[] }[]
        chart: { first: string; second: string }[]
        breakdown: { label: string; value: string }[]
      }>
    }
    const revenue = await dashboard("revenue")
    assert.equal(revenue.metrics[0].value, "100.00")
    assert.equal(revenue.metrics[1].value, "30.00")
    assert.equal(revenue.rows.length, 1)
    assert.deepEqual(
      revenue.chart.map((row) => [row.first, row.second]),
      [["100.00", "30.00"]],
    )
    const collections = await dashboard("collections")
    assert.deepEqual(
      collections.metrics.map((row) => row.value),
      ["30.00", "25.00", "5.00", "5.00"],
    )
    assert.equal(collections.rows.length, 2)
    const expense = await dashboard("expense-summary")
    assert.equal(expense.metrics[0].value, "10.00")
    assert.deepEqual(expense.breakdown, [{ label: "Software", value: "10.00" }])
    assert.equal(expense.rows.length, 1)
    const receivables = await dashboard(
      "receivables",
      "from=2099-01-01&to=2099-01-31",
    )
    assert.equal(receivables.metrics[0].value, "75.00")
    assert.equal(receivables.rows.length, 1)
    assert.equal(
      (await dashboard("collections", "from=2026-12-01&to=2026-12-31"))
        .metrics[0].value,
      "0.00",
    )
  },
)

test("invoice stays current through its due calendar day in Manila", () => {
  const invoice = {
    total: new Prisma.Decimal("100.00"),
    status: "ISSUED" as const,
    dueDate: new Date("2026-11-24T00:00:00Z"),
    payments: [],
    workflowPayment: null,
  }
  assert.equal(
    invoiceSummary(invoice, new Date("2026-11-24T15:59:59Z")).displayStatus,
    "ISSUED",
  )
  assert.equal(
    invoiceSummary(invoice, new Date("2026-11-24T16:00:00Z")).displayStatus,
    "OVERDUE",
  )
})
