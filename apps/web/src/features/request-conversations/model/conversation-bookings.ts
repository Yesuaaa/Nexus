// Matches the API's archived request statuses, which it rejects for meetings.
const archivedStatuses = new Set(["CLOSED", "CANCELLED", "CONCLUDED"])

/** Bookings a meeting can still be scheduled for. */
export function openConversationBookings<Booking extends { status: string }>(
  bookings: readonly Booking[],
) {
  return bookings.filter((booking) => !archivedStatuses.has(booking.status))
}
