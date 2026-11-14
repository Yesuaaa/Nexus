import Image from "next/image"
import { useMemo, useState } from "react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import { Dropdown } from "@/components/ui/dropdown"
import { filterGridClass } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { useLocalTable, useTableSort } from "@/components/ui/use-local-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import {
  TableSortButton,
  type SortDirection,
} from "@/components/ui/table-sort-button"
import type { Department } from "@/features/departments/api/departments-api"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"
import { ServiceRowActions } from "./service-row-actions"

type SortKey = "name" | "status" | "createdAt"

const tableRowKey = (item: Service) => item.id
const defaultSortDirection = (key: SortKey): SortDirection =>
  key === "createdAt" ? "desc" : "asc"
const serviceGrid =
  "grid grid-cols-[minmax(180px,1.25fr)_minmax(220px,1.6fr)_minmax(120px,.8fr)_90px_125px_56px] items-center gap-3.5 @max-[920px]:grid-cols-[minmax(0,1fr)_auto]"

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
          tone="info"
          className="shrink-0 font-semibold"
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
  const query = search
  const [departmentId, setDepartmentId] = useState("")
  const [status, setStatus] = useState("")
  const sort = useTableSort<SortKey>("createdAt", "desc", defaultSortDirection)
  const { sortKey, direction } = sort
  const [animateRows, setAnimateRows] = useState(true)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return services
      .filter(
        (service) =>
          (!needle ||
            service.name.toLocaleLowerCase().includes(needle) ||
            service.description.toLocaleLowerCase().includes(needle) ||
            service.departments.some((department) =>
              department.name.toLocaleLowerCase().includes(needle),
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
  }, [departmentId, query, direction, services, sortKey, status])

  const table = useLocalTable(filtered, {
    view: [query, departmentId, status, sortKey, direction],
    loading,
  })
  function sortBy(key: SortKey) {
    setAnimateRows(true)
    sort.toggle(key)
  }

  const filteredState = Boolean(query || departmentId || status)

  return (
    <>
      <div className="flex flex-wrap items-start gap-[10px] pb-4 max-[560px]:flex-col max-[560px]:pb-3">
        <SearchField
          label="Search services"
          containerClassName="flex-none max-[560px]:w-full"
          placeholder="Search services…"
          value={search}
          maxLength={100}
          onChange={(event) => {
            setAnimateRows(true)
            setSearch(event.target.value)
          }}
        />
        <div className={`${filterGridClass} min-w-0 max-[560px]:w-full`}>
          <Dropdown
            className="w-[170px] max-[560px]:w-full"
            triggerClassName="h-[34px] rounded-md border-[#e1e4ea] bg-transparent text-xs font-normal shadow-sm"
            label="Filter by department"
            value={departmentId}
            options={[
              { value: "", label: "All Departments" },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
            onChange={(value) => {
              setAnimateRows(true)
              setDepartmentId(value)
            }}
          />
          <Dropdown
            className="w-[140px] max-[560px]:w-full"
            triggerClassName="h-[34px] rounded-md border-[#e1e4ea] bg-transparent text-xs font-normal shadow-sm"
            label="Filter by status"
            value={status}
            options={[
              { value: "", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            onChange={(value) => {
              setAnimateRows(true)
              setStatus(value)
            }}
          />
        </div>
      </div>

      <ResponsiveDataTable label="Services">
        <ResponsiveDataTableHeader
          className="@max-[920px]:sr-only"
          rowClassName={serviceGrid}
        >
          <span role="columnheader">
            <TableSortButton
              label="Service Name"
              direction={sort.directionFor("name")}
              onClick={() => sortBy("name")}
            />
          </span>
          <span role="columnheader">Description</span>
          <span role="columnheader">Departments</span>
          <span role="columnheader">
            <TableSortButton
              label="Status"
              direction={sort.directionFor("status")}
              onClick={() => sortBy("status")}
            />
          </span>
          <span role="columnheader">
            <TableSortButton
              label="Date Created"
              direction={sort.directionFor("createdAt")}
              onClick={() => sortBy("createdAt")}
            />
          </span>
          <span role="columnheader">Actions</span>
        </ResponsiveDataTableHeader>
        {loading || error ? (
          <ResponsiveDataTableBody className="relative overflow-x-clip">
            {loading ? (
              <DataTableSkeletonRows
                label="services"
                rowClassName={cn(
                  serviceGrid,
                  "min-h-[58px] px-4 py-[8px] @max-[920px]:gap-x-4 @max-[920px]:gap-y-2 @max-[920px]:py-3.5",
                )}
                cellClassNames={[
                  "@max-[920px]:col-start-1 @max-[920px]:row-start-1",
                  "@max-[920px]:col-span-2 @max-[920px]:row-start-2",
                  "@max-[920px]:col-start-1 @max-[920px]:row-start-3",
                  "@max-[920px]:col-start-2 @max-[920px]:row-start-3 @max-[920px]:justify-self-end",
                  "@max-[920px]:col-start-1 @max-[920px]:row-start-4",
                  "@max-[920px]:col-start-2 @max-[920px]:row-start-1 @max-[920px]:justify-self-end",
                ]}
                cellSkeletonClassNames={[
                  "h-8 w-4/5",
                  "h-3 w-4/5",
                  "h-5 w-28 rounded",
                  "h-5 w-14 rounded",
                  "h-3 w-20",
                  "size-8 rounded-[7px]",
                ]}
              />
            ) : (
              <DataTableErrorRow
                message={error}
                onRetry={onRetry}
                colSpan={6}
                className="min-h-[170px]"
              />
            )}
          </ResponsiveDataTableBody>
        ) : (
          <AnimatedSlotGridBody
            items={table.visible}
            viewKey={table.viewKey}
            quickKey={query}
            animateRows={animateRows}
            getKey={tableRowKey}
            rowClassName={(_item, _index, isLast) =>
              cn(
                serviceGrid,
                "min-h-[58px] border-b border-[#eceef1] px-4 py-[8px] text-xs  hover:bg-[#f3f6f8] @max-[920px]:gap-x-4 @max-[920px]:gap-y-2 @max-[920px]:py-3.5",
                isLast && "rounded-b-[7px] border-b-0",
              )
            }
            emptyHeight={170}
            emptyContent={
              <>
                {query.trim() ? (
                  <SearchEmptyState query={query.trim()} />
                ) : filteredState ? (
                  "No services match the selected filters."
                ) : (
                  "No services have been created yet."
                )}
              </>
            }
            className="relative overflow-x-clip"
            onRowsSettled={table.onRowsSettled}
            renderRow={(service) => (
              <>
                <div
                  role="rowheader"
                  className="min-w-0 @max-[920px]:col-start-1 @max-[920px]:row-start-1"
                >
                  <button
                    type="button"
                    className={cn(
                      "flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-left font-semibold text-foreground hover:underline hover:underline-offset-4",
                      focusRing,
                    )}
                    onClick={() => onView(service)}
                  >
                    <span className="relative size-8 flex-none overflow-hidden rounded-md bg-[#e8eef7]">
                      {service.imageUrl ? (
                        <Image
                          src={service.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="truncate">{service.name}</span>
                  </button>
                </div>
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
                  <Pill tone={service.isActive ? "success" : "danger"}>
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
                  <ServiceRowActions
                    service={service}
                    canManage={canManage}
                    onView={onView}
                    onEdit={onEdit}
                    onStatus={onStatus}
                    onDelete={onDelete}
                  />
                </div>
              </>
            )}
          />
        )}
      </ResponsiveDataTable>

      {!loading && !error && (
        <TablePaginationFooter
          {...table.footer}
          itemLabel="services"
          label="Service pages"
          onPageChange={(nextPage) => {
            setAnimateRows(true)
            table.setPage(nextPage)
          }}
        />
      )}
    </>
  )
}
