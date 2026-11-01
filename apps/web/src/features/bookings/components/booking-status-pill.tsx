import { Pill } from "@/components/ui/pill"
import type { ServiceRequestStatus } from "@/features/services/api/services-api"
import { bookingStatuses } from "../model/booking-status"

export function BookingStatusPill({
  status,
  label,
}: {
  status: ServiceRequestStatus
  label?: string
}) {
  const info = bookingStatuses[status]
  return <Pill className={info.className}>{label ?? info.label}</Pill>
}
