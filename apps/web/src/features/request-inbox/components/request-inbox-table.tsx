import { Eye } from "lucide-react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { BookingStatusPill } from "@/features/bookings/components/booking-status-pill"
import { bookingDate } from "@/features/bookings/model/booking-status"
import { cn } from "@/lib/utils"
import type { InboxRequest } from "../api/request-inbox-api"

const grid =
  "grid grid-cols-[minmax(180px,1.6fr)_minmax(150px,1.2fr)_minmax(120px,1fr)_110px_44px] items-center gap-4 @max-[800px]:grid-cols-[minmax(0,1fr)_44px]"
function rowClass(_request: InboxRequest, _index: number, isLast: boolean) {
  return cn(
    grid,
    "h-[76px] border-b border-[#eceef1] bg-background px-4 py-3 text-xs hover:bg-[#e8eef2] @max-[800px]:h-[184px] @max-[800px]:gap-y-2",
    isLast && "rounded-b-[7px] border-b-0",
  )
}
function requestKey(request: InboxRequest) {
  return request.id
}

export function RequestInboxTable({
  requests,
  loading,
  error,
  viewKey,
  quickKey,
  onRetry,
  onView,
}: {
  requests: InboxRequest[]
  loading: boolean
  error: string
  viewKey: string
  quickKey: string
  onRetry: () => void
  onView: (request: InboxRequest) => void
}) {
  return (
    <div
      role="table"
      aria-label="Department requests"
      aria-busy={loading}
      className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background"
    >
      <div role="rowgroup" className="@max-[800px]:sr-only">
        <div
          role="row"
          className={cn(
            grid,
            "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold",
          )}
        >
          {[
            "Service / Reference",
            "Client",
            "Status",
            "Date requested",
            "Actions",
          ].map((title) => (
            <span role="columnheader" key={title}>
              {title}
            </span>
          ))}
        </div>
      </div>
      {(loading && requests.length === 0) || error ? (
        <div role="rowgroup">
          <div role="row">
            <div
              role="cell"
              aria-colspan={5}
              className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#52627a]"
            >
              {loading ? (
                <span role="status">Loading requests…</span>
              ) : (
                <div role="alert">
                  <p>{error}</p>
                  <Button variant="outline" onClick={onRetry}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <AnimatedSlotGridBody
          items={requests}
          getKey={requestKey}
          rowClassName={rowClass}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows
          ariaBusy={loading}
          defaultRowHeight={76}
          className="relative min-w-0 overflow-x-clip"
          emptyContent="No requests match this view."
          renderRow={(request) => (
            <>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-start-1 @max-[800px]:row-start-1"
              >
                <p
                  className="m-0 truncate font-semibold"
                  title={request.service.name}
                >
                  {request.service.name}
                </p>
                <p
                  className="mt-1 mb-0 truncate text-[11px] text-[#738096]"
                  title={request.id}
                >
                  {request.id}
                </p>
              </div>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-span-2 @max-[800px]:row-start-2"
              >
                <p className="m-0 truncate font-medium">
                  {request.client.fullName || "Client"}
                </p>
                <p
                  className="mt-1 mb-0 truncate text-[11px] text-[#738096]"
                  title={request.client.email}
                >
                  {request.client.email}
                </p>
              </div>
              <div
                role="cell"
                className="@max-[800px]:col-span-2 @max-[800px]:row-start-3"
              >
                <BookingStatusPill status={request.status} />
              </div>
              <div
                role="cell"
                className="text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-4"
              >
                <span className="mr-2 hidden text-[#738096] @max-[800px]:inline">
                  Requested
                </span>
                <time dateTime={request.createdAt}>
                  {bookingDate(request.createdAt)}
                </time>
              </div>
              <div
                role="cell"
                className="justify-self-end @max-[800px]:col-start-2 @max-[800px]:row-start-1"
              >
                <button
                  type="button"
                  id={`booking-view-${request.id}`}
                  aria-label={`Review request ${request.id}`}
                  className={cn(
                    rowActionButton,
                    "text-[#203f8c] max-[560px]:size-11",
                  )}
                  onClick={() => onView(request)}
                >
                  <Eye size={16} aria-hidden="true" />
                  <HoverTooltip>Review request</HoverTooltip>
                </button>
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}
