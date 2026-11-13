"use client"

import { useCallback, useEffect, useEffectEvent, useState } from "react"
import { ApiError } from "@/features/auth/api/auth-api"
import { errorMessage } from "@/lib/error-message"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import {
  useTableFooter,
  useTableSearch,
} from "@/components/ui/use-table-search"

/** Paging fields every server list response carries. */
export type PageInfo = { total: number; page: number; pageSize: number }

/** Props for `<TablePaginationFooter>` (add `label` and `onPageChange`). */
export type PaginatedFooter = {
  from: number
  to: number
  total: number
  page: number
  totalPages: number
  disabled: boolean
}

/**
 * Server-paginated table state: owns the page number, loads a page whenever
 * `params`/page/retry change (aborting the previous request), clamps the page
 * when the result shrinks, keeps an instant client-side search preview, and
 * moves the pagination footer only once the rows finish animating.
 *
 *   const list = usePaginatedList({
 *     params: { search: query, status },
 *     load: ({ page, signal }) => listClients({ search: query, status, page, signal }),
 *     rows: (result) => result.clients,
 *     matches: matchesTableSearch, // module-level, so it is stable
 *     initial: { clients: [], total: 0, page: 1, pageSize: 10 },
 *   })
 *   <ClientTable clients={list.rows} viewKey={list.tableViewKey}
 *     onRowsSettled={list.onRowsSettled} loading={list.loading} error={list.error} />
 *   {list.footer && <TablePaginationFooter {...list.footer} label="Client pages"
 *     onPageChange={list.setPage} />}
 *
 * Reset the page yourself (`list.setPage(1)`) when a filter changes.
 */
export function usePaginatedList<R extends PageInfo, T>({
  params,
  load,
  rows: getRows,
  matches,
  initial,
  controlledPage,
  onPageChange,
  refresh = false,
  fallbackError = "Couldn't load this list.",
  viewKeyFrom = "result",
  onLoaded,
}: {
  /**
   * Every request input except the page, as JSON-serializable values.
   * `search` is the trimmed query; it drives the instant search preview.
   */
  params: { search: string } & Record<string, unknown>
  /** Loads one page. Always called with the latest props. */
  load: (request: { page: number; signal: AbortSignal }) => Promise<R>
  /** Picks the table rows out of a response. */
  rows: (result: R) => T[]
  /** Client-side search match for the preview; keep it module-level. */
  matches: (item: T, query: string) => boolean
  /** Shown before the first response (use `null` if there is no sensible empty value). */
  initial: R | null
  /** Optional URL-backed page value. */
  controlledPage?: number
  /** Called instead of local state when `controlledPage` is supplied. */
  onPageChange?: (page: number) => void
  /**
   * Re-request the current page while the tab is visible: `"poll"` on an
   * interval and on focus, `"focus"` only on focus/visibility/reconnect.
   * Background refreshes skip while a request is in flight and keep the
   * current rows on network or 5xx errors.
   */
  refresh?: "poll" | "focus" | false
  fallbackError?: string
  /**
   * When the table's view key changes: `"result"` once the new page arrives
   * (or immediately for a search preview), `"request"` as soon as the
   * inputs change.
   */
  viewKeyFrom?: "result" | "request"
  /** Runs after each accepted response (initial, retry, or refresh). */
  onLoaded?: (result: R) => void
}) {
  const [localPage, setLocalPage] = useState(1)
  const page = controlledPage ?? localPage
  const setPage = useCallback(
    (next: number | ((current: number) => number)) => {
      const value = typeof next === "function" ? next(page) : next
      if (controlledPage === undefined) setLocalPage(value)
      else onPageChange?.(value)
    },
    [controlledPage, onPageChange, page],
  )
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<R | null>(initial)
  const [resolved, setResolved] = useState({ requestKey: "", viewKey: "" })
  const [failure, setFailure] = useState({ requestKey: "", message: "" })
  const { search, ...filters } = params
  const viewKey = JSON.stringify([params, page])
  const requestKey = JSON.stringify([viewKey, revision])
  const scope = JSON.stringify([filters, revision])
  const loading = resolved.requestKey !== requestKey
  const error = failure.requestKey === requestKey ? failure.message : ""

  const { acceptRows, preview, previewing } = useTableSearch<T>({
    search,
    scope,
    page,
    matches,
  })
  const { footer: footerData, onRowsSettled } = useTableFooter(
    data,
    loading || previewing,
  )

  const fetchPage = useEffectEvent((signal: AbortSignal) =>
    load({ page, signal }),
  )
  const accept = useEffectEvent((result: R) => {
    acceptRows(getRows(result))
    setData(result)
    onLoaded?.(result)
  })
  const fallback = useEffectEvent(() => fallbackError)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let inFlight = false
    let hasLoaded = false
    const run = () => {
      if (inFlight) return
      inFlight = true
      fetchPage(controller.signal)
        .then((result) => {
          if (!active) return
          const lastPage = Math.max(
            1,
            Math.ceil(result.total / result.pageSize),
          )
          if (page > lastPage) {
            setPage(lastPage)
            return
          }
          hasLoaded = true
          accept(result)
          setFailure({ requestKey: "", message: "" })
          setResolved({ requestKey, viewKey })
        })
        .catch((reason: unknown) => {
          if (!active) return
          // A failed background refresh keeps the rows already on screen.
          if (
            hasLoaded &&
            (!(reason instanceof ApiError) || reason.status >= 500)
          )
            return
          setFailure({ requestKey, message: errorMessage(reason, fallback()) })
          setResolved((current) => ({ ...current, requestKey }))
        })
        .finally(() => {
          inFlight = false
        })
    }
    run()
    const stopRefresh = refresh
      ? watchVisibleRefresh(run, { poll: refresh === "poll" })
      : undefined
    return () => {
      active = false
      controller.abort()
      stopRefresh?.()
    }
  }, [requestKey, viewKey, page, refresh, setPage])

  const retry = useCallback(() => setRevision((value) => value + 1), [])

  const tableViewKey =
    viewKeyFrom === "request"
      ? JSON.stringify([scope, search, page])
      : previewing
        ? JSON.stringify([scope, search, 1])
        : resolved.viewKey

  let footer: PaginatedFooter | null = null
  if (!error && !previewing && footerData && footerData.total > 0) {
    const start = (footerData.page - 1) * footerData.pageSize
    footer = {
      from: start + 1,
      to: start + getRows(footerData).length,
      total: footerData.total,
      page: footerData.page,
      totalPages: Math.max(
        1,
        Math.ceil(footerData.total / footerData.pageSize),
      ),
      disabled: loading || footerData !== data,
    }
  }

  return {
    /** Rows to render: the search preview while typing, else the loaded page. */
    rows: preview ?? (data ? getRows(data) : []),
    /** Client-side preview rows while a search request is pending. */
    preview,
    previewing,
    /** The last accepted response (or `initial`). */
    data,
    /** Update the loaded response locally, e.g. to sync an edited row. */
    setData,
    loading,
    /** True once any response (or error) has arrived. */
    hasLoaded: resolved.requestKey !== "",
    /** True when the footer and rows show the same, settled page. */
    settled: !loading && footerData === data,
    error,
    /** Props for `<TablePaginationFooter>`, or null while it should be hidden. */
    footer,
    onRowsSettled,
    tableViewKey,
    page,
    setPage,
    /** Reload the current page (also used after a mutation). */
    retry,
    /** Increments on every `retry`, for keys that should follow reloads. */
    revision,
  }
}
