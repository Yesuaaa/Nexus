import { TableSortButton } from "@/components/ui/table-sort-button"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Client, ClientSort } from "../api/clients-api"

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
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
      <HoverTooltip className="right-0 left-auto translate-x-0 group-hover:translate-x-0 group-focus-visible:translate-x-0 group-focus-within:translate-x-0">
        View details
      </HoverTooltip>
    </button>
  )
}

export function ClientTable({
  clients,
  sortBy,
  sortOrder,
  onSort,
  onView,
}: {
  clients: Client[]
  sortBy: ClientSort
  sortOrder: "asc" | "desc"
  onSort: (key: ClientSort) => void
  onView: (client: Client) => void
}) {
  function heading(key: ClientSort) {
    return (
      <TableHead
        className="[&_button]:min-h-10 [&_button]:text-left [&_svg]:shrink-0"
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
      </TableHead>
    )
  }
  return (
    <div className="@container min-w-0 overflow-hidden rounded-lg border border-[#e8ebef]">
      <Table
        aria-label="Clients"
        className="w-full table-fixed @max-[800px]:block"
      >
        <TableHeader className="bg-[#e8eef2] @max-[800px]:hidden">
          <TableRow className="hover:bg-transparent">
            {heading("fullName")}
            {heading("email")}
            <TableHead>Contact number</TableHead>
            {heading("isActive")}
            {heading("createdAt")}
            <TableHead className="w-[72px]">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="@max-[800px]:block">
          {clients.map((client) => (
            <TableRow
              key={client.id}
              className="text-xs @max-[800px]:grid @max-[800px]:grid-cols-[minmax(0,1fr)_auto] @max-[800px]:gap-x-3 @max-[800px]:gap-y-1.5 @max-[800px]:px-4 @max-[800px]:py-3"
            >
              <TableCell className="px-4 py-2.5 @max-[800px]:col-start-1 @max-[800px]:row-start-1 @max-[800px]:p-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] font-medium text-[#52627a]"
                  >
                    {(client.fullName?.trim() || client.email)[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 break-words font-semibold">
                    {client.fullName?.trim() || "Name not provided"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="break-all px-4 py-2.5 text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-2 @max-[800px]:p-0">
                {client.email}
              </TableCell>
              <TableCell className="px-4 py-2.5 text-[#52627a] @max-[800px]:col-span-2 @max-[800px]:row-start-3 @max-[800px]:p-0">
                <span className="hidden @max-[800px]:inline">Contact: </span>
                <span className="break-all">
                  {client.contactNumber?.trim() || "Not provided"}
                </span>
              </TableCell>
              <TableCell className="px-4 py-2.5 @max-[800px]:col-start-2 @max-[800px]:row-start-1 @max-[800px]:p-0">
                <Pill
                  className={
                    client.isActive
                      ? "bg-[#e5f4ed] text-[#116348]"
                      : "bg-[#e9edf2] text-[#52627a]"
                  }
                >
                  {client.isActive ? "Active" : "Inactive"}
                </Pill>
              </TableCell>
              <TableCell className="px-4 py-2.5 text-[#52627a] @max-[800px]:whitespace-normal @max-[800px]:col-start-1 @max-[800px]:row-start-4 @max-[800px]:self-center @max-[800px]:p-0">
                <span className="hidden @max-[800px]:inline">Registered: </span>
                <time dateTime={client.createdAt}>
                  {registeredDate(client.createdAt)}
                </time>
              </TableCell>
              <TableCell className="px-4 py-2.5 @max-[800px]:col-start-2 @max-[800px]:row-start-4 @max-[800px]:p-0">
                <ClientRowActions client={client} onView={onView} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
