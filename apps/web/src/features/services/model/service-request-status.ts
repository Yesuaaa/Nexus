import type { PillTone } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/service-operations/model/service-request-contracts"

export const serviceRequestStatuses: Record<
  ServiceRequestStatus,
  { label: string; tone: PillTone; description: string }
> = {
  SUBMITTED: {
    label: "Pending",
    tone: "warning",
    description: "Waiting for Department Head to Accept Request",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    tone: "info",
    description: "Department Head has accepted request",
  },
  ACTIVATED: {
    label: "Activated",
    tone: "info",
    description:
      "Service Request has been assigned to a staff/team and has a workspace",
  },
  CONCLUDED: {
    label: "Concluded",
    tone: "success",
    description: "Service Request has been accomplished",
  },
  AWAITING_CLIENT_INFO: {
    label: "Under Review",
    tone: "warning",
    description:
      "The department needs more information from you to continue reviewing your request.",
  },
  READY_FOR_QUOTATION: {
    label: "Under Review",
    tone: "info",
    description: "Your request has been reviewed and is ready for a quotation.",
  },
  CLOSED: {
    label: "Cancelled",
    tone: "danger",
    description: "Service Request has been cancelled",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "danger",
    description: "Service Request has been cancelled",
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
