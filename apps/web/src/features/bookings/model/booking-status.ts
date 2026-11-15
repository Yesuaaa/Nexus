import type { PillTone } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/service-operations/model/service-request-contracts"
import { serviceRequestStatuses } from "../../services/model/service-request-status.ts"

export const bookingStatuses: Record<
  ServiceRequestStatus,
  { label: string; tone: PillTone }
> = serviceRequestStatuses

export function bookingDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}
