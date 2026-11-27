import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "manual collections are decimal-safe, idempotent, audited and admin-only",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "billing-write-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "billing-write-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Billing Write Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: { clientId: client.id, serviceId: service.id, title: "Request" },
    })
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-WRITE-1",
        clientId: client.id,
        requestId: request.id,
        description: "Work",
        total: "100.00",
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2099-01-01"),
        createdById: admin.id,
        status: "ISSUED",
      },
    })
    const { token } = await issueSession(admin)
    const send = (path: string, body: object) =>
      fetch(`${base}/billing/invoices/${invoice.id}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    const input = {
      amount: "30.25",
      paidAt: "2026-11-01",
      idempotencyKey: randomUUID(),
    }
    assert.equal((await send("payments", input)).status, 201)
    assert.equal((await send("payments", input)).status, 200)
    assert.equal(await prisma.invoicePayment.count(), 1)
    assert.equal(
      (await send("payments", { ...input, amount: "30.26" })).status,
      409,
    )
    assert.equal(
      (
        await send("payments", {
          ...input,
          amount: "69.76",
          idempotencyKey: randomUUID(),
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await send("payments", {
          ...input,
          amount: "1.001",
          idempotencyKey: randomUUID(),
        })
      ).status,
      400,
    )
    assert.equal((await send("cancel", {})).status, 409)
    const finalPayment = await send("payments", {
      ...input,
      amount: "69.75",
      idempotencyKey: randomUUID(),
    })
    assert.equal(finalPayment.status, 201)
    assert.equal(
      ((await finalPayment.json()) as { outstanding: string }).outstanding,
      "0.00",
    )
    assert.equal(
      (
        await send("payments", {
          ...input,
          amount: "0.01",
          idempotencyKey: randomUUID(),
        })
      ).status,
      409,
    )
    assert.equal(
      await prisma.serviceOperationLog.count({
        where: { event: "INVOICE_PAYMENT_RECORDED", subjectId: invoice.id },
      }),
      2,
    )
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: Role.SUPERADMIN },
    })
    assert.equal(
      (await send("payments", { ...input, idempotencyKey: randomUUID() }))
        .status,
      403,
    )
  },
)

test(
  "commencement allocation rejects sandbox, unverified, wrong-request and duplicate payments",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "allocate-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "allocate-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Allocation Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Request",
        workflow: { create: {} },
      },
    })
    const other = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Other",
        workflow: { create: {} },
      },
    })
    const data = {
      clientId: client.id,
      requestId: request.id,
      description: "Work",
      total: "100.00",
      issueDate: new Date("2026-01-01"),
      dueDate: new Date("2099-01-01"),
      createdById: admin.id,
      status: "ISSUED" as const,
    }
    const invoice = await prisma.invoice.create({
      data: { ...data, invoiceNumber: "INV-ALLOC-1" },
    })
    const second = await prisma.invoice.create({
      data: { ...data, invoiceNumber: "INV-ALLOC-2" },
    })
    const payment = await prisma.workflowPayment.create({
      data: {
        requestId: request.id,
        amount: "40.00",
        currency: "PHP",
        status: "PENDING",
      },
    })
    const wrong = await prisma.workflowPayment.create({
      data: {
        requestId: other.id,
        amount: "40.00",
        currency: "PHP",
        status: "VERIFIED",
        verifiedById: admin.id,
      },
    })
    const { token } = await issueSession(admin)
    const apply = (id: string, workflowPaymentId: string) =>
      fetch(`${base}/billing/invoices/${id}/commencement`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workflowPaymentId }),
      })
    assert.equal((await apply(invoice.id, payment.id)).status, 409)
    assert.equal((await apply(invoice.id, wrong.id)).status, 409)
    await prisma.workflowPayment.update({
      where: { id: payment.id },
      data: { status: "VERIFIED", reference: "XENDIT-SANDBOX-TEST" },
    })
    assert.equal((await apply(invoice.id, payment.id)).status, 409)
    await prisma.workflowPayment.update({
      where: { id: payment.id },
      data: { verifiedById: admin.id, reference: "REAL" },
    })
    await prisma.workflowPayment.update({
      where: { id: payment.id },
      data: { currency: "USD" },
    })
    assert.equal((await apply(invoice.id, payment.id)).status, 409)
    await prisma.workflowPayment.update({
      where: { id: payment.id },
      data: { currency: "PHP", amount: "100.01" },
    })
    assert.equal((await apply(invoice.id, payment.id)).status, 409)
    await prisma.workflowPayment.update({
      where: { id: payment.id },
      data: { amount: "40.00" },
    })
    const eligible = await fetch(
      `${base}/billing/invoices/${invoice.id}/commencement`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    assert.equal(eligible.status, 200)
    assert.equal(
      ((await eligible.json()) as { payment: { id: string } }).payment.id,
      payment.id,
    )
    const response = await apply(invoice.id, payment.id)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      collected: "40.00",
      outstanding: "60.00",
    })
    assert.equal((await apply(second.id, payment.id)).status, 409)
    assert.equal(await prisma.invoicePayment.count(), 0)
    assert.equal(
      await prisma.serviceOperationLog.count({
        where: { event: "INVOICE_PAYMENT_ALLOCATED", subjectId: invoice.id },
      }),
      1,
    )
  },
)

test(
  "draft issuance snapshots identity and rejects stale or repeated transitions",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "issue-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "issue-client@example.test",
        passwordHash: "test-only",
        fullName: "Client",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Issue Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: { clientId: client.id, serviceId: service.id, title: "Request" },
    })
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-ISSUE-1",
        clientId: client.id,
        requestId: request.id,
        description: "Work",
        total: "100.00",
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2099-01-01"),
        createdById: admin.id,
      },
    })
    const { token } = await issueSession(admin)
    const issue = (version: number) =>
      fetch(`${base}/billing/invoices/${invoice.id}/issue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version }),
      })
    assert.equal((await issue(10)).status, 409)
    assert.equal((await issue(invoice.version)).status, 200)
    assert.equal((await issue(invoice.version)).status, 409)
    const issued = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    })
    assert.equal(issued.status, "ISSUED")
    assert.ok(issued.issuedAt)
    assert.ok(issued.issuedSnapshot)
    await prisma.user.update({
      where: { id: client.id },
      data: { fullName: "Changed Client" },
    })
    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { title: "Changed request" },
    })
    const listing = await fetch(`${base}/billing/invoices?search=INV-ISSUE-1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listed = (await listing.json()) as {
      rows: { client: { fullName: string }; request: { title: string } }[]
    }
    assert.equal(listed.rows[0].client.fullName, "Client")
    assert.equal(listed.rows[0].request.title, "Request")
    assert.equal(
      await prisma.serviceOperationLog.count({
        where: { event: "INVOICE_ISSUED", subjectId: invoice.id },
      }),
      1,
    )
  },
)

test(
  "invoice drafts can be created and edited with version checks",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "draft-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "draft-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Draft Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: { clientId: client.id, serviceId: service.id, title: "Request" },
    })
    const { token } = await issueSession(admin)
    const send = (path: string, method: string, body: object) =>
      fetch(`${base}/billing/invoices${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    const payload = {
      requestId: request.id,
      description: "Design",
      total: "100.00",
      issueDate: "2026-11-01",
      dueDate: "2026-12-01",
    }
    const created = await send("", "POST", payload)
    assert.equal(created.status, 201)
    const { invoice } = (await created.json()) as {
      invoice: {
        id: string
        invoiceNumber: string
        status: string
        version: number
      }
    }
    assert.match(invoice.invoiceNumber, /^INV-\d+$/)
    assert.equal(invoice.status, "DRAFT")
    assert.equal(
      (
        await send(`/${invoice.id}`, "PATCH", {
          ...payload,
          total: "120.50",
          version: 9,
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await send(`/${invoice.id}`, "PATCH", {
          ...payload,
          total: "120.50",
          version: invoice.version,
        })
      ).status,
      200,
    )
    const stored = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    })
    assert.equal(stored.total.toFixed(2), "120.50")
    const otherClient = await prisma.user.create({
      data: {
        email: "draft-other@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const otherRequest = await prisma.serviceRequest.create({
      data: {
        clientId: otherClient.id,
        serviceId: service.id,
        title: "Other request",
      },
    })
    assert.equal(
      (
        await send(`/${invoice.id}`, "PATCH", {
          ...payload,
          requestId: otherRequest.id,
          total: "120.50",
          version: stored.version,
        })
      ).status,
      200,
    )
    const moved = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    })
    assert.equal(moved.requestId, otherRequest.id)
    assert.equal(moved.clientId, otherClient.id)
    assert.equal(
      (await send(`/${invoice.id}/issue`, "POST", { version: moved.version }))
        .status,
      200,
    )
    assert.equal(
      (
        await send(`/${invoice.id}`, "PATCH", {
          ...payload,
          total: "1.00",
          version: moved.version + 1,
        })
      ).status,
      409,
    )
    assert.equal(
      await prisma.serviceOperationLog.count({
        where: {
          subjectId: invoice.id,
          event: { in: ["INVOICE_CREATED", "INVOICE_EDITED"] },
        },
      }),
      3,
    )
  },
)

test(
  "expense management enforces role, money, filters and audit",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "expense-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const { token } = await issueSession(admin)
    const send = (path: string, method = "GET", body?: object) =>
      fetch(`${base}/billing/expenses${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const data = {
      description: "Cloud service",
      category: "Software",
      amount: "25.50",
      expenseDate: "2026-11-01",
    }
    assert.equal(
      (await send("", "POST", { ...data, amount: "2.999" })).status,
      400,
    )
    const created = await send("", "POST", data)
    assert.equal(created.status, 201)
    const { expense } = (await created.json()) as {
      expense: { id: string; version: number }
    }
    assert.equal(
      (
        await send(`/${expense.id}`, "PATCH", {
          ...data,
          amount: "30.00",
          version: 4,
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await send(`/${expense.id}`, "PATCH", {
          ...data,
          amount: "30.00",
          version: expense.version,
        })
      ).status,
      200,
    )
    const list = await send("?category=Software&from=2026-11-01&to=2026-11-01")
    assert.equal(((await list.json()) as { total: number }).total, 1)
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: Role.SUPERADMIN },
    })
    assert.equal((await send(`/${expense.id}`, "DELETE")).status, 403)
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: Role.ADMIN },
    })
    assert.equal((await send(`/${expense.id}`, "DELETE")).status, 200)
    assert.equal(await prisma.expense.count(), 0)
    assert.equal(
      await prisma.serviceOperationLog.count({
        where: {
          subjectId: expense.id,
          event: {
            in: ["EXPENSE_CREATED", "EXPENSE_EDITED", "EXPENSE_DELETED"],
          },
        },
      }),
      3,
    )
  },
)

test(
  "billing settings persist, restrict writes and drive new invoice prefixes",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "settings-admin@example.test",
        passwordHash: "test-only",
        role: Role.ADMIN,
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "settings-client@example.test",
        passwordHash: "test-only",
        role: Role.USER,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Settings Service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: { clientId: client.id, serviceId: service.id, title: "Work" },
    })
    const { token } = await issueSession(admin)
    const send = (path: string, method = "GET", body?: object) =>
      fetch(`${base}/billing/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const settings = await send("settings")
    assert.equal(settings.status, 200)
    const initial = (await settings.json()) as {
      configuration: { version: number }
    }
    const updated = {
      defaultTerms: "Due within 14 days",
      defaultDueDays: 14,
      invoicePrefix: "BILL",
      version: initial.configuration.version,
    }
    assert.equal((await send("settings", "PATCH", updated)).status, 200)
    assert.equal((await send("settings", "PATCH", updated)).status, 409)
    const methodResponse = await send("payment-methods", "POST", {
      label: "Bank transfer",
    })
    assert.equal(methodResponse.status, 201)
    const { method } = (await methodResponse.json()) as {
      method: { id: string }
    }
    const invoice = await send("invoices", "POST", {
      requestId: request.id,
      description: "Work",
      total: "100.00",
      issueDate: "2026-11-01",
      dueDate: "2026-11-15",
    })
    assert.equal(invoice.status, 201)
    const created = (await invoice.json()) as {
      invoice: { id: string; invoiceNumber: string; version: number }
    }
    assert.match(created.invoice.invoiceNumber, /^BILL-\d+$/)
    assert.equal(
      (
        await send(`invoices/${created.invoice.id}/issue`, "POST", {
          version: created.invoice.version,
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await send(`invoices/${created.invoice.id}/payments`, "POST", {
          amount: "1.00",
          paidAt: "2026-11-01",
          idempotencyKey: randomUUID(),
          methodId: method.id,
        })
      ).status,
      201,
    )
    assert.equal(
      (await send(`payment-methods/${method.id}`, "DELETE")).status,
      409,
    )
    assert.equal(
      (
        await send("settings", "PATCH", {
          ...updated,
          invoicePrefix: "NEW",
          defaultTerms: "New terms",
          version: 1,
        })
      ).status,
      200,
    )
    const issued = await prisma.invoice.findUniqueOrThrow({
      where: { id: created.invoice.id },
    })
    assert.equal(
      (issued.issuedSnapshot as { paymentTerms: string }).paymentTerms,
      "Due within 14 days",
    )
    assert.match(issued.invoiceNumber, /^BILL-\d+$/)
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: Role.SUPERADMIN },
    })
    assert.equal(
      (await send("settings", "PATCH", { ...updated, version: 1 })).status,
      403,
    )
    assert.equal(
      (await send("payment-methods", "POST", { label: "Cash" })).status,
      403,
    )
  },
)
