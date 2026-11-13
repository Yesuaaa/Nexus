"use client"

import { useCallback, useMemo, useState } from "react"
import { pageRange } from "@/components/ui/table-pagination-footer"
import type { SortDirection } from "@/components/ui/table-sort-button"
import type { PaginatedFooter } from "@/components/ui/use-paginated-list"
import { useTableFooter } from "@/components/ui/use-table-search"

const ascending = (): SortDirection => "asc"

/**
 * Column sort state with a click-to-toggle helper. Clicking the active
 * column flips its direction; clicking another starts at that column's
 * default direction.
 */
export function useTableSort<K extends string>(
  initialKey: K,
  initialDirection: SortDirection,
  defaultDirection: (key: K) => SortDirection = ascending,
) {
  const [sort, setSort] = useState({
    key: initialKey,
    direction: initialDirection,
  })
  const toggle = useCallback(
    (key: K) =>
      setSort((current) =>
        current.key === key
          ? {
              key,
              direction: current.direction === "asc" ? "desc" : "asc",
            }
          : { key, direction: defaultDirection(key) },
      ),
    [defaultDirection],
  )
  return {
    sortKey: sort.key,
    direction: sort.direction,
    /** Direction for a column's sort button (null when it isn't active). */
    directionFor: (key: K): SortDirection | null =>
      sort.key === key ? sort.direction : null,
    toggle,
    setSort,
  }
}

/**
 * Client-side pagination over already filtered and sorted rows: clamps the
 * page, slices the visible rows, and keeps the pagination footer in step
 * with the row animation. The page returns to 1 whenever `view` changes, so
 * filter and sort handlers don't need to reset it.
 *
 *   const sort = useTableSort<SortKey>("name", "asc")
 *   const filtered = useMemo(() => …, [items, query, sort.sortKey, sort.direction])
 *   const table = useLocalTable(filtered, {
 *     view: [query, sort.sortKey, sort.direction],
 *     loading,
 *   })
 *   <Table rows={table.visible} viewKey={table.viewKey} onRowsSettled={table.onRowsSettled} />
 *   <TablePaginationFooter {...table.footer} label="Department pages" onPageChange={table.setPage} />
 */
export function useLocalTable<T>(
  rows: T[],
  {
    view = [],
    loading = false,
    pageSize = 10,
  }: {
    /** JSON-serializable inputs that define the current view (search, filters, sort). */
    view?: readonly unknown[]
    loading?: boolean
    pageSize?: number
  } = {},
) {
  const viewKey = JSON.stringify(view)
  const [paging, setPaging] = useState({ viewKey, page: 1 })
  const requestedPage = paging.viewKey === viewKey ? paging.page : 1
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const total = rows.length

  const visible = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )
  const tableResult = useMemo(
    () => ({ page, total, viewKey }),
    [page, total, viewKey],
  )
  const { footer: settled, onRowsSettled } = useTableFooter(
    tableResult,
    loading,
  )
  const setPage = useCallback(
    (next: number) => setPaging({ viewKey, page: next }),
    [viewKey],
  )

  const footer: PaginatedFooter = {
    ...pageRange(settled.page, pageSize, settled.total),
    total: settled.total,
    page: settled.page,
    totalPages: Math.max(1, Math.ceil(settled.total / pageSize)),
    disabled: loading || settled !== tableResult,
  }

  return {
    /** Rows on the current page. */
    visible,
    page,
    setPage,
    totalPages,
    total,
    /** Props for `<TablePaginationFooter>` (add `label` and `onPageChange`). */
    footer,
    onRowsSettled,
    /** Changes with the view and page; pass to the table's `viewKey`. */
    viewKey: JSON.stringify([view, page]),
  }
}
