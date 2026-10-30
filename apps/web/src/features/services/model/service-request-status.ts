import type { ServiceRequestStatus } from "../api/client-services-api"

export const serviceRequestStatuses: Record<
  ServiceRequestStatus,
  { label: string; className: string; description: string }
> = {
  PENDING: {
    label: "Pending review",
    className: "bg-[#fff3d6] text-[#865b0b]",
    description:
      "Your request is waiting for review by the responsible department.",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-[#e6efff] text-[#244993]",
    description: "The team is working on your service request.",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-[#e4f5e9] text-[#237442]",
    description: "Your service request has been completed.",
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
