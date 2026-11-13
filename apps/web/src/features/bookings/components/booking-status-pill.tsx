import { Pill } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/service-operations/model/service-request-contracts"
import { bookingStatuses } from "../model/booking-status"

export function BookingStatusPill({
  status,
  label,
}: {
  status: ServiceRequestStatus
  label?: string
}) {
  const info = bookingStatuses[status]
  return <Pill tone={info.tone}>{label ?? info.label}</Pill>
}
