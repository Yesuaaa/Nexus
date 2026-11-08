import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  MessageSquare,
  Trash2,
} from "lucide-react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { BookingStatusPill } from "@/features/bookings/components/booking-status-pill"
import { cn } from "@/lib/utils"
import type { InboxRequest, InboxSort } from "../api/request-inbox-api"

const grid =
  "grid grid-cols-[minmax(120px,1.2fr)_minmax(120px,1.2fr)_minmax(130px,1.2fr)_minmax(100px,1fr)_minmax(100px,1fr)_112px] items-center gap-3.5 @max-[800px]:grid-cols-[minmax(0,1fr)_auto]"

function rowClass(_request: InboxRequest, _index: number, isLast: boolean) {
  return cn(
    grid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground transition-colors hover:bg-[#e8eef2] @max-[800px]:h-[210px] @max-[800px]:gap-y-2",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

function requestKey(request: InboxRequest) {
  return request.id
}

function StatusCell({ request }: { request: InboxRequest }) {
  if (request.status === "SUBMITTED")
    return (
      <span className="inline-flex items-center rounded-md bg-[#fff1d6] px-2 py-0.5 text-[10px] font-medium text-[#8a5a00]">
        Pending
      </span>
    )
  return <BookingStatusPill status={request.status} />
}

export function RequestInboxTable({
  requests,
  loading,
  error,
  viewKey,
  quickKey,
  onRetry,
  onView,
  onGoToChat,
  onDelete,
  sortBy,
  sortDir,
  onSort,
}: {
  requests: InboxRequest[]
  loading: boolean
  error: string
  viewKey: string
  quickKey: string
  onRetry: () => void
  onView: (request: InboxRequest) => void
  onGoToChat: (request: InboxRequest) => void
  onDelete: (request: InboxRequest) => void
  sortBy: InboxSort
  sortDir: "asc" | "desc"
  onSort: (column: InboxSort) => void
}) {
  const { formatDate } = useDatePreferences()
  return (
    <ResponsiveDataTable label="Department requests" aria-busy={loading}>
      <ResponsiveDataTableHeader
        rowClassName={cn(
          grid,
          "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground @max-[800px]:flex @max-[800px]:flex-wrap @max-[800px]:gap-x-4 @max-[800px]:gap-y-0",
        )}
      >
        {(
          [
            ["service", "Service"],
            ["reference", "Reference"],
            ["client", "Client"],
            ["status", "Status"],
            ["createdAt", "Date requested"],
          ] as const
        ).map(([column, label]) => (
          <ResponsiveDataTableColumnHeader
            key={column}
            aria-sort={
              sortBy === column
                ? sortDir === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            <button
              type="button"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-sm text-xs font-semibold whitespace-nowrap text-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c] @max-[800px]:min-h-11"
              onClick={() => onSort(column)}
              aria-label={`Sort by ${label.toLowerCase()}${sortBy === column ? `, ${sortDir === "asc" ? "ascending" : "descending"}` : ""}`}
            >
              {label}
              {sortBy === column ? (
                sortDir === "asc" ? (
                  <ArrowUp size={12} aria-hidden="true" />
                ) : (
                  <ArrowDown size={12} aria-hidden="true" />
                )
              ) : (
                <ArrowUpDown size={12} aria-hidden="true" />
              )}
            </button>
          </ResponsiveDataTableColumnHeader>
        ))}
        <ResponsiveDataTableColumnHeader className="@max-[800px]:hidden">
          Actions
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>
      {(loading && requests.length === 0) || error ? (
        <ResponsiveDataTableBody>
          <ResponsiveDataTableRow>
            <ResponsiveDataTableCell
              aria-colspan={6}
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
            </ResponsiveDataTableCell>
          </ResponsiveDataTableRow>
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={requests}
          getKey={requestKey}
          rowClassName={rowClass}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows
          ariaBusy={loading}
          defaultRowHeight={58}
          className="relative min-w-0 overflow-x-clip"
          emptyContent="No requests match this view."
          renderRow={(request) => (
            <>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-start-1 @max-[800px]:row-start-1"
              >
                <p className="m-0 truncate font-semibold">
                  <span className="mr-1.5 hidden text-[#738096] @max-[800px]:inline">
                    Service
                  </span>
                  {request.service.name}
                  <HoverTooltip>{request.service.name}</HoverTooltip>
                </p>
              </div>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-span-2 @max-[800px]:row-start-2"
              >
                <p className="m-0 truncate text-[11px] text-[#52627a]">
                  <span className="mr-1.5 hidden text-[#738096] @max-[800px]:inline">
                    Reference
                  </span>
                  <span>{request.referenceNumber || request.id}</span>
                  <HoverTooltip>
                    {request.referenceNumber || request.id}
                  </HoverTooltip>
                </p>
              </div>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-span-2 @max-[800px]:row-start-3"
              >
                <p className="m-0 truncate font-medium">
                  <span className="mr-1.5 hidden text-[#738096] @max-[800px]:inline">
                    Client
                  </span>
                  {request.client.fullName || "Client"}
                </p>
                <p className="mt-1 mb-0 truncate text-[11px] text-[#738096]">
                  {request.client.email}
                  <HoverTooltip>{request.client.email}</HoverTooltip>
                </p>
              </div>
              <div
                role="cell"
                className="@max-[800px]:col-span-2 @max-[800px]:row-start-4"
              >
                <StatusCell request={request} />
              </div>
              <div
                role="cell"
                className="text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-5"
              >
                <span className="mr-2 hidden text-[#738096] @max-[800px]:inline">
                  Requested
                </span>
                <time dateTime={request.createdAt}>
                  {formatDate(request.createdAt)}
                </time>
              </div>
              <div
                role="cell"
                className="flex items-center justify-start gap-2 @max-[800px]:col-start-2 @max-[800px]:row-start-1 @max-[800px]:justify-self-end"
              >
                <button
                  type="button"
                  id={`booking-view-${request.id}`}
                  aria-label={`Review request ${request.id}`}
                  className={cn(
                    rowActionButton,
                    "text-[#52627a] max-[560px]:size-11",
                  )}
                  onClick={() => onView(request)}
                >
                  <Eye size={16} aria-hidden="true" />
                  <HoverTooltip>Review request</HoverTooltip>
                </button>
                <button
                  type="button"
                  aria-label={`Go to chat for request ${request.id}`}
                  className={cn(
                    rowActionButton,
                    "text-[#52627a] max-[560px]:size-11",
                  )}
                  onClick={() => onGoToChat(request)}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  <HoverTooltip>Go to chat</HoverTooltip>
                </button>
                <button
                  type="button"
                  aria-label={`Delete request ${request.id}`}
                  className={cn(
                    rowActionButton,
                    "text-[#b42318] max-[560px]:size-11",
                  )}
                  onClick={() => onDelete(request)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <HoverTooltip>Delete request</HoverTooltip>
                </button>
              </div>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
