export function isSandboxWorkflowPayment(payment: {
  status: string
  verifiedById: string | null
  reference: string | null
}): boolean {
  return (
    payment.status === "VERIFIED" &&
    payment.verifiedById === null &&
    Boolean(payment.reference?.startsWith("XENDIT-SANDBOX-"))
  )
}
