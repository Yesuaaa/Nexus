import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { isSandboxWorkflowPayment } from "../request-workflow/workflow-payment.js"
import { paymentDate } from "./billing-writes.js"
import { invoiceSummary } from "./billing-summary.js"

type ReportRow = { label: string; total: string }
function result(groups: Map<string, Prisma.Decimal>) {
  const rows: ReportRow[] = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, total: value.toFixed(2) }))
  return {
    total: [...groups.values()]
      .reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0))
      .toFixed(2),
    rows,
  }
}
export async function billingReport(kind: string, from: string, to: string) {
  const start = from ? paymentDate(from, "start date") : undefined
  const end = to ? paymentDate(to, "end date") : undefined
  if (start && end && start > end) fail(400, "Invalid date range")
  const endExclusive = end ? new Date(end.getTime() + 86400000) : undefined
  const range = start || end ? { gte: start, lt: endExclusive } : undefined
  // Workflow verification is timestamped; report date boundaries use Philippine time.
  const workflowRange =
    start || end
      ? {
          gte: start ? new Date(start.getTime() - 8 * 3600000) : undefined,
          lt: endExclusive
            ? new Date(endExclusive.getTime() - 8 * 3600000)
            : undefined,
        }
      : undefined
  const db = getPrisma()!
  const groups = new Map<string, Prisma.Decimal>()
  const add = (key: string, value: Prisma.Decimal) =>
    groups.set(key, (groups.get(key) ?? new Prisma.Decimal(0)).plus(value))
  if (kind === "revenue") {
    const rows = await db.invoice.groupBy({
      by: ["issueDate"],
      where: { status: "ISSUED", issueDate: range },
      _sum: { total: true },
      orderBy: { issueDate: "asc" },
    })
    for (const row of rows)
      add(
        row.issueDate.toISOString().slice(0, 10),
        row._sum.total ?? new Prisma.Decimal(0),
      )
    return result(groups)
  }
  if (kind === "expense-summary") {
    const rows = await db.expense.groupBy({
      by: ["category", "expenseDate"],
      where: { expenseDate: range },
      _sum: { amount: true },
      orderBy: { category: "asc" },
    })
    for (const row of rows)
      add(
        `${row.expenseDate.toISOString().slice(0, 7)} · ${row.category}`,
        row._sum.amount ?? new Prisma.Decimal(0),
      )
    return result(groups)
  }
  if (kind === "collections") {
    const [manual, workflow] = await db.$transaction(
      [
        db.invoicePayment.aggregate({
          where: { invoice: { status: "ISSUED" }, paidAt: range },
          _sum: { amount: true },
        }),
        db.workflowPayment.findMany({
          where: {
            status: "VERIFIED",
            currency: "PHP",
            amount: { gt: 0 },
            verifiedAt: workflowRange,
            OR: [{ invoice: null }, { invoice: { status: "ISSUED" } }],
          },
          select: {
            amount: true,
            status: true,
            reference: true,
            verifiedById: true,
          },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    )
    if (manual._sum.amount) add("Invoice payments", manual._sum.amount)
    for (const row of workflow)
      if (!isSandboxWorkflowPayment(row))
        add("Commencement payments", row.amount)
    return result(groups)
  }
  if (kind === "receivables") {
    const invoices = await db.invoice.findMany({
      where: { status: "ISSUED", dueDate: range },
      select: {
        total: true,
        status: true,
        dueDate: true,
        payments: { select: { amount: true } },
        workflowPayment: { select: { amount: true } },
      },
    })
    for (const invoice of invoices) {
      const summary = invoiceSummary(invoice)
      const outstanding = new Prisma.Decimal(summary.outstanding)
      if (outstanding.gt(0))
        add(
          summary.displayStatus === "OVERDUE" ? "Overdue" : "Current",
          outstanding,
        )
    }
    return result(groups)
  }
  fail(404, "Report not found")
}
