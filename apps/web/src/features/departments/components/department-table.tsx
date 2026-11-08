import { useMemo, useState } from "react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { useTableFooter } from "@/components/ui/use-table-search"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import {
  TableSortButton,
  type SortDirection,
} from "@/components/ui/table-sort-button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { DepartmentRowActions } from "./department-row-actions"

const tableRowKey = (item: Department) => item.id
const pageSize = 10
const departmentGrid =
  "grid grid-cols-[minmax(160px,1.5fr)_minmax(130px,1.3fr)_minmax(65px,.55fr)_minmax(75px,.65fr)_minmax(70px,.6fr)_112px] items-center gap-3.5 @max-[820px]:grid-cols-[minmax(0,1fr)_auto]"

type SortKey = "name" | "teams" | "employees" | "services"

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
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [direction, setDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(1)
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage],
  )
  const tableResult = useMemo(
    () => ({
      page: currentPage,
      total: filtered.length,
      view: [query, sortKey, direction],
    }),
    [currentPage, filtered.length, query, sortKey, direction],
  )
  const { footer, onRowsSettled } = useTableFooter(tableResult, loading)
  const viewKey = JSON.stringify([query, sortKey, direction, currentPage])
  function sortBy(key: SortKey) {
    setAnimateRows(true)
    if (sortKey === key) {
      setDirection((value) => (value === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setDirection(key === "name" ? "asc" : "desc")
    }
    setPage(1)
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
              setPage(1)
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
          rowClassName={cn(
            departmentGrid,
            "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground",
          )}
        >
          <span role="columnheader">
            <TableSortButton
              label="Department"
              direction={sortKey === "name" ? direction : null}
              onClick={() => sortBy("name")}
            />
          </span>
          <span role="columnheader">Head</span>
          <span role="columnheader">
            <TableSortButton
              label="Teams"
              direction={sortKey === "teams" ? direction : null}
              onClick={() => sortBy("teams")}
            />
          </span>
          <span role="columnheader">
            <TableSortButton
              label="Employees"
              direction={sortKey === "employees" ? direction : null}
              onClick={() => sortBy("employees")}
            />
          </span>
          <span role="columnheader">
            <TableSortButton
              label="Services"
              direction={sortKey === "services" ? direction : null}
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
              <div role="row">
                <div
                  role="cell"
                  aria-colspan={6}
                  className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-xs text-[#7183a2]"
                >
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
                </div>
              </div>
            )}
          </ResponsiveDataTableBody>
        ) : (
          <AnimatedSlotGridBody
            items={visible}
            viewKey={viewKey}
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
            onRowsSettled={onRowsSettled}
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
                    {department.description && (
                      <HoverTooltip
                        align="start"
                        className="max-w-64 whitespace-normal text-left leading-4"
                      >
                        {department.description}
                      </HoverTooltip>
                    )}
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
        <footer className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap max-[560px]:pt-[14px]">
          <span role="status" aria-live="polite" aria-atomic="true">
            Showing {footer.total === 0 ? 0 : (footer.page - 1) * pageSize + 1}–
            {Math.min(footer.page * pageSize, footer.total)} of {footer.total}
          </span>
          {footer.total > 0 && (
            <NumberedPagination
              page={footer.page}
              totalPages={Math.max(1, Math.ceil(footer.total / pageSize))}
              disabled={loading || footer !== tableResult}
              label="Department pages"
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
