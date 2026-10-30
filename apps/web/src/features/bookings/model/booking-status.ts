import type { ServiceRequestStatus } from "@/features/services/api/services-api"

export const bookingStatuses: Record<
  ServiceRequestStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending review",
    className: "bg-[#fff3df] text-[#805316]",
  },
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
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-[#e8eef9] text-[#244993]",
  },
  COMPLETED: { label: "Completed", className: "bg-[#e5f4ed] text-[#116348]" },
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
