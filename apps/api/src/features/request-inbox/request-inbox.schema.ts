import { parsePage, parseQueryString } from "../../shared/query-helpers.js"

export type InboxFilters = {
  page: number
  search: string
  view: "pending" | "under-review"
}

export function parseInboxFilters(
  query: Record<string, unknown>,
): InboxFilters | null {
  const page = parsePage(query.page)
  const search = parseQueryString(query.search)
  const view = query.view ?? "pending"
  if (
    page === null ||
    page > 100_000 ||
    search === null ||
    search.length > 100 ||
    (view !== "pending" && view !== "under-review")
  )
    return null
  return { page, search, view }
}
