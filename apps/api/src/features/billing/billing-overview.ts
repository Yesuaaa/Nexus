import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isSandboxWorkflowPayment } from "../request-workflow/workflow-payment.js"
import { invoiceSummary } from "./billing-summary.js"
import { manilaCalendarDay } from "../../shared/calendar-date.js"

export async function billingOverview() {
  const prisma = getPrisma()!
  const [invoices, candidates, recentWorkflow, recentManual, expenses] =
    await prisma.$transaction(
      [
        prisma.invoice.findMany({
          where: { status: "ISSUED" },
          include: {
            client: { select: { fullName: true, email: true } },
            payments: { select: { amount: true } },
            workflowPayment: { select: { amount: true } },
          },
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        }),
        prisma.workflowPayment.findMany({
          where: {
            status: "VERIFIED",
            currency: "PHP",
            amount: { gt: 0 },
            invoice: null,
          },
          include: {
            workflow: {
              select: {
                request: {
                  select: {
                    title: true,
                    client: { select: { fullName: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: [
            { verifiedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
        }),
        prisma.workflowPayment.findMany({
          where: {
            status: "VERIFIED",
            currency: "PHP",
            amount: { gt: 0 },
            OR: [{ invoice: null }, { invoice: { status: "ISSUED" } }],
          },
          include: {
            workflow: {
              select: {
                request: {
                  select: {
                    client: { select: { fullName: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: [
            { verifiedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
        }),
        prisma.invoicePayment.findMany({
          where: { invoice: { status: "ISSUED" } },
          include: {
            invoice: {
              select: { client: { select: { fullName: true, email: true } } },
            },
          },
          orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        }),
        prisma.expense.findMany({
          orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    )
  const unallocated = candidates.filter(
    (payment) => !isSandboxWorkflowPayment(payment),
  )
  let invoiced = new Prisma.Decimal(0),
    collected = new Prisma.Decimal(0),
    outstanding = new Prisma.Decimal(0),
    overdue = new Prisma.Decimal(0)
  const open = []
  const today = manilaCalendarDay()
  const aging = [0, 1, 2, 3].map(() => new Prisma.Decimal(0))
  for (const invoice of invoices) {
    const summary = invoiceSummary(invoice)
    const balance = new Prisma.Decimal(summary.outstanding)
    invoiced = invoiced.plus(invoice.total)
    collected = collected.plus(summary.collected)
    outstanding = outstanding.plus(balance)
    if (summary.displayStatus === "OVERDUE") overdue = overdue.plus(balance)
    if (balance.gt(0))
      open.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.fullName || invoice.client.email,
        dueDate: invoice.dueDate,
        total: invoice.total.toFixed(2),
        outstanding: summary.outstanding,
        status: summary.displayStatus,
      })
    if (balance.gt(0)) {
      const days = Math.max(
        0,
        Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86400000),
      )
      const bucket = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
      aging[bucket] = aging[bucket].plus(balance)
    }
  }
  for (const payment of unallocated) collected = collected.plus(payment.amount)
  const recent = [
    ...recentWorkflow
      .filter((payment) => !isSandboxWorkflowPayment(payment))
      .slice(0, 5)
      .map((payment) => ({
        id: payment.id,
        source: "COMMENCEMENT",
        clientName:
          payment.workflow.request.client.fullName ||
          payment.workflow.request.client.email,
        amount: payment.amount.toFixed(2),
        paidAt: payment.verifiedAt,
        sandbox: false,
      })),
    ...recentManual.slice(0, 5).map((payment) => ({
      id: payment.id,
      source: "INVOICE",
      clientName:
        payment.invoice.client.fullName || payment.invoice.client.email,
      amount: payment.amount.toFixed(2),
      paidAt: payment.paidAt,
      sandbox: false,
    })),
  ]
    .sort(
      (a, b) =>
        (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 5)
  const realWorkflow = recentWorkflow.filter(
    (payment) => !isSandboxWorkflowPayment(payment),
  )
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum.plus(expense.amount),
    new Prisma.Decimal(0),
  )
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + index, 1),
    )
    return {
      month: date.toISOString().slice(0, 7),
      collections: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
    }
  })
  const addMonth = (
    date: Date | null,
    value: Prisma.Decimal,
    kind: "collections" | "expenses",
    timestamp = false,
  ) => {
    if (!date) return
    const key = new Date(date.getTime() + (timestamp ? 8 * 3600000 : 0))
      .toISOString()
      .slice(0, 7)
    const month = months.find((entry) => entry.month === key)
    if (month) month[kind] = month[kind].plus(value)
  }
  for (const row of realWorkflow)
    addMonth(row.verifiedAt, row.amount, "collections", true)
  for (const row of recentManual)
    addMonth(row.paidAt, row.amount, "collections")
  for (const row of expenses) addMonth(row.expenseDate, row.amount, "expenses")
  const activity = [
    ...invoices.map((row) => ({
      id: row.id,
      reference: row.invoiceNumber,
      description: row.client.fullName || row.client.email,
      type: "Invoice",
      amount: row.total.toFixed(2),
      status: "Issued",
      date: row.issueDate,
    })),
    ...recentManual.map((row) => ({
      id: row.id,
      reference: row.reference || row.id,
      description: row.invoice.client.fullName || row.invoice.client.email,
      type: "Payment",
      amount: row.amount.toFixed(2),
      status: "Received",
      date: row.paidAt,
    })),
    ...realWorkflow
      .filter((row) => row.verifiedAt)
      .map((row) => ({
        id: row.id,
        reference: row.reference || row.id,
        description:
          row.workflow.request.client.fullName ||
          row.workflow.request.client.email,
        type: "Commencement",
        amount: row.amount.toFixed(2),
        status: "Verified",
        date: row.verifiedAt!,
      })),
    ...expenses.map((row) => ({
      id: row.id,
      reference: row.reference || row.id,
      description: row.description,
      type: "Expense",
      amount: row.amount.toFixed(2),
      status: "Recorded",
      date: row.expenseDate,
    })),
  ]
    .sort(
      (a, b) => b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id),
    )
    .slice(0, 30)
  return {
    totals: {
      invoiced: invoiced.toFixed(2),
      collected: collected.toFixed(2),
      outstanding: outstanding.toFixed(2),
      overdue: overdue.toFixed(2),
      current: outstanding.minus(overdue).toFixed(2),
      unallocated: unallocated
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
        .toFixed(2),
      expenses: totalExpenses.toFixed(2),
      netCollections: collected.minus(totalExpenses).toFixed(2),
      monthlyExpenses: months[5].expenses.toFixed(2),
    },
    aging: aging.map((value) => value.toFixed(2)),
    performance: months.map((row) => ({
      month: row.month,
      collections: row.collections.toFixed(2),
      expenses: row.expenses.toFixed(2),
    })),
    activity,
    outstandingInvoices: open.slice(0, 5),
    unallocated: unallocated.slice(0, 5).map((payment) => ({
      id: payment.id,
      amount: payment.amount.toFixed(2),
      reference: payment.reference,
      clientName:
        payment.workflow.request.client.fullName ||
        payment.workflow.request.client.email,
      requestTitle: payment.workflow.request.title,
    })),
    recentPayments: recent,
  }
}
