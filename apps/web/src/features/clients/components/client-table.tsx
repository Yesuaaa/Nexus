import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
import { useExclusiveMenu } from "@/components/ui/dropdown"
import { Eye, MoreHorizontal, Pencil } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
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
  onEdit,
  onDelete,
}: {
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  client: Client
  onView: (client: Client) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingDelete = useRef(false)
  const closedByOther = useRef(false)
  const label = client.fullName?.trim() || client.email
  const actionLabel = `View details for ${label}`

  // Close this menu whenever any other menu opens.
  useExclusiveMenu(open, () => {
    closedByOther.current = true
    setOpen(false)
  })

  return (
    <div className="flex items-center gap-1">
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
        <Eye size={16} aria-hidden="true" />
        <HoverTooltip>View details</HoverTooltip>
      </button>
      <button
        type="button"
        className={cn(
          rowActionButton,
          "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:border-[#172f70] hover:enabled:bg-[#172f70] hover:enabled:text-white max-[560px]:size-11",
        )}
        aria-label={`Edit ${label}`}
        onClick={() => onEdit(client)}
      >
        <Pencil size={16} aria-hidden="true" />
        <HoverTooltip>Edit client</HoverTooltip>
      </button>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (next) {
            pendingDelete.current = false
            closedByOther.current = false
          }
          setOpen(next)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={cn(rowActionButton, "max-[560px]:size-11")}
            aria-label={`More actions for ${label}`}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            <HoverTooltip>More actions</HoverTooltip>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          collisionPadding={24}
          className={cn(dropdownMenuClass, "w-48 text-xs")}
          onCloseAutoFocus={(event) => {
            // Another menu took over: don't pull focus back to this trigger.
            if (closedByOther.current) {
              closedByOther.current = false
              event.preventDefault()
              return
            }
            if (!pendingDelete.current) return
            event.preventDefault()
            pendingDelete.current = false
            triggerRef.current?.focus()
            onDelete(client)
          }}
        >
          <DropdownMenuItem
            className={cn(
              dropdownItemClass,
              "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]",
            )}
            onSelect={() => {
              pendingDelete.current = true
            }}
          >
            Delete client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
  animateRows,
  loading,
  error,
  emptyMessage,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  onView,
  onEdit,
  onDelete,
}: {
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
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
      <div role="rowgroup" className="@max-[1000px]:sr-only">
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
          <span role="columnheader">Actions</span>
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
                className="min-w-0 @max-[1000px]:col-start-1 @max-[1000px]:row-start-1"
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
                className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-span-2 @max-[1000px]:row-start-2 @max-[1000px]:break-all @max-[1000px]:whitespace-normal"
              >
                {client.email}
              </div>
              <div
                role="cell"
                className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-span-2 @max-[1000px]:row-start-3 @max-[1000px]:whitespace-normal"
              >
                <span className="hidden @max-[1000px]:inline">Contact: </span>
                <span className="break-all">
                  {client.contactNumber?.trim() || "Not provided"}
                </span>
              </div>
              <div
                role="cell"
                className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end"
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
                className="min-w-0 truncate text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-4 @max-[1000px]:whitespace-normal"
              >
                <span className="hidden @max-[1000px]:inline">
                  Registered:{" "}
                </span>
                <time dateTime={client.createdAt}>
                  {registeredDate(client.createdAt)}
                </time>
              </div>
              <div
                role="cell"
                className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end"
              >
                <ClientRowActions
                  client={client}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}
