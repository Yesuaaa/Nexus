import type { PillTone } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/service-operations/model/service-request-contracts"

export const serviceRequestStatuses: Record<
  ServiceRequestStatus,
  { label: string; tone: PillTone; description: string }
> = {
  SUBMITTED: {
    label: "Pending review",
    tone: "warning",
    description:
      "Your request is waiting for review by the responsible department.",
  },
  UNDER_REVIEW: {
    label: "Under review",
    tone: "info",
    description:
      "The responsible department is reviewing your service request.",
  },
  AWAITING_CLIENT_INFO: {
    label: "Awaiting your information",
    tone: "warning",
    description:
      "The department needs more information from you to continue reviewing your request.",
  },
  READY_FOR_QUOTATION: {
    label: "Ready for quotation",
    tone: "info",
    description: "Your request has been reviewed and is ready for a quotation.",
  },
  CLOSED: {
    label: "Closed",
    tone: "success",
    description: "The review of this service request has been closed.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    description: "This service request has been cancelled.",
  },
}

export function requestDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}
