import { useMemo, useState } from "react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { useLocalTable, useTableSort } from "@/components/ui/use-local-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
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
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { DepartmentRowActions } from "./department-row-actions"

const tableRowKey = (item: Department) => item.id
const departmentGrid =
  "grid grid-cols-[minmax(160px,1.5fr)_minmax(130px,1.3fr)_minmax(65px,.55fr)_minmax(75px,.65fr)_minmax(70px,.6fr)_112px] items-center gap-3.5 @max-[820px]:grid-cols-[minmax(0,1fr)_auto]"

type SortKey = "name" | "teams" | "employees" | "services"

/** Names sort A–Z first; counts sort largest first. */
const defaultSortDirection = (key: SortKey): SortDirection =>
  key === "name" ? "asc" : "desc"

export function DepartmentTable({
  departments,
  loading,
  error,
  canManage,
  canDelete,
  onEdit,
  onManageMembers,
  onDelete,
  onRetry,
}: {
  departments: Department[]
  loading: boolean
  error: string
  canManage: boolean
  canDelete: boolean
  onEdit: (department: Department) => void
  onManageMembers: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRetry: () => void
}) {
  const [search, setSearch] = useState("")
  const sort = useTableSort<SortKey>("name", "asc", defaultSortDirection)
  const { sortKey, direction } = sort
  const [animateRows, setAnimateRows] = useState(true)
  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      departments
        .filter((department) =>
          [
            department.name,
            department.code,
            department.head?.fullName,
            department.head?.email,
          ].some((value) => value?.toLowerCase().includes(query)),
        )
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
            numeric: true,
          })
          const compared =
            sortKey === "teams"
              ? (a.teamCount ?? 0) - (b.teamCount ?? 0)
              : sortKey === "employees"
                ? a.memberCount - b.memberCount
                : sortKey === "services"
                  ? (a.serviceCount ?? 0) - (b.serviceCount ?? 0)
                  : byName
          return (direction === "asc" ? compared : -compared) || byName
        }),
    [departments, query, sortKey, direction],
  )
  // Search and sort changes return to the first page.
  const table = useLocalTable(filtered, {
    view: [query, sortKey, direction],
    loading,
  })
  function sortBy(key: SortKey) {
    setAnimateRows(true)
    sort.toggle(key)
  }

  return (
    <>
      <div className="flex items-center pb-4 max-[560px]:pb-3">
        <div className="flex min-w-0 gap-[10px] max-[1050px]:w-full max-[560px]:flex-col">
          <SearchField
            label="Search departments"
            placeholder="Search departments…"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setAnimateRows(true)
              setSearch(event.target.value)
            }}
          />
        </div>
      </div>

      <ResponsiveDataTable
        label="Departments and their staffing"
        aria-busy={loading}
      >
        <ResponsiveDataTableHeader
          className="@max-[820px]:sr-only"
          rowClassName={departmentGrid}
        >
          <span role="columnheader">
            <TableSortButton
              label="Department"
              direction={sort.directionFor("name")}
              onClick={() => sortBy("name")}
            />
          </span>
          <span role="columnheader">Head</span>
          <span role="columnheader">
            <TableSortButton
              label="Teams"
              direction={sort.directionFor("teams")}
              onClick={() => sortBy("teams")}
            />
          </span>
          <span role="columnheader">
            <TableSortButton
              label="Employees"
              direction={sort.directionFor("employees")}
              onClick={() => sortBy("employees")}
            />
          </span>
          <span role="columnheader">
            <TableSortButton
              label="Services"
              direction={sort.directionFor("services")}
              onClick={() => sortBy("services")}
            />
          </span>
          <span role="columnheader">Actions</span>
        </ResponsiveDataTableHeader>
        {loading || error ? (
          <ResponsiveDataTableBody className="relative overflow-x-clip">
            {loading ? (
              <DataTableSkeletonRows
                label="departments"
                rowClassName={cn(
                  departmentGrid,
                  "min-h-[58px] px-4 py-[7px] @max-[820px]:gap-x-4 @max-[820px]:gap-y-[10px] @max-[820px]:py-[14px]",
                )}
                cellClassNames={[
                  "@max-[820px]:col-start-1 @max-[820px]:row-start-1",
                  "@max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-2",
                  "@max-[820px]:col-start-1 @max-[820px]:row-start-3",
                  "@max-[820px]:col-start-2 @max-[820px]:row-start-3",
                  "@max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-4",
                  "@max-[820px]:col-start-2 @max-[820px]:row-start-1 @max-[820px]:justify-self-end",
                ]}
                cellSkeletonClassNames={[
                  "h-3 w-4/5",
                  "h-3 w-3/5",
                  "h-3 w-10",
                  "h-3 w-10",
                  "h-3 w-10",
                  "size-8",
                ]}
              />
            ) : (
              <DataTableErrorRow
                message={error}
                onRetry={onRetry}
                colSpan={6}
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
                departmentGrid,
                "min-h-[58px] border-b border-[#eceef1] px-4 py-[7px] text-xs text-foreground  hover:bg-[#e8eef2] @max-[820px]:gap-x-4 @max-[820px]:gap-y-[10px] @max-[820px]:py-[14px]",
                isLast && "rounded-b-[7px] border-b-0",
              )
            }
            emptyHeight={150}
            emptyContent={
              <>
                {query ? (
                  <SearchEmptyState query={query.trim()} />
                ) : (
                  "No departments created yet."
                )}
              </>
            }
            className="relative overflow-x-clip"
            onRowsSettled={table.onRowsSettled}
            renderRow={(department) => (
              <>
                <div
                  role="rowheader"
                  className="min-w-0 @max-[820px]:col-start-1 @max-[820px]:row-start-1"
                >
                  <span className="group relative inline-block max-w-full">
                    <button
                      type="button"
                      className={cn(
                        "max-w-full cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left font-semibold text-foreground hover:underline hover:underline-offset-4",
                        focusRing,
                      )}
                      onClick={() => onManageMembers(department.id)}
                    >
                      {department.name}
                    </button>
                  </span>
                  {department.code && (
                    <span className="mt-0.5 block truncate text-[11px] text-[#738096]">
                      {department.code}
                    </span>
                  )}
                </div>
                <div
                  role="cell"
                  className="min-w-0 break-words @max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-2"
                >
                  <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                    Head
                  </span>
                  {department.head ? (
                    department.head.fullName || department.head.email
                  ) : (
                    <span className="text-[#738096]">Unassigned</span>
                  )}
                </div>
                <div
                  role="cell"
                  className="tabular-nums @max-[820px]:col-start-1 @max-[820px]:row-start-3"
                >
                  <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                    Teams
                  </span>
                  {department.teamCount ?? 0}
                </div>
                <div
                  role="cell"
                  className="tabular-nums @max-[820px]:col-start-2 @max-[820px]:row-start-3"
                >
                  <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                    Employees
                  </span>
                  {department.memberCount}
                </div>
                <div
                  role="cell"
                  className="tabular-nums @max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-4"
                >
                  <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                    Services
                  </span>
                  {department.serviceCount ?? 0}
                </div>
                <div
                  role="cell"
                  className="@max-[820px]:col-start-2 @max-[820px]:row-start-1 @max-[820px]:justify-self-end"
                >
                  <DepartmentRowActions
                    department={department}
                    canManage={canManage}
                    canDelete={canDelete}
                    onEdit={onEdit}
                    onManageMembers={onManageMembers}
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
          label="Department pages"
          onPageChange={(nextPage) => {
            setAnimateRows(true)
            table.setPage(nextPage)
          }}
        />
      )}
    </>
  )
}
