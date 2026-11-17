export const serviceRequestStatusValues = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLIENT_INFO",
  "READY_FOR_QUOTATION",
  "CLOSED",
  "CANCELLED",
] as const

export type ServiceRequestStatus = (typeof serviceRequestStatusValues)[number]
