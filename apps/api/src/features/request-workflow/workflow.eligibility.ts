export const terminalWorkflowStates = [
  "CANCELLED",
  "DECLINED",
  "ACTIVE_PROJECT",
] as const
export const closedRequestStatuses = [
  "CANCELLED",
  "CLOSED",
  "CONCLUDED",
] as const
export const financialWorkflowStates = [
  "AGREEMENT_PAYMENT_PENDING",
  "READY_FOR_ACTIVATION",
] as const

export function isPublishedSentQuotation(quote: {
  status: string
  publishedAt: Date | null
}) {
  return quote.status === "SENT" && quote.publishedAt !== null
}

export function canSubmitAgreement(
  agreement: { status: string; documentFileId: string | null } | null,
) {
  return Boolean(agreement?.documentFileId && agreement.status === "PENDING")
}
