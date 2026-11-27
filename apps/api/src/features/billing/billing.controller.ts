import { Router } from "express"
import { Prisma } from "../../generated/prisma/client.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  BillingCapability,
  hasBillingCapability,
} from "../auth/auth.capabilities.js"
import { fail } from "../../shared/http-error.js"
import { paginate, parsePage } from "../../shared/query/pagination.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { invoiceSummary } from "./billing-summary.js"
import { listCollections } from "./billing-collections.js"
import { billingOverview } from "./billing-overview.js"
import { billingReport } from "./billing-reports.js"
import { billingDashboard } from "./billing-dashboard.js"
import {
  getBillingSettings,
  updateBillingSettings,
  createPaymentMethod,
  deletePaymentMethod,
} from "./billing-settings.js"
import {
  listExpenses,
  createExpense,
  editExpense,
  deleteExpense,
} from "./billing-expenses.js"
import {
  allocateCommencement,
  cancelInvoice,
  issueInvoice,
  eligibleCommencement,
  createInvoice,
  editInvoice,
  recordInvoicePayment,
} from "./billing-writes.js"

export const billingRouter = Router()
billingRouter.use(requireAuth)
billingRouter.use((request, _response, next) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.READ))
    fail(403, "Billing access is required")
  next()
})

billingRouter.get("/requests", async (request, response) => {
  const page = parsePage(request.query.page)
  const search = parseQueryString(request.query.search)
  if (page === null || search === null || search.length > 200)
    fail(400, "Invalid request search")
  const where: Prisma.ServiceRequestWhereInput = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { client: { fullName: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {}
  const result = await paginate(page, {
    rows: (db, window) =>
      db.serviceRequest.findMany({
        where,
        ...window,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          title: true,
          referenceNumber: true,
          client: { select: { fullName: true, email: true } },
          project: { select: { id: true, name: true } },
          workflow: {
            select: {
              quotations: {
                where: { status: "ACCEPTED" },
                select: { id: true, total: true, currency: true },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          },
        },
      }),
    count: (db) => db.serviceRequest.count({ where }),
  })
  response.set("Cache-Control", "private, no-store")
  response.json(result)
})

billingRouter.get("/payments", async (request, response) => {
  const page = parsePage(request.query.page)
  const search = parseQueryString(request.query.search)
  const source = parseQueryString(request.query.source)
  if (
    page === null ||
    search === null ||
    search.length > 200 ||
    source === null ||
    !["", "COMMENCEMENT", "INVOICE"].includes(source)
  )
    fail(400, "Invalid payment filters")
  response.set("Cache-Control", "private, no-store")
  response.json(await listCollections(page, search, source))
})

billingRouter.get("/overview", async (_request, response) => {
  response.set("Cache-Control", "private, no-store")
  response.json(await billingOverview())
})

billingRouter.get("/settings", async (_request, response) => {
  response.set("Cache-Control", "private, no-store")
  response.json(await getBillingSettings())
})
billingRouter.patch("/settings", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid configuration")
  response.json({
    configuration: await updateBillingSettings(
      request.auth!.user.id,
      request.body as Record<string, unknown>,
    ),
  })
})
billingRouter.post("/payment-methods", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  response.status(201).json({
    method: await createPaymentMethod(
      request.auth!.user.id,
      request.body?.label,
    ),
  })
})
billingRouter.delete("/payment-methods/:id", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  await deletePaymentMethod(request.auth!.user.id, String(request.params.id))
  response.json({ ok: true })
})

billingRouter.get("/reports/:kind/dashboard", async (request, response) => {
  const from = parseQueryString(request.query.from)
  const to = parseQueryString(request.query.to)
  if (from === null || to === null) fail(400, "Invalid report date range")
  response.set("Cache-Control", "private, no-store")
  response.json(await billingDashboard(String(request.params.kind), from, to))
})

billingRouter.get("/reports/:kind", async (request, response) => {
  const from = parseQueryString(request.query.from)
  const to = parseQueryString(request.query.to)
  if (from === null || to === null) fail(400, "Invalid report date range")
  response.set("Cache-Control", "private, no-store")
  response.json(await billingReport(String(request.params.kind), from, to))
})

billingRouter.get("/expenses", async (request, response) => {
  const page = parsePage(request.query.page)
  const search = parseQueryString(request.query.search)
  const category = parseQueryString(request.query.category)
  const from = parseQueryString(request.query.from)
  const to = parseQueryString(request.query.to)
  if (
    page === null ||
    search === null ||
    category === null ||
    from === null ||
    to === null ||
    search.length > 200 ||
    category.length > 100
  )
    fail(400, "Invalid expense filters")
  response.set("Cache-Control", "private, no-store")
  response.json(await listExpenses(page, search, category, from, to))
})
billingRouter.post("/expenses", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid expense")
  response.status(201).json({
    expense: await createExpense(
      request.auth!.user.id,
      request.body as Record<string, unknown>,
    ),
  })
})
billingRouter.patch("/expenses/:id", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid expense")
  response.json({
    expense: await editExpense(
      String(request.params.id),
      request.auth!.user.id,
      request.body as Record<string, unknown>,
    ),
  })
})
billingRouter.delete("/expenses/:id", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  await deleteExpense(String(request.params.id), request.auth!.user.id)
  response.json({ ok: true })
})

billingRouter.get("/invoices", async (request, response) => {
  const page = parsePage(request.query.page)
  const search = parseQueryString(request.query.search)
  const status = parseQueryString(request.query.status)
  if (
    page === null ||
    search === null ||
    search.length > 200 ||
    status === null ||
    !["", "DRAFT", "ISSUED", "CANCELLED"].includes(status)
  )
    fail(400, "Invalid invoice search")
  const where: Prisma.InvoiceWhereInput = {
    ...(status ? { status: status as "DRAFT" | "ISSUED" | "CANCELLED" } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }
  const result = await paginate(page, {
    rows: (db, window) =>
      db.invoice.findMany({
        where,
        ...window,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          client: {
            select: { id: true, email: true, fullName: true },
          },
          request: {
            select: {
              id: true,
              title: true,
              referenceNumber: true,
              project: { select: { id: true, name: true } },
            },
          },
          payments: true,
          workflowPayment: true,
        },
      }),
    count: (db) => db.invoice.count({ where }),
  })
  response.set("Cache-Control", "private, no-store")
  response.json({
    ...result,
    rows: result.rows.map((invoice) => {
      const snapshot =
        invoice.status === "ISSUED" &&
        invoice.issuedSnapshot &&
        typeof invoice.issuedSnapshot === "object" &&
        !Array.isArray(invoice.issuedSnapshot)
          ? invoice.issuedSnapshot
          : null
      const snapshotValue = (key: string) =>
        snapshot && typeof snapshot[key] === "string"
          ? (snapshot[key] as string)
          : null
      const clientName =
        snapshot &&
        Object.hasOwn(snapshot, "clientName") &&
        snapshot.clientName === null
          ? null
          : (snapshotValue("clientName") ?? invoice.client.fullName)
      return {
        ...invoice,
        client: {
          ...invoice.client,
          fullName: clientName,
          email: snapshotValue("clientEmail") ?? invoice.client.email,
        },
        request: {
          ...invoice.request,
          title: snapshotValue("requestTitle") ?? invoice.request.title,
          project: invoice.request.project
            ? {
                ...invoice.request.project,
                name:
                  snapshotValue("projectName") ?? invoice.request.project.name,
              }
            : null,
        },
        ...invoiceSummary(invoice),
      }
    }),
  })
})

billingRouter.post("/invoices", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid invoice")
  response.status(201).json({
    invoice: await createInvoice(
      request.auth!.user.id,
      request.body as Record<string, unknown>,
    ),
  })
})

billingRouter.patch("/invoices/:id", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid invoice")
  response.json({
    invoice: await editInvoice(
      String(request.params.id),
      request.auth!.user.id,
      request.body as Record<string, unknown>,
    ),
  })
})

billingRouter.post("/invoices/:id/payments", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  )
    fail(400, "Invalid payment")
  const result = await recordInvoicePayment(
    String(request.params.id),
    request.auth!.user.id,
    request.body as Record<string, unknown>,
  )
  response.status(result.created ? 201 : 200).json(result)
})

billingRouter.post("/invoices/:id/commencement", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  const result = await allocateCommencement(
    String(request.params.id),
    request.auth!.user.id,
    request.body?.workflowPaymentId,
  )
  response.json(result)
})

billingRouter.get("/invoices/:id/commencement", async (request, response) => {
  response.set("Cache-Control", "private, no-store")
  response.json({
    payment: await eligibleCommencement(String(request.params.id)),
  })
})

billingRouter.post("/invoices/:id/cancel", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  response.json({
    invoice: await cancelInvoice(
      String(request.params.id),
      request.auth!.user.id,
    ),
  })
})

billingRouter.post("/invoices/:id/issue", async (request, response) => {
  if (!hasBillingCapability(request.auth!.user, BillingCapability.MANAGE))
    fail(403, "Billing management access is required")
  response.json({
    invoice: await issueInvoice(
      String(request.params.id),
      request.auth!.user.id,
      request.body?.version,
    ),
  })
})
