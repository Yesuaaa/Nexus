import { useState } from "react"
import { SearchIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import {
  TableSortButton,
  type SortDirection,
} from "@/components/ui/table-sort-button"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { DepartmentRowActions } from "./department-row-actions"

const pageSize = 10
const paginationButton = `inline-flex min-h-[30px] cursor-pointer items-center justify-center rounded-lg border border-transparent bg-[#203f8c] px-3 text-[11px] font-medium leading-[1.2] whitespace-nowrap text-white transition-colors hover:enabled:bg-[#172f70] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`
const departmentGrid =
  "grid grid-cols-[minmax(160px,1.5fr)_minmax(130px,1.3fr)_minmax(65px,.55fr)_minmax(75px,.65fr)_minmax(70px,.6fr)_90px] items-center gap-3.5 @max-[820px]:grid-cols-[minmax(0,1fr)_auto]"

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
  const query = search.trim().toLowerCase()
  const filtered = departments
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
    })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  function sortBy(key: SortKey) {
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
          <label className="flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full max-[560px]:flex-none">
            <SearchIcon width="17" height="17" className="flex-none" />
            <span className="sr-only">Search departments</span>
            <input
              type="search"
              className="w-full min-w-0 border-0 bg-transparent text-foreground outline-none placeholder:text-[#8a9ab1]"
              placeholder="Search departments..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
      </div>

      <div
        className="@container min-w-0 rounded-lg border border-[#e8ebef] bg-background"
        role="table"
        aria-label="Departments and their staffing"
      >
        <div role="rowgroup" className="@max-[820px]:sr-only">
          <div
            role="row"
            className={cn(
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
          </div>
        </div>
        <div role="rowgroup" aria-live="polite">
          {loading || error || filtered.length === 0 ? (
            <div role="row">
              <div
                role="cell"
                aria-colspan={6}
                className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-xs text-[#7183a2]"
              >
                {loading ? (
                  <span role="status">Loading departments...</span>
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
                ) : query ? (
                  "No departments matched your search."
                ) : (
                  "No departments created yet."
                )}
              </div>
            </div>
          ) : (
            visible.map((department) => (
              <div
                role="row"
                key={department.id}
                className={cn(
                  departmentGrid,
                  "min-h-[58px] border-b border-[#eceef1] px-4 py-[7px] text-xs text-foreground last:rounded-b-[7px] last:border-b-0 hover:bg-[#e8eef2] @max-[820px]:gap-x-4 @max-[820px]:gap-y-[10px] @max-[820px]:py-[14px]",
                )}
              >
                <div
                  role="rowheader"
                  className="min-w-0 @max-[820px]:col-start-1 @max-[820px]:row-start-1"
                >
                  <button
                    type="button"
                    className={cn(
                      "max-w-full cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline hover:underline-offset-4",
                      focusRing,
                    )}
                    title={department.description || undefined}
                    onClick={() => onManageMembers(department.id)}
                  >
                    {department.name}
                  </button>
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
                  className="@max-[820px]:col-start-2 @max-[820px]:row-start-1"
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
              </div>
            ))
          )}
        </div>
      </div>

      {!loading && !error && (
        <footer className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap max-[560px]:pt-[14px]">
          <span role="status" aria-live="polite" aria-atomic="true">
            Showing{" "}
            {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </span>
          {filtered.length > 0 && (
            <nav
              className="flex items-center gap-2"
              aria-label="Department pages"
            >
              <button
                type="button"
                className={paginationButton}
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ← Back
              </button>
              <span
                className="px-[3px] whitespace-nowrap text-foreground"
                aria-current="page"
                aria-label={`Page ${currentPage} of ${totalPages}`}
              >
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={paginationButton}
                aria-label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </footer>
      )}
    </>
  )
}
