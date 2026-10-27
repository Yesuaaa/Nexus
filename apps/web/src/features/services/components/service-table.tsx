import { useEffect, useMemo, useRef, useState } from "react"
import { Eye, MoreHorizontal, Pencil } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { SearchIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { AnimatedGridRow } from "@/components/ui/animated-data-row"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { Dropdown } from "@/components/ui/dropdown"
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
import { Pill } from "@/components/ui/pill"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  TableSortButton,
  type SortDirection,
} from "@/components/ui/table-sort-button"
import type { Department } from "@/features/departments/api/departments-api"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"

type SortKey = "name" | "status" | "createdAt"

const pageSize = 10
const serviceGrid =
  "grid grid-cols-[minmax(180px,1.25fr)_minmax(220px,1.6fr)_minmax(120px,.8fr)_90px_125px_112px] items-center gap-3.5 @max-[920px]:grid-cols-[minmax(0,1fr)_auto]"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function DepartmentPills({ service }: { service: Service }) {
  const visibleDepartments = service.departments.slice(0, 2)
  const remainingDepartments = service.departments.slice(2)
  const remainingCount = remainingDepartments.length

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {visibleDepartments.map((department) => (
        <DepartmentPill key={department.id} department={department} />
      ))}
      {remainingCount > 0 && (
        <Pill
          className="shrink-0 bg-[#e8eef9] font-semibold text-[#244993]"
          title={remainingDepartments
            .map((department) => department.name)
            .join(", ")}
          aria-label={`${remainingCount} more departments: ${remainingDepartments
            .map((department) => department.name)
            .join(", ")}`}
        >
          +{remainingCount}
        </Pill>
      )}
    </span>
  )
}

function ServiceActions({
  service,
  canManage,
  onView,
  onEdit,
  onStatus,
  onDelete,
}: {
  service: Service
  canManage: boolean
  onView: (service: Service) => void
  onEdit: (service: Service) => void
  onStatus: (service: Service) => void
  onDelete: (service: Service) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingAction = useRef<"status" | "delete" | null>(null)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={rowActionButton}
        aria-label={`View ${service.name}`}
        onClick={() => onView(service)}
      >
        <Eye size={15} aria-hidden="true" />
        <HoverTooltip>View details</HoverTooltip>
      </button>
      {canManage && (
        <button
          type="button"
          className={cn(
            rowActionButton,
            "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
          )}
          aria-label={`Edit ${service.name}`}
          onClick={() => onEdit(service)}
        >
          <Pencil size={14} aria-hidden="true" />
          <HoverTooltip>Edit service</HoverTooltip>
        </button>
      )}
      {canManage && (
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) pendingAction.current = null
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className={rowActionButton}
              aria-label={`More actions for ${service.name}`}
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
              const action = pendingAction.current
              if (!action) return
              event.preventDefault()
              pendingAction.current = null
              triggerRef.current?.focus()
              if (action === "status") onStatus(service)
              else onDelete(service)
            }}
          >
            <DropdownMenuItem
              className={cn(
                dropdownItemClass,
                service.isActive
                  ? "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]"
                  : "text-[#247044] focus:bg-[#edf8f1] focus:text-[#247044]",
              )}
              onSelect={() => {
                pendingAction.current = "status"
              }}
            >
              {service.isActive ? "Deactivate service" : "Activate service"}
            </DropdownMenuItem>
            {!service.isActive && (
              <DropdownMenuItem
                className={cn(
                  dropdownItemClass,
                  "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]",
                )}
                onSelect={() => {
                  pendingAction.current = "delete"
                }}
              >
                Delete service
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function ServiceTable({
  services,
  departments,
  loading,
  error,
  canManage,
  onView,
  onEdit,
  onStatus,
  onDelete,
  onRetry,
}: {
  services: Service[]
  departments: Department[]
  loading: boolean
  error: string
  canManage: boolean
  onView: (service: Service) => void
  onEdit: (service: Service) => void
  onStatus: (service: Service) => void
  onDelete: (service: Service) => void
  onRetry: () => void
}) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [status, setStatus] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [direction, setDirection] = useState<SortDirection>("desc")
  const [page, setPage] = useState(1)
  const [animateRows, setAnimateRows] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [search])

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLocaleLowerCase()
    return services
      .filter(
        (service) =>
          (!query ||
            service.name.toLocaleLowerCase().includes(query) ||
            service.description.toLocaleLowerCase().includes(query) ||
            service.departments.some((department) =>
              department.name.toLocaleLowerCase().includes(query),
            )) &&
          (!departmentId ||
            service.departments.some(
              (department) => department.id === departmentId,
            )) &&
          (!status ||
            (status === "active" ? service.isActive : !service.isActive)),
      )
      .sort((left, right) => {
        const values: Record<SortKey, [string | number, string | number]> = {
          name: [left.name, right.name],
          status: [Number(left.isActive), Number(right.isActive)],
          createdAt: [Date.parse(left.createdAt), Date.parse(right.createdAt)],
        }
        const [a, b] = values[sortKey]
        const compared =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b))
        return direction === "asc" ? compared : -compared
      })
  }, [departmentId, debouncedSearch, direction, services, sortKey, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const viewKey = JSON.stringify([
    debouncedSearch,
    departmentId,
    status,
    sortKey,
    direction,
    currentPage,
  ])
  function sortBy(key: SortKey) {
    setAnimateRows(true)
    if (sortKey === key)
      setDirection((value) => (value === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setDirection(key === "createdAt" ? "desc" : "asc")
    }
    setPage(1)
  }

  const filteredState = Boolean(debouncedSearch || departmentId || status)

  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-4 max-[920px]:items-stretch max-[920px]:flex-col max-[560px]:pb-3">
        <label className="flex h-[34px] w-[min(380px,100%)] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[920px]:w-full">
          <SearchIcon width="17" height="17" className="flex-none" />
          <span className="sr-only">Search services</span>
          <input
            type="search"
            className="w-full min-w-0 border-0 bg-transparent text-foreground outline-none placeholder:text-[#8a9ab1]"
            placeholder="Search services..."
            value={search}
            maxLength={100}
            onChange={(event) => {
              setAnimateRows(true)
              setSearch(event.target.value)
            }}
          />
        </label>
        <div className="flex min-w-0 gap-2 max-[560px]:flex-col">
          <Dropdown
            className="w-[180px] max-[560px]:w-full"
            triggerClassName="h-[34px] border-[#e1e4ea]"
            label="Filter by department"
            value={departmentId}
            options={[
              { value: "", label: "All departments" },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
            onChange={(value) => {
              setAnimateRows(true)
              setDepartmentId(value)
              setPage(1)
            }}
          />
          <Dropdown
            className="w-[140px] max-[560px]:w-full"
            triggerClassName="h-[34px] border-[#e1e4ea]"
            label="Filter by status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            onChange={(value) => {
              setAnimateRows(true)
              setStatus(value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <div
        className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background"
        role="table"
        aria-label="Services"
      >
        <div role="rowgroup" className="@max-[920px]:sr-only">
          <div
            role="row"
            className={cn(
              serviceGrid,
              "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold",
            )}
          >
            <span role="columnheader">
              <TableSortButton
                label="Service Name"
                direction={sortKey === "name" ? direction : null}
                onClick={() => sortBy("name")}
              />
            </span>
            <span role="columnheader">Description</span>
            <span role="columnheader">Departments</span>
            <span role="columnheader">
              <TableSortButton
                label="Status"
                direction={sortKey === "status" ? direction : null}
                onClick={() => sortBy("status")}
              />
            </span>
            <span role="columnheader">
              <TableSortButton
                label="Date Created"
                direction={sortKey === "createdAt" ? direction : null}
                onClick={() => sortBy("createdAt")}
              />
            </span>
            <span role="columnheader">Actions</span>
          </div>
        </div>
        <div
          role="rowgroup"
          aria-live="polite"
          className="relative overflow-x-clip"
        >
          {loading || error ? (
            <div role="row">
              <div
                role="cell"
                aria-colspan={6}
                className="grid min-h-[170px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]"
              >
                {loading ? (
                  <span role="status">Loading services...</span>
                ) : error ? (
                  <div role="alert" className="grid justify-items-center gap-3">
                    <p className="m-0">{error}</p>
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer border-0 bg-transparent font-bold text-[#244993]",
                        focusRing,
                      )}
                      onClick={onRetry}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <AnimatePresence
              custom={animateRows}
              initial={false}
              mode={animateRows ? "popLayout" : "sync"}
            >
              {visible.length === 0 ? (
                <AnimatedGridRow
                  key={`empty-${viewKey}`}
                  animateRows={animateRows}
                  className="grid min-h-[170px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]"
                >
                  <div role="cell" aria-colspan={6}>
                    {debouncedSearch.trim() ? (
                      <SearchEmptyState query={debouncedSearch.trim()} />
                    ) : filteredState ? (
                      "No services match the selected filters."
                    ) : (
                      "No services have been created yet."
                    )}
                  </div>
                </AnimatedGridRow>
              ) : (
                visible.map((service) => (
                  <AnimatedGridRow
                    key={`${viewKey}:${service.id}`}
                    animateRows={animateRows}
                    className={cn(
                      serviceGrid,
                      "min-h-[58px] border-b border-[#eceef1] px-4 py-[8px] text-xs last:rounded-b-[7px] last:border-b-0 hover:bg-[#f3f6f8] @max-[920px]:gap-x-4 @max-[920px]:gap-y-2 @max-[920px]:py-3.5",
                    )}
                  >
                    <button
                      type="button"
                      role="rowheader"
                      className={cn(
                        "min-w-0 cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left font-semibold hover:underline hover:underline-offset-4 @max-[920px]:col-start-1 @max-[920px]:row-start-1",
                        focusRing,
                      )}
                      onClick={() => onView(service)}
                    >
                      {service.name}
                    </button>
                    <div
                      role="cell"
                      className="min-w-0 truncate text-[#526686] @max-[920px]:col-span-2 @max-[920px]:row-start-2 @max-[920px]:whitespace-normal"
                    >
                      {service.description}
                    </div>
                    <div
                      role="cell"
                      className="min-w-0 @max-[920px]:col-start-1 @max-[920px]:row-start-3"
                    >
                      <span className="mr-1.5 hidden text-[#738096] @max-[920px]:inline">
                        Departments
                      </span>
                      <DepartmentPills service={service} />
                    </div>
                    <div
                      role="cell"
                      className="@max-[920px]:col-start-2 @max-[920px]:row-start-3 @max-[920px]:justify-self-end"
                    >
                      <Pill
                        className={
                          service.isActive
                            ? "bg-[#dcf5e5] text-[#19703a]"
                            : "bg-[#fde4ea] text-[#b4234d]"
                        }
                      >
                        {service.isActive ? "Active" : "Inactive"}
                      </Pill>
                    </div>
                    <div
                      role="cell"
                      className="text-[#526686] tabular-nums @max-[920px]:col-start-1 @max-[920px]:row-start-4"
                    >
                      <span className="mr-1.5 hidden text-[#738096] @max-[920px]:inline">
                        Created
                      </span>
                      {formatDate(service.createdAt)}
                    </div>
                    <div
                      role="cell"
                      className="@max-[920px]:col-start-2 @max-[920px]:row-start-1 @max-[920px]:justify-self-end"
                    >
                      <ServiceActions
                        service={service}
                        canManage={canManage}
                        onView={onView}
                        onEdit={onEdit}
                        onStatus={onStatus}
                        onDelete={onDelete}
                      />
                    </div>
                  </AnimatedGridRow>
                ))
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {!loading && !error && (
        <footer className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap">
          <span role="status" aria-live="polite">
            Showing{" "}
            {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of{" "}
            {filtered.length} services
          </span>
          {filtered.length > 0 && (
            <NumberedPagination
              page={currentPage}
              totalPages={totalPages}
              disabled={loading}
              label="Service pages"
              onPageChange={(nextPage) => {
                setAnimateRows(true)
                setPage(nextPage)
              }}
            />
          )}
        </footer>
      )}
    </>
  )
}
