import type { ReactNode } from "react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { TableSortButton } from "@/components/ui/table-sort-button"
import { cn } from "@/lib/utils"
import type { Client, ClientSort } from "../api/clients-api"

const clientGrid =
  "grid grid-cols-[minmax(180px,1.3fr)_minmax(190px,1.35fr)_minmax(130px,.9fr)_minmax(105px,.7fr)_minmax(110px,.8fr)_72px] items-center gap-3.5 @max-[800px]:grid-cols-[minmax(0,1fr)_auto]"

export const clientColumns: { key: ClientSort; label: string }[] = [
  { key: "fullName", label: "Client name" },
  { key: "email", label: "Email address" },
  { key: "isActive", label: "Account status" },
  { key: "createdAt", label: "Date registered" },
]

function registeredDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function ClientRowActions({
  client,
  onView,
}: {
  client: Client
  onView: (client: Client) => void
}) {
  const label = client.fullName?.trim() || client.email
  const actionLabel = `View details for ${label}`
  return (
    <button
      type="button"
      id={`client-view-${client.id}`}
      className={cn(
        rowActionButton,
        "text-[#203f8c] hover:enabled:text-[#172f70] max-[560px]:size-11",
      )}
      aria-label={actionLabel}
      onClick={() => onView(client)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
      <HoverTooltip className="right-0 left-auto translate-x-0 group-hover:translate-x-0 group-focus-visible:translate-x-0 group-focus-within:translate-x-0">
        View details
      </HoverTooltip>
    </button>
  )
}

function clientKey(client: Client) {
  return client.id
}

function clientRowClass(_client: Client, _index: number, isLast: boolean) {
  return cn(
    clientGrid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[800px]:h-[154px] @max-[800px]:gap-x-4 @max-[800px]:gap-y-1.5 @max-[800px]:py-3",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

export function ClientTable({
  clients,
  viewKey,
  quickKey,
  animateRows,
  loading,
  error,
  emptyMessage,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  onView,
}: {
  clients: Client[]
  viewKey: string
  quickKey: string
  animateRows: boolean
  loading: boolean
  error: string
  emptyMessage: ReactNode
  onRetry: () => void
  sortBy: ClientSort
  sortOrder: "asc" | "desc"
  onSort: (key: ClientSort) => void
  onView: (client: Client) => void
}) {
  const initialLoading = loading && clients.length === 0

  function heading(key: ClientSort) {
    return (
      <span
        role="columnheader"
        aria-sort={
          sortBy === key
            ? sortOrder === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <TableSortButton
          label={clientColumns.find((column) => column.key === key)!.label}
          direction={sortBy === key ? sortOrder : null}
          onClick={() => onSort(key)}
        />
      </span>
    )
  }

  return (
    <div
      className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background"
      role="table"
      aria-label="Clients"
      aria-busy={loading}
    >
      <div role="rowgroup" className="@max-[800px]:sr-only">
        <div
          role="row"
          className={cn(
            clientGrid,
            "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground",
          )}
        >
          {heading("fullName")}
          {heading("email")}
          <span role="columnheader">Contact number</span>
          {heading("isActive")}
          {heading("createdAt")}
          <span role="columnheader">View</span>
        </div>
      </div>

      {initialLoading || error ? (
        <div role="rowgroup">
          <div role="row">
            <div
              role="cell"
              aria-colspan={6}
              className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]"
            >
              {initialLoading ? (
                <span role="status">Loading clients…</span>
              ) : (
                <div role="alert" className="grid justify-items-center gap-3">
                  <p className="m-0">{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
                    onClick={onRetry}
                  >
                    Try again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <AnimatedSlotGridBody
          items={clients}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows={animateRows}
          getKey={clientKey}
          rowClassName={clientRowClass}
          emptyContent={emptyMessage}
          ariaBusy={loading}
          className="relative min-w-0 overflow-x-clip"
          renderRow={(client) => (
            <>
              <div
                role="cell"
                className="min-w-0 @max-[800px]:col-start-1 @max-[800px]:row-start-1"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] font-medium text-[#52627a]"
                  >
                    {(client.fullName?.trim() || client.email)[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {client.fullName?.trim() || "Name not provided"}
                  </span>
                </div>
              </div>
              <div
                role="cell"
                className="min-w-0 truncate text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-2 @max-[800px]:break-all @max-[800px]:whitespace-normal"
              >
                {client.email}
              </div>
              <div
                role="cell"
                className="min-w-0 truncate text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-3 @max-[800px]:whitespace-normal"
              >
                <span className="hidden @max-[800px]:inline">Contact: </span>
                <span className="break-all">
                  {client.contactNumber?.trim() || "Not provided"}
                </span>
              </div>
              <div
                role="cell"
                className="@max-[800px]:col-start-2 @max-[800px]:row-start-4 @max-[800px]:justify-self-end"
              >
                <Pill
                  className={
                    client.isActive
                      ? "bg-[#e5f4ed] text-[#116348]"
                      : "bg-[#e9edf2] text-[#52627a]"
                  }
                >
                  {client.isActive ? "Active" : "Inactive"}
                </Pill>
              </div>
              <div
                role="cell"
                className="min-w-0 truncate text-[#52627a] @max-[800px]:col-start-1 @max-[800px]:row-start-4 @max-[800px]:whitespace-normal"
              >
                <span className="hidden @max-[800px]:inline">Registered: </span>
                <time dateTime={client.createdAt}>
                  {registeredDate(client.createdAt)}
                </time>
              </div>
              <div
                role="cell"
                className="@max-[800px]:col-start-2 @max-[800px]:row-start-1 @max-[800px]:justify-self-end"
              >
                <ClientRowActions client={client} onView={onView} />
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}
