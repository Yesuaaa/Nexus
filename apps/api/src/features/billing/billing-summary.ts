import { Prisma, type InvoiceStatus } from "../../generated/prisma/client.js"
import { manilaCalendarDay } from "../../shared/calendar-date.js"

type InvoiceAmounts = {
  total: Prisma.Decimal
  status: InvoiceStatus
  dueDate: Date
  payments: { amount: Prisma.Decimal }[]
  workflowPayment: { amount: Prisma.Decimal } | null
}
export function invoiceSummary(invoice: InvoiceAmounts, now = new Date()) {
  const collected = invoice.payments
    .reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0))
    .plus(invoice.workflowPayment?.amount ?? 0)
  const outstanding = invoice.total.minus(collected)
  const displayStatus =
    invoice.status !== "ISSUED"
      ? invoice.status
      : outstanding.lte(0)
        ? "PAID"
        : invoice.dueDate < manilaCalendarDay(now)
          ? "OVERDUE"
          : collected.gt(0)
            ? "PARTIALLY_PAID"
            : "ISSUED"
  return {
    total: invoice.total.toFixed(2),
    collected: collected.toFixed(2),
    outstanding: outstanding.toFixed(2),
    displayStatus,
  }
}
