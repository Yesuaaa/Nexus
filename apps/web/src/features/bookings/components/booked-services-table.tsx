import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { Eye } from "lucide-react"
import type { ReactNode } from "react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { cn } from "@/lib/utils"
import type { BookedService } from "../api/bookings-api"
import { BookingStatusPill } from "./booking-status-pill"

const bookingGrid =
  "grid grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_minmax(135px,1fr)_minmax(100px,.8fr)_minmax(120px,1fr)_44px] items-center gap-3.5 @max-[950px]:grid-cols-[minmax(0,1fr)_44px]"

function bookingKey(booking: BookedService) {
  return booking.id
}
function bookingRowClass(
  _booking: BookedService,
  _index: number,
  isLast: boolean,
) {
  return cn(
    bookingGrid,
    "h-[68px] border-b border-[#eceef1] bg-background px-4 py-2 text-xs text-foreground hover:bg-[#e8eef2] @max-[950px]:h-[200px] @max-[950px]:gap-x-3 @max-[950px]:gap-y-2 @max-[950px]:py-3",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

export function BookedServicesTable({
  bookings,
  viewKey,
  quickKey,
  onRowsSettled,
  loading,
  error,
  emptyMessage,
  onRetry,
  onView,
}: {
  bookings: BookedService[]
  viewKey: string
  quickKey: string
  onRowsSettled?: () => void
  loading: boolean
  error: string
  emptyMessage: ReactNode
  onRetry: () => void
  onView: (booking: BookedService) => void
}) {
  const { formatDate } = useDatePreferences()
  const initialLoading = loading && viewKey === ""
  return (
    <ResponsiveDataTable label="Booked services" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[950px]:sr-only"
        rowClassName={bookingGrid}
      >
        {[
          "Service / Reference",
          "Package",
          "Status",
          "Date requested",
          "Expected timeline",
          "Actions",
        ].map((title) => (
          <ResponsiveDataTableColumnHeader key={title}>
            {title}
          </ResponsiveDataTableColumnHeader>
        ))}
      </ResponsiveDataTableHeader>
      {initialLoading ? (
        <ResponsiveDataTableBody>
          <ResponsiveDataTableRow>
            <ResponsiveDataTableCell
              aria-colspan={6}
              className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]"
            >
              <span role="status">Loading booked services…</span>
            </ResponsiveDataTableCell>
          </ResponsiveDataTableRow>
        </ResponsiveDataTableBody>
      ) : error ? (
        <ResponsiveDataTableBody>
          <DataTableErrorRow message={error} onRetry={onRetry} colSpan={6} />
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={bookings}
          viewKey={viewKey}
          quickKey={quickKey}
          onRowsSettled={onRowsSettled}
          animateRows
          getKey={bookingKey}
          rowClassName={bookingRowClass}
          emptyContent={emptyMessage}
          ariaBusy={loading}
          defaultRowHeight={68}
          className="relative min-w-0 overflow-x-clip"
          renderRow={(booking) => (
            <>
              <div
                role="cell"
                className="min-w-0 @max-[950px]:col-start-1 @max-[950px]:row-start-1"
              >
                <p className="m-0 truncate font-semibold">
                  {booking.service.name}
                </p>
                <p className="mt-1 mb-0 truncate text-[11px] text-[#738096]">
                  {booking.id}
                </p>
              </div>
              <div
                role="cell"
                className="min-w-0 truncate text-[#52627a] @max-[950px]:col-span-2 @max-[950px]:row-start-3"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[950px]:inline">
                  Package
                </span>
                {booking.packageName || "Standard service"}
              </div>
              <div
                role="cell"
                className="min-w-0 @max-[950px]:col-span-2 @max-[950px]:row-start-2"
              >
                <BookingStatusPill status={booking.status} />
              </div>
              <div
                role="cell"
                className="min-w-0 text-[#52627a] @max-[950px]:col-span-2 @max-[950px]:row-start-4"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[950px]:inline">
                  Requested
                </span>
                <time dateTime={booking.createdAt}>
                  {formatDate(booking.createdAt)}
                </time>
              </div>
              <div
                role="cell"
                className="min-w-0 text-[#52627a] @max-[950px]:col-span-2 @max-[950px]:row-start-5"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[950px]:inline">
                  Timeline
                </span>
                <span className="line-clamp-2">
                  {booking.expectedTimeline || "Not specified"}
                </span>
              </div>
              <div
                role="cell"
                className="justify-self-end @max-[950px]:col-start-2 @max-[950px]:row-start-1"
              >
                <button
                  type="button"
                  id={`booking-view-${booking.id}`}
                  aria-label={`View booking ${booking.id}`}
                  className={cn(
                    rowActionButton,
                    "text-[#203f8c] max-[560px]:size-11",
                  )}
                  onClick={() => onView(booking)}
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
