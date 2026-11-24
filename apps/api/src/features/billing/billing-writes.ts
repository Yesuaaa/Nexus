import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows, lockServiceRequest } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId, isUuidV4 } from "../../shared/validation.js"
import { writeServiceLog } from "../service-operation-logs/log-writer.js"
import { isSandboxWorkflowPayment } from "../request-workflow/workflow-payment.js"
import { invoiceSummary } from "./billing-summary.js"

type LockedInvoice = NonNullable<Awaited<ReturnType<typeof readInvoice>>>
async function readInvoice(tx: Prisma.TransactionClient, id: string) {
  return tx.invoice.findUnique({
    where: { id },
    include: { payments: true, workflowPayment: true },
  })
}
function totals(invoice: LockedInvoice) {
  const { collected, outstanding } = invoiceSummary(invoice)
  return {
    collected,
    outstanding,
  }
}
async function withInvoice<T>(
  id: string,
  operation: (
    tx: Prisma.TransactionClient,
    invoice: LockedInvoice,
  ) => Promise<T>,
  nextRequestId?: string,
): Promise<T> {
  if (!isRecordId(id)) fail(400, "Invalid invoice reference")
  const prisma = getPrisma()!
  const initial = await prisma.invoice.findUnique({
    where: { id },
    select: { requestId: true },
  })
  if (!initial) fail(404, "Invoice not found")
  return prisma.$transaction(async (tx) => {
    if (nextRequestId && nextRequestId !== initial.requestId) {
      const requestIds = [initial.requestId, nextRequestId]
      await lockRows(tx, "ServiceRequest", requestIds)
      const requests = await tx.serviceRequest.findMany({
        where: { id: { in: requestIds } },
        select: { acceptedDepartmentId: true },
      })
      await lockRows(
        tx,
        "Department",
        requests.map((request) => request.acceptedDepartmentId),
        "share",
      )
    } else {
      await lockServiceRequest(tx, initial.requestId)
    }
    await lockRows(tx, "Invoice", id)
    const invoice = await readInvoice(tx, id)
    if (!invoice || invoice.requestId !== initial.requestId)
      fail(409, "Invoice changed; refresh and retry")
    return operation(tx, invoice)
  })
}
export function amount(value: unknown): Prisma.Decimal {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)
  )
    fail(400, "Enter a valid PHP amount with at most two decimal places")
  const result = new Prisma.Decimal(value)
  if (result.lte(0)) fail(400, "Amount must be positive")
  return result
}
export function paymentDate(value: unknown, label = "date"): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, `Invalid ${label}`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  )
    fail(400, `Invalid ${label}`)
  return date
}
export function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || value.trim().length > max)
    fail(400, `Invalid ${label}`)
  return value.trim() || null
}
function requireOutstanding(invoice: LockedInvoice, value: Prisma.Decimal) {
  if (invoice.status !== "ISSUED" || invoice.currency !== "PHP")
    fail(409, "Invoice is not eligible for payment")
  const remaining = new Prisma.Decimal(totals(invoice).outstanding)
  if (remaining.lte(0) || value.gt(remaining))
    fail(409, "Payment exceeds the outstanding balance")
}
export async function recordInvoicePayment(
  id: string,
  actorId: string,
  input: Record<string, unknown>,
) {
  const value = amount(input.amount)
  const paidAt = paymentDate(input.paidAt, "payment date")
  const reference = optionalText(input.reference, "reference", 300)
  const note = optionalText(input.note, "note", 2000)
  const methodId =
    input.methodId == null || input.methodId === "" ? null : input.methodId
  if (methodId !== null && !isRecordId(methodId))
    fail(400, "Invalid payment method")
  if (!isUuidV4(input.idempotencyKey)) fail(400, "Invalid idempotency key")
  const key = input.idempotencyKey
  return withInvoice(id, async (tx, invoice) => {
    if (methodId) await lockRows(tx, "BillingPaymentMethod", methodId)
    const method = methodId
      ? await tx.billingPaymentMethod.findUnique({ where: { id: methodId } })
      : null
    if (methodId && !method) fail(400, "Payment method not found")
    const methodLabel = method?.label ?? null
    const prior = await tx.invoicePayment.findUnique({
      where: {
        createdById_idempotencyKey: {
          createdById: actorId,
          idempotencyKey: key,
        },
      },
    })
    if (prior) {
      if (
        prior.invoiceId !== id ||
        !prior.amount.equals(value) ||
        prior.paidAt.getTime() !== paidAt.getTime() ||
        prior.reference !== reference ||
        prior.note !== note ||
        prior.methodLabel !== methodLabel
      )
        fail(409, "Idempotency key was already used for a different payment")
      return { created: false, payment: prior, ...totals(invoice) }
    }
    requireOutstanding(invoice, value)
    const payment = await tx.invoicePayment.create({
      data: {
        invoiceId: id,
        amount: value,
        paidAt,
        reference,
        note,
        methodLabel,
        createdById: actorId,
        idempotencyKey: key,
      },
    })
    await writeServiceLog(
      tx,
      "INVOICE_PAYMENT_RECORDED",
      id,
      invoice.requestId,
      actorId,
      undefined,
      {
        targetLabel: invoice.invoiceNumber,
        changes: [
          { field: "Amount", before: null, after: `PHP ${value.toFixed(2)}` },
        ],
      },
    )
    const updated = await readInvoice(tx, id)
    if (!updated) fail(409, "Invoice changed")
    return { created: true, payment, ...totals(updated) }
  })
}
export async function allocateCommencement(
  id: string,
  actorId: string,
  paymentId: unknown,
) {
  if (!isRecordId(paymentId)) fail(400, "Invalid payment reference")
  return withInvoice(id, async (tx, invoice) => {
    const payment = await tx.workflowPayment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { id: true } } },
    })
    if (
      !payment ||
      payment.status !== "VERIFIED" ||
      payment.amount.lte(0) ||
      isSandboxWorkflowPayment(payment) ||
      payment.requestId !== invoice.requestId ||
      payment.currency !== invoice.currency ||
      payment.invoice ||
      invoice.workflowPaymentId
    )
      fail(409, "Commencement payment is not eligible for allocation")
    requireOutstanding(invoice, payment.amount)
    await tx.invoice.update({
      where: { id },
      data: { workflowPaymentId: payment.id, version: { increment: 1 } },
    })
    await writeServiceLog(
      tx,
      "INVOICE_PAYMENT_ALLOCATED",
      id,
      invoice.requestId,
      actorId,
      undefined,
      {
        targetLabel: invoice.invoiceNumber,
        changes: [
          {
            field: "Amount",
            before: null,
            after: `PHP ${payment.amount.toFixed(2)}`,
          },
        ],
      },
    )
    const updated = await readInvoice(tx, id)
    if (!updated) fail(409, "Invoice changed")
    return totals(updated)
  })
}

export async function eligibleCommencement(id: string) {
  if (!isRecordId(id)) fail(400, "Invalid invoice reference")
  const prisma = getPrisma()!
  const invoice = await readInvoice(prisma, id)
  if (!invoice) fail(404, "Invoice not found")
  if (
    invoice.status !== "ISSUED" ||
    invoice.currency !== "PHP" ||
    invoice.workflowPaymentId
  )
    return null
  const payment = await prisma.workflowPayment.findUnique({
    where: { requestId: invoice.requestId },
    include: { invoice: { select: { id: true } } },
  })
  if (
    !payment ||
    payment.status !== "VERIFIED" ||
    payment.amount.lte(0) ||
    isSandboxWorkflowPayment(payment) ||
    payment.currency !== invoice.currency ||
    payment.invoice ||
    payment.amount.gt(new Prisma.Decimal(totals(invoice).outstanding))
  )
    return null
  return {
    id: payment.id,
    amount: payment.amount.toFixed(2),
    reference: payment.reference,
  }
}
export async function cancelInvoice(id: string, actorId: string) {
  return withInvoice(id, async (tx, invoice) => {
    if (
      invoice.status === "CANCELLED" ||
      invoice.workflowPaymentId ||
      invoice.payments.length
    )
      fail(409, "Invoice cannot be cancelled")
    const updated = await tx.invoice.update({
      where: { id },
      data: { status: "CANCELLED", version: { increment: 1 } },
    })
    await writeServiceLog(
      tx,
      "INVOICE_CANCELLED",
      id,
      invoice.requestId,
      actorId,
      undefined,
      {
        targetLabel: invoice.invoiceNumber,
        changes: [
          { field: "Status", before: invoice.status, after: "CANCELLED" },
        ],
      },
    )
    return updated
  })
}

export async function issueInvoice(
  id: string,
  actorId: string,
  version: unknown,
) {
  if (!Number.isSafeInteger(version) || (version as number) < 0)
    fail(400, "Invalid invoice version")
  return withInvoice(id, async (tx, invoice) => {
    if (invoice.status !== "DRAFT" || invoice.version !== version)
      fail(409, "Invoice changed; refresh and retry")
    if (
      invoice.total.lte(0) ||
      invoice.currency !== "PHP" ||
      invoice.dueDate < invoice.issueDate ||
      invoice.workflowPaymentId ||
      invoice.payments.length
    )
      fail(409, "Invoice is not eligible for issuance")
    const request = await tx.serviceRequest.findUnique({
      where: { id: invoice.requestId },
      include: {
        client: { select: { fullName: true, email: true } },
        service: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    })
    if (
      !request ||
      request.clientId !== invoice.clientId ||
      (invoice.projectId && request.project?.id !== invoice.projectId)
    )
      fail(409, "Invoice associations no longer match")
    if (
      invoice.quotationId &&
      !(await tx.workflowQuotation.findFirst({
        where: {
          id: invoice.quotationId,
          requestId: invoice.requestId,
          status: "ACCEPTED",
        },
        select: { id: true },
      }))
    )
      fail(409, "Invoice quotation is not approved for this request")
    await lockRows(tx, "BillingConfiguration", "global", "share")
    const configuration = await tx.billingConfiguration.findUniqueOrThrow({
      where: { id: "global" },
    })
    const issued = await tx.invoice.update({
      where: { id },
      data: {
        status: "ISSUED",
        issuedAt: new Date(),
        version: { increment: 1 },
        issuedSnapshot: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientName: request.client.fullName,
          clientEmail: request.client.email,
          requestId: invoice.requestId,
          requestTitle: request.title,
          serviceName: request.service.name,
          projectId: invoice.projectId,
          projectName: invoice.projectId
            ? (request.project?.name ?? null)
            : null,
          description: invoice.description,
          total: invoice.total.toFixed(2),
          currency: invoice.currency,
          issueDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
          paymentTerms: configuration.defaultTerms,
        },
      },
    })
    await writeServiceLog(
      tx,
      "INVOICE_ISSUED",
      id,
      invoice.requestId,
      actorId,
      undefined,
      {
        targetLabel: invoice.invoiceNumber,
        changes: [{ field: "Status", before: "DRAFT", after: "ISSUED" }],
      },
    )
    return issued
  })
}

type DraftInput = {
  requestId: string
  description: string
  total: Prisma.Decimal
  issueDate: Date
  dueDate: Date
  projectId: string | null
  quotationId: string | null
}
function parseDraft(input: Record<string, unknown>): DraftInput {
  if (!isRecordId(input.requestId)) fail(400, "Invalid service request")
  if (
    typeof input.description !== "string" ||
    !input.description.trim() ||
    input.description.trim().length > 4000
  )
    fail(400, "Invalid description")
  const issueDate = paymentDate(input.issueDate)
  const dueDate = paymentDate(input.dueDate)
  if (dueDate < issueDate) fail(400, "Due date must not precede issue date")
  const projectId =
    input.projectId == null || input.projectId === "" ? null : input.projectId
  const quotationId =
    input.quotationId == null || input.quotationId === ""
      ? null
      : input.quotationId
  if (
    (projectId !== null && !isRecordId(projectId)) ||
    (quotationId !== null && !isRecordId(quotationId))
  )
    fail(400, "Invalid invoice association")
  return {
    requestId: input.requestId,
    description: input.description.trim(),
    total: amount(input.total),
    issueDate,
    dueDate,
    projectId,
    quotationId,
  }
}
async function validateDraftAssociations(
  tx: Prisma.TransactionClient,
  draft: DraftInput,
) {
  const request = await tx.serviceRequest.findUnique({
    where: { id: draft.requestId },
    select: { clientId: true, project: { select: { id: true } } },
  })
  if (!request) fail(404, "Service request not found")
  if (draft.projectId && draft.projectId !== request.project?.id)
    fail(400, "Project does not belong to the service request")
  if (
    draft.quotationId &&
    !(await tx.workflowQuotation.findFirst({
      where: {
        id: draft.quotationId,
        requestId: draft.requestId,
        status: "ACCEPTED",
      },
      select: { id: true },
    }))
  )
    fail(400, "Quotation is not approved for the service request")
  return request.clientId
}
export async function createInvoice(
  actorId: string,
  input: Record<string, unknown>,
) {
  const draft = parseDraft(input)
  return getPrisma()!.$transaction(async (tx) => {
    await lockServiceRequest(tx, draft.requestId)
    const clientId = await validateDraftAssociations(tx, draft)
    await lockRows(tx, "BillingConfiguration", "global", "share")
    const configuration = await tx.billingConfiguration.findUniqueOrThrow({
      where: { id: "global" },
    })
    let invoiceNumber = ""
    for (let attempt = 0; attempt < 100; attempt++) {
      const [sequence] = await tx.$queryRaw<
        { value: bigint }[]
      >`SELECT nextval('"BillingInvoiceNumberSequence"') AS value`
      invoiceNumber = `${configuration.invoicePrefix}-${sequence.value.toString().padStart(6, "0")}`
      if (
        !(await tx.invoice.findUnique({
          where: { invoiceNumber },
          select: { id: true },
        }))
      )
        break
      invoiceNumber = ""
    }
    if (!invoiceNumber) fail(409, "Unable to reserve an invoice number")
    const invoice = await tx.invoice.create({
      data: {
        ...draft,
        invoiceNumber,
        clientId,
        createdById: actorId,
        currency: "PHP",
      },
    })
    await writeServiceLog(
      tx,
      "INVOICE_CREATED",
      invoice.id,
      invoice.requestId,
      actorId,
      undefined,
      {
        targetLabel: invoice.invoiceNumber,
        changes: [
          { field: "Status", before: null, after: "DRAFT" },
          {
            field: "Total",
            before: null,
            after: `PHP ${invoice.total.toFixed(2)}`,
          },
        ],
      },
    )
    return invoice
  })
}
export async function editInvoice(
  id: string,
  actorId: string,
  input: Record<string, unknown>,
) {
  const draft = parseDraft(input)
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 0)
    fail(400, "Invalid invoice version")
  return withInvoice(
    id,
    async (tx, invoice) => {
      if (invoice.status !== "DRAFT" || invoice.version !== input.version)
        fail(409, "Invoice changed; refresh and retry")
      if (invoice.workflowPaymentId || invoice.payments.length)
        fail(409, "A draft with collections cannot be edited")
      const clientId = await validateDraftAssociations(tx, draft)
      const updated = await tx.invoice.update({
        where: { id },
        data: { ...draft, clientId, version: { increment: 1 } },
      })
      await writeServiceLog(
        tx,
        "INVOICE_EDITED",
        id,
        updated.requestId,
        actorId,
        undefined,
        {
          targetLabel: invoice.invoiceNumber,
          changes: [
            {
              field: "Service request",
              before: invoice.requestId,
              after: updated.requestId,
            },
            {
              field: "Total",
              before: `PHP ${invoice.total.toFixed(2)}`,
              after: `PHP ${updated.total.toFixed(2)}`,
            },
            {
              field: "Issue date",
              before: invoice.issueDate.toISOString().slice(0, 10),
              after: updated.issueDate.toISOString().slice(0, 10),
            },
            {
              field: "Due date",
              before: invoice.dueDate.toISOString().slice(0, 10),
              after: updated.dueDate.toISOString().slice(0, 10),
            },
          ],
        },
      )
      return updated
    },
    draft.requestId,
  )
}
