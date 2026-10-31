import type { ServiceRequestStatus } from "@/features/services/api/services-api"

export const bookingStatuses: Record<
  ServiceRequestStatus,
  { label: string; className: string }
> = {
  SUBMITTED: { label: "Submitted", className: "bg-[#fff3df] text-[#805316]" },
  UNDER_REVIEW: {
    label: "Under review",
    className: "bg-[#e8eef9] text-[#244993]",
  },
  AWAITING_CLIENT_INFO: {
    label: "Awaiting information",
    className: "bg-[#fff3df] text-[#805316]",
  },
  READY_FOR_QUOTATION: {
    label: "Ready for quotation",
    className: "bg-[#e8eef9] text-[#244993]",
  },
  CLOSED: { label: "Closed", className: "bg-[#e9edf2] text-[#52627a]" },
  CANCELLED: { label: "Cancelled", className: "bg-[#fde4ea] text-[#b4234d]" },
}

export function bookingDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}
