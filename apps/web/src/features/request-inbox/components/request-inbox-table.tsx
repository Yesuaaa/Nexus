import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { Eye, MessageSquare, Trash2 } from "lucide-react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { TableSortButton } from "@/components/ui/table-sort-button"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { Pill } from "@/components/ui/pill"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
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
  if (request.status === "SUBMITTED") return <Pill tone="warning">Pending</Pill>
  return <BookingStatusPill status={request.status} />
}

export function RequestInboxTable({
  requests,
  loading,
  error,
  viewKey,
  quickKey,
  onRowsSettled,
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
  onRowsSettled?: () => void
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
        style={{ color: "#070f1f" }}
        rowClassName={cn(
          grid,
          "!text-foreground @max-[800px]:flex @max-[800px]:flex-wrap @max-[800px]:gap-x-4 @max-[800px]:gap-y-0",
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
            className="!text-[#070f1f]"
            style={{ color: "#070f1f" }}
            aria-sort={
              sortBy === column
                ? sortDir === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            <TableSortButton
              label={label}
              direction={sortBy === column ? sortDir : null}
              className="min-h-9 whitespace-nowrap !text-[#070f1f] @max-[800px]:min-h-11"
              ariaLabel={`Sort by ${label.toLowerCase()}${sortBy === column ? `, ${sortDir === "asc" ? "ascending" : "descending"}` : ""}`}
              onClick={() => onSort(column)}
            />
          </ResponsiveDataTableColumnHeader>
        ))}
        <ResponsiveDataTableColumnHeader
          className="!text-[#070f1f] @max-[800px]:hidden"
          style={{ color: "#070f1f" }}
        >
          Actions
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>
      {loading && viewKey === "" ? (
        <ResponsiveDataTableBody>
          <DataTableSkeletonRows
            label="requests"
            rowClassName={cn(
              grid,
              "h-[58px] px-4 py-[7px] @max-[800px]:h-[210px] @max-[800px]:gap-y-2",
            )}
            cellClassNames={[
              "@max-[800px]:col-start-1 @max-[800px]:row-start-1",
              "@max-[800px]:col-span-2 @max-[800px]:row-start-2",
              "@max-[800px]:col-span-2 @max-[800px]:row-start-3",
              "@max-[800px]:col-span-2 @max-[800px]:row-start-4",
              "@max-[800px]:col-span-2 @max-[800px]:row-start-5",
              "@max-[800px]:col-start-2 @max-[800px]:row-start-1",
            ]}
          />
        </ResponsiveDataTableBody>
      ) : error ? (
        <ResponsiveDataTableBody>
          <DataTableErrorRow message={error} onRetry={onRetry} colSpan={6} />
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={requests}
          getKey={requestKey}
          rowClassName={rowClass}
          viewKey={viewKey}
          quickKey={quickKey}
          onRowsSettled={onRowsSettled}
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
                </button>
              </div>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
