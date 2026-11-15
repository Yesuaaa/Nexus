export const serviceRequestStatusValues = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTIVATED",
  "CANCELLED",
  "CONCLUDED",
] as const

export type ServiceRequestStatus =
  | (typeof serviceRequestStatusValues)[number]
  | "AWAITING_CLIENT_INFO"
  | "READY_FOR_QUOTATION"
  | "CLOSED"
