import { getPrisma } from "../../lib/db.js"

export async function listClientBillingPayments(clientId: string) {
  const payments = await getPrisma()!.workflowPayment.findMany({
    where: {
      amount: { gt: 0 },
      workflow: { request: { clientId } },
      OR: [
        { status: "VERIFIED" },
        { workflow: { request: { status: { not: "CANCELLED" } } } },
      ],
    },
    orderBy: [{ verifiedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    select: {
      id: true,
      requestId: true,
      amount: true,
      currency: true,
      status: true,
      reference: true,
      verifiedAt: true,
      verifiedById: true,
      proofFile: {
        select: { id: true, name: true, mimeType: true, clientVisible: true },
      },
      workflow: {
        select: {
          request: {
            select: {
              referenceNumber: true,
              service: { select: { name: true } },
            },
          },
          approval: {
            select: {
              approvedAt: true,
              quotation: { select: { lineItems: true, total: true } },
            },
          },
          events: {
            where: { type: "PAYMENT_SUBMITTED", internal: false },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  })

  return payments.map(
    ({ amount, workflow, proofFile, verifiedById, ...payment }) => {
      const sandbox =
        payment.status === "VERIFIED" &&
        verifiedById === null &&
        Boolean(payment.reference?.startsWith("XENDIT-SANDBOX-"))
      return {
        ...payment,
        amount: amount.toFixed(2),
        serviceName: workflow.request.service.name,
        bookingReference: workflow.request.referenceNumber,
        approvedAt: workflow.approval?.approvedAt ?? null,
        lineItems:
          payment.status === "PENDING" &&
          workflow.approval?.quotation.total.equals(amount)
            ? workflow.approval.quotation.lineItems
            : null,
        submittedAt: workflow.events[0]?.createdAt ?? null,
        sandbox,
        proofFile: proofFile?.clientVisible
          ? {
              id: proofFile.id,
              name: proofFile.name,
              mimeType: proofFile.mimeType,
            }
          : null,
      }
    },
  )
}
