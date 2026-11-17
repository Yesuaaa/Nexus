import { Eye } from "lucide-react"
import type { ReactNode } from "react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Avatar } from "@/components/ui/avatar"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { TableSortButton } from "@/components/ui/table-sort-button"
import { cn } from "@/lib/utils"
import type { Client, ClientSort } from "../api/clients-api"

const clientGrid =
  "grid grid-cols-[minmax(180px,1.3fr)_minmax(190px,1.35fr)_minmax(130px,.9fr)_minmax(105px,.7fr)_minmax(110px,.8fr)_120px] items-center gap-3.5 @max-[1000px]:grid-cols-[minmax(0,1fr)_auto]"

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
  const actionLabel = `View ${label}`

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={`client-view-${client.id}`}
        className={rowActionButton}
        aria-label={actionLabel}
        onClick={() => onView(client)}
      >
        <Eye size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

function clientKey(client: Client) {
  return client.id
}

function clientRowClass(_client: Client, _index: number, isLast: boolean) {
  return cn(
    clientGrid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[1000px]:h-[154px] @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-1.5 @max-[1000px]:py-3",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

export function ClientTable({
  clients,
  viewKey,
  quickKey,
  onRowsSettled,
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
  onRowsSettled?: () => void
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
  const initialLoading = loading && viewKey === ""

  function heading(key: ClientSort) {
    return (
      <ResponsiveDataTableColumnHeader
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
      </ResponsiveDataTableColumnHeader>
    )
  }

  return (
    <ResponsiveDataTable label="Clients" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[1000px]:sr-only"
        rowClassName={clientGrid}
      >
        {heading("fullName")}
        {heading("email")}
        <ResponsiveDataTableColumnHeader>
          Contact number
        </ResponsiveDataTableColumnHeader>
        {heading("isActive")}
        {heading("createdAt")}
        <ResponsiveDataTableColumnHeader>
          Actions
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>

      {initialLoading || error ? (
        <ResponsiveDataTableBody>
          {initialLoading ? (
            <DataTableSkeletonRows
              label="clients"
              rowClassName={cn(
                clientGrid,
                "h-[58px] px-4 py-[7px] @max-[1000px]:h-[154px] @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-1.5 @max-[1000px]:py-3",
              )}
              cellClassNames={[
                "@max-[1000px]:col-start-1 @max-[1000px]:row-start-1",
                "@max-[1000px]:col-span-2 @max-[1000px]:row-start-2",
                "@max-[1000px]:col-span-2 @max-[1000px]:row-start-3",
                "@max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end",
                "@max-[1000px]:col-start-1 @max-[1000px]:row-start-4",
                "@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end",
              ]}
              cellSkeletonClassNames={[
                "size-8 rounded-full",
                "h-3 w-4/5",
                "h-3 w-3/5",
                "h-5 w-14 rounded",
                "h-3 w-20",
                "size-8",
              ]}
            />
          ) : (
            <DataTableErrorRow message={error} onRetry={onRetry} colSpan={6} />
          )}
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={clients}
          viewKey={viewKey}
          quickKey={quickKey}
          onRowsSettled={onRowsSettled}
          animateRows={animateRows}
          getKey={clientKey}
          rowClassName={clientRowClass}
          emptyContent={emptyMessage}
          ariaBusy={loading}
          className="relative min-w-0 overflow-x-clip"
          renderRow={(client) => (
            <>
              <ResponsiveDataTableCell className="min-w-0 @max-[1000px]:col-start-1 @max-[1000px]:row-start-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    name={client.fullName?.trim() || client.email}
                    className="size-8"
                  />
                  <span className="min-w-0 truncate font-semibold">
                    {client.fullName?.trim() || "Name not provided"}
                  </span>
                </div>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-span-2 @max-[1000px]:row-start-2 @max-[1000px]:break-all @max-[1000px]:whitespace-normal">
                {client.email}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-span-2 @max-[1000px]:row-start-3 @max-[1000px]:whitespace-normal">
                <span className="hidden @max-[1000px]:inline">Contact: </span>
                <span className="break-all">
                  {client.contactNumber?.trim() || "Not provided"}
                </span>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end">
                <Pill tone={client.isActive ? "success" : "danger"}>
                  {client.isActive ? "Active" : "Inactive"}
                </Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-4 @max-[1000px]:whitespace-normal">
                <span className="hidden @max-[1000px]:inline">
                  Registered:{" "}
                </span>
                <time dateTime={client.createdAt}>
                  {registeredDate(client.createdAt)}
                </time>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end">
                <ClientRowActions client={client} onView={onView} />
              </ResponsiveDataTableCell>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
