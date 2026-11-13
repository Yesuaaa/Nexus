import type { PillTone } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/service-operations/model/service-request-contracts"

export const bookingStatuses: Record<
  ServiceRequestStatus,
  { label: string; tone: PillTone }
> = {
  SUBMITTED: { label: "Submitted", tone: "warning" },
  UNDER_REVIEW: {
    label: "Under review",
    tone: "info",
  },
  AWAITING_CLIENT_INFO: {
    label: "Awaiting information",
    tone: "warning",
  },
  READY_FOR_QUOTATION: {
    label: "Ready for quotation",
    tone: "info",
  },
  CLOSED: { label: "Closed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
}

export function bookingDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}
