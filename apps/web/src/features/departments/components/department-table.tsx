import { useEffect, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { SearchIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { AnimatedGridRow } from "@/components/ui/animated-data-row"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import {
  TableSortButton,
  type SortDirection,
} from "@/components/ui/table-sort-button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { DepartmentRowActions } from "./department-row-actions"

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
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [direction, setDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(1)
  const [animateRows, setAnimateRows] = useState(true)
  const query = debouncedSearch.trim().toLowerCase()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [search])
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
          <label className="flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full max-[560px]:flex-none">
            <SearchIcon width="17" height="17" className="flex-none" />
            <span className="sr-only">Search departments</span>
            <input
              type="search"
              className="w-full min-w-0 border-0 bg-transparent text-foreground outline-none placeholder:text-[#8a9ab1]"
              placeholder="Search departments..."
              value={search}
              onChange={(event) => {
                setAnimateRows(true)
                setSearch(event.target.value)
              }}
            />
          </label>
        </div>
      </div>

      <div
        className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background"
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
                  className="grid min-h-[150px] place-content-center p-6 text-center text-xs text-[#7183a2]"
                >
                  <div role="cell" aria-colspan={6}>
                    {query ? (
                      <SearchEmptyState query={debouncedSearch.trim()} />
                    ) : (
                      "No departments created yet."
                    )}
                  </div>
                </AnimatedGridRow>
              ) : (
                visible.map((department) => (
                  <AnimatedGridRow
                    key={`${viewKey}:${department.id}`}
                    animateRows={animateRows}
                    className={cn(
                      departmentGrid,
                      "min-h-[58px] border-b border-[#eceef1] px-4 py-[7px] text-xs text-foreground last:rounded-b-[7px] last:border-b-0 hover:bg-[#e8eef2] @max-[820px]:gap-x-4 @max-[820px]:gap-y-[10px] @max-[820px]:py-[14px]",
                    )}
                  >
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
                          <HoverTooltip className="left-0 max-w-64 translate-x-0 whitespace-normal text-left leading-4 group-hover:translate-x-0 group-focus-visible:translate-x-0 group-focus-within:translate-x-0">
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
                  </AnimatedGridRow>
                ))
              )}
            </AnimatePresence>
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
            <NumberedPagination
              page={currentPage}
              totalPages={totalPages}
              disabled={loading}
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
