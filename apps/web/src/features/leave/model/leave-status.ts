import type { LeaveRequest } from "../api/leave-api"

const statusLabels = {
  SUBMITTED: "Submitted",
  VERIFIED: "Awaiting HR",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
} as const

export function leaveStatusLabel({ status, capabilities }: LeaveRequest) {
  if (capabilities.requiresReverification) {
    return capabilities.fallback
      ? "Requires resubmission"
      : "Awaiting Head verification"
  }
  return statusLabels[status]
}
