import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { manilaCalendarDay } from "../../shared/calendar-date.js"
import { fail } from "../../shared/http-error.js"
import { isSandboxWorkflowPayment } from "../request-workflow/workflow-payment.js"
import { invoiceSummary } from "./billing-summary.js"
import { paymentDate } from "./billing-writes.js"

/** Read-only report data; date-only fields and verification timestamps follow the existing report rules. */
export async function billingDashboard(kind: string, from: string, to: string) {
  if (
    !["revenue", "collections", "receivables", "expense-summary"].includes(kind)
  )
    fail(404, "Report not found")
  const start = from ? paymentDate(from, "start date") : undefined
  const end = to ? paymentDate(to, "end date") : undefined
  if (start && end && start > end) fail(400, "Invalid date range")
  const next = end ? new Date(end.getTime() + 86400000) : undefined
  const range = start || end ? { gte: start, lt: next } : undefined
  const timestamps =
    start || end
      ? {
          gte: start && new Date(start.getTime() - 28800000),
          lt: next && new Date(next.getTime() - 28800000),
        }
      : undefined
  const db = getPrisma()!
  const [invoices, manual, workflow, expenses] = await db.$transaction(
    [
      db.invoice.findMany({
        where: {
          status: "ISSUED",
          ...(kind === "receivables"
            ? { dueDate: range }
            : { issueDate: range }),
        },
        include: {
          client: { select: { fullName: true, email: true } },
          request: { select: { title: true } },
          payments: { select: { amount: true } },
          workflowPayment: { select: { amount: true } },
        },
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      }),
      db.invoicePayment.findMany({
        where: { invoice: { status: "ISSUED" }, paidAt: range },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              client: { select: { fullName: true, email: true } },
            },
          },
        },
        orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      }),
      db.workflowPayment.findMany({
        where: {
          status: "VERIFIED",
          currency: "PHP",
          amount: { gt: 0 },
          verifiedAt: timestamps,
          OR: [{ invoice: null }, { invoice: { status: "ISSUED" } }],
        },
        include: {
          invoice: { select: { invoiceNumber: true } },
          workflow: {
            select: {
              request: {
                select: { client: { select: { fullName: true, email: true } } },
              },
            },
          },
        },
        orderBy: [
          { verifiedAt: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
      }),
      db.expense.findMany({
        where: { expenseDate: range },
        include: { createdBy: { select: { fullName: true, email: true } } },
        orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  )
  const validWorkflow = workflow.filter((row) => !isSandboxWorkflowPayment(row))
  const zero = () => new Prisma.Decimal(0)
  const sum = (values: Prisma.Decimal[]) =>
    values.reduce((a, b) => a.plus(b), zero())
  const name = (user: { fullName: string | null; email: string }) =>
    user.fullName || user.email
  const monthly = new Map<
    string,
    { first: Prisma.Decimal; second: Prisma.Decimal }
  >()
  const groups = new Map<string, Prisma.Decimal>()
  const addGroup = (label: string, value: Prisma.Decimal) =>
    groups.set(label, (groups.get(label) ?? zero()).plus(value))
  const addMonth = (
    date: Date | null,
    value: Prisma.Decimal,
    series: "first" | "second",
    timestamp = false,
  ) => {
    if (!date) return
    const key = new Date(date.getTime() + (timestamp ? 28800000 : 0))
      .toISOString()
      .slice(0, 7)
    const item = monthly.get(key) ?? { first: zero(), second: zero() }
    item[series] = item[series].plus(value)
    monthly.set(key, item)
  }
  const manualTotal = sum(manual.map((row) => row.amount))
  const workflowTotal = sum(validWorkflow.map((row) => row.amount))
  const collected = manualTotal.plus(workflowTotal)
  const billed = sum(invoices.map((row) => row.total))
  const totalExpenses = sum(expenses.map((row) => row.amount))
  const today = manilaCalendarDay()
  const metrics: {
    label: string
    value: string
    description: string
    money: boolean
  }[] = []
  const metric = (
    label: string,
    value: Prisma.Decimal | number,
    description: string,
    money = true,
  ) =>
    metrics.push({
      label,
      value: money ? new Prisma.Decimal(value).toFixed(2) : String(value),
      description,
      money,
    })
  let rows: { id: string; cells: string[]; status?: string }[]
  let columns: string[]
  let series: [string, string] = ["Billed", "Collected"]
  let chartTitle = "Billed vs Collected",
    breakdownTitle = "Revenue by Client"
  let aging: { label: string; value: string }[] = []
  if (kind === "revenue") {
    metric("Total Billed", billed, "Issued in period")
    metric("Total Collected", collected, "Received in period")
    metric("Issued Invoices", invoices.length, "Invoices in period", false)
    if (invoices.length)
      metric("Average Invoice", billed.div(invoices.length), "Issued invoices")
    for (const row of invoices) {
      addMonth(row.issueDate, row.total, "first")
      addGroup(name(row.client), row.total)
    }
    for (const row of manual) addMonth(row.paidAt, row.amount, "second")
    for (const row of validWorkflow)
      addMonth(row.verifiedAt, row.amount, "second", true)
    columns = [
      "Invoice #",
      "Client",
      "Service request",
      "Issue Date",
      "Billed",
      "Collected",
      "Outstanding",
      "Status",
    ]
    rows = invoices.map((row) => {
      const summary = invoiceSummary(row)
      return {
        id: row.id,
        status: summary.displayStatus,
        cells: [
          row.invoiceNumber,
          name(row.client),
          row.request.title,
          row.issueDate.toISOString().slice(0, 10),
          summary.total,
          summary.collected,
          summary.outstanding,
          summary.displayStatus,
        ],
      }
    })
  } else if (kind === "collections") {
    metric("Total Collected", collected, "Recognized collections")
    metric("Invoice Payments", manualTotal, "Manual payments")
    metric("Commencement Payments", workflowTotal, "Verified payments")
    metric(
      "Unallocated Collections",
      sum(validWorkflow.filter((row) => !row.invoice).map((row) => row.amount)),
      "Not applied to an invoice",
    )
    series = ["Invoice payments", "Commencement"]
    chartTitle = "Collections Over Time"
    breakdownTitle = "Collection Source"
    addGroup("Invoice payments", manualTotal)
    addGroup("Commencement payments", workflowTotal)
    for (const row of manual) addMonth(row.paidAt, row.amount, "first")
    for (const row of validWorkflow)
      addMonth(row.verifiedAt, row.amount, "second", true)
    columns = [
      "Reference",
      "Client",
      "Source",
      "Invoice",
      "Amount",
      "Allocation",
      "Date",
      "Status",
    ]
    rows = [
      ...manual.map((row) => ({
        id: `manual-${row.id}`,
        date: row.paidAt,
        status: "Received",
        cells: [
          row.reference || "—",
          name(row.invoice.client),
          "Invoice payment",
          row.invoice.invoiceNumber,
          row.amount.toFixed(2),
          "Allocated",
          row.paidAt.toISOString().slice(0, 10),
          "Received",
        ],
      })),
      ...validWorkflow.map((row) => ({
        id: `workflow-${row.id}`,
        date: row.verifiedAt,
        status: "Verified",
        cells: [
          row.reference || "—",
          name(row.workflow.request.client),
          "Commencement",
          row.invoice?.invoiceNumber || "—",
          row.amount.toFixed(2),
          row.invoice ? "Allocated" : "Unallocated",
          row.verifiedAt
            ? new Date(row.verifiedAt.getTime() + 28800000)
                .toISOString()
                .slice(0, 10)
            : "—",
          "Verified",
        ],
      })),
    ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  } else if (kind === "receivables") {
    chartTitle = "Receivable Aging"
    breakdownTitle = "Due Status"
    const balances = invoices
      .map((invoice) => ({ invoice, summary: invoiceSummary(invoice) }))
      .filter((item) => new Prisma.Decimal(item.summary.outstanding).gt(0))
    const outstanding = sum(
      balances.map((row) => new Prisma.Decimal(row.summary.outstanding)),
    )
    const overdue = sum(
      balances
        .filter((row) => row.summary.displayStatus === "OVERDUE")
        .map((row) => new Prisma.Decimal(row.summary.outstanding)),
    )
    metric("Total Receivables", outstanding, "Outstanding balances")
    metric("Current", outstanding.minus(overdue), "Not past due")
    metric("Overdue", overdue, "Past due")
    metric("Open Invoices", balances.length, "With outstanding balance", false)
    addGroup("Current", outstanding.minus(overdue))
    addGroup("Overdue", overdue)
    const buckets = [zero(), zero(), zero(), zero()]
    for (const { invoice, summary } of balances) {
      const days = Math.max(
        0,
        Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86400000),
      )
      const index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
      buckets[index] = buckets[index].plus(summary.outstanding)
    }
    aging = ["0–30 days", "31–60 days", "61–90 days", "90+ days"].map(
      (label, index) => ({ label, value: buckets[index].toFixed(2) }),
    )
    columns = [
      "Invoice #",
      "Client",
      "Due Date",
      "Days Past Due",
      "Invoice Total",
      "Collected",
      "Outstanding",
      "Status",
    ]
    rows = balances.map(({ invoice, summary }) => ({
      id: invoice.id,
      status: summary.displayStatus,
      cells: [
        invoice.invoiceNumber,
        name(invoice.client),
        invoice.dueDate.toISOString().slice(0, 10),
        String(
          Math.max(
            0,
            Math.floor(
              (today.getTime() - invoice.dueDate.getTime()) / 86400000,
            ),
          ),
        ),
        summary.total,
        summary.collected,
        summary.outstanding,
        summary.displayStatus,
      ],
    }))
  } else {
    chartTitle = "Expenses Over Time"
    breakdownTitle = "Expenses by Category"
    series = ["Expenses", ""]
    metric("Total Expenses", totalExpenses, "Recorded in period")
    metric("Expense Count", expenses.length, "Recorded expenses", false)
    if (expenses.length)
      metric(
        "Average Expense",
        totalExpenses.div(expenses.length),
        "Per recorded expense",
      )
    for (const row of expenses) {
      addMonth(row.expenseDate, row.amount, "first")
      addGroup(row.category, row.amount)
    }
    columns = [
      "Reference",
      "Description",
      "Category",
      "Amount",
      "Expense Date",
      "Vendor",
      "Recorded By",
    ]
    rows = expenses.map((row) => ({
      id: row.id,
      cells: [
        row.reference || "—",
        row.description,
        row.category,
        row.amount.toFixed(2),
        row.expenseDate.toISOString().slice(0, 10),
        row.vendor || "—",
        name(row.createdBy),
      ],
    }))
  }
  return {
    metrics,
    chartTitle,
    breakdownTitle,
    series,
    aging,
    columns,
    rows,
    breakdown: [...groups]
      .sort((a, b) => b[1].comparedTo(a[1]))
      .map(([label, value]) => ({ label, value: value.toFixed(2) })),
    chart: [...monthly]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({
        label,
        first: value.first.toFixed(2),
        second: value.second.toFixed(2),
      })),
  }
}
