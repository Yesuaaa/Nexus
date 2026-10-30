import { BookedServicesPage } from "@/features/bookings/pages/booked-services-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string | string[] }>
}) {
  const { booking } = await searchParams
  const initialBookingId =
    typeof booking === "string" && booking.length <= 200 ? booking : null
  return (
    <BookedServicesPage
      key={initialBookingId ?? "list"}
      initialBookingId={initialBookingId}
    />
  )
}
