import type { ServiceRequestStatus } from "../api/client-services-api"

export const serviceRequestStatuses: Record<
  ServiceRequestStatus,
  { label: string; className: string; description: string }
> = {
  SUBMITTED: {
    label: "Pending review",
    className: "bg-[#fff3d6] text-[#865b0b]",
    description:
      "Your request is waiting for review by the responsible department.",
  },
  UNDER_REVIEW: {
    label: "Under review",
    className: "bg-[#e6efff] text-[#244993]",
    description:
      "The responsible department is reviewing your service request.",
  },
  AWAITING_CLIENT_INFO: {
    label: "Awaiting your information",
    className: "bg-[#fff3d6] text-[#865b0b]",
    description:
      "The department needs more information from you to continue reviewing your request.",
  },
  READY_FOR_QUOTATION: {
    label: "Ready for quotation",
    className: "bg-[#e6efff] text-[#244993]",
    description: "Your request has been reviewed and is ready for a quotation.",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-[#e4f5e9] text-[#237442]",
    description: "The review of this service request has been closed.",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-[#f1f2f5] text-[#626e80]",
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
