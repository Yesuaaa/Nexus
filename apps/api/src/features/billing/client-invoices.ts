import { getPrisma } from "../../lib/db.js"
import { invoiceSummary } from "./billing-summary.js"

export async function listClientInvoices(clientId: string) {
  const invoices = await getPrisma()!.invoice.findMany({
    where: { clientId, status: "ISSUED", request: { clientId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      description: true,
      total: true,
      status: true,
      dueDate: true,
      currency: true,
      payments: { select: { amount: true } },
      workflowPayment: { select: { amount: true } },
    },
  })
  return invoices.map(({ payments, workflowPayment, ...invoice }) => ({
    ...invoice,
    ...invoiceSummary({ ...invoice, payments, workflowPayment }),
  }))
}
