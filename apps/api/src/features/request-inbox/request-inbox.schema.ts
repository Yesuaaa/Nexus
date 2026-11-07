import { parsePage, parseQueryString } from "../../shared/query-helpers.js"

export type InboxFilters = {
  page: number
  search: string
  view:
    | "pending"
    | "under-review"
    | "all"
    | "awaiting-information"
    | "ready-for-quotation"
    | "closed"
    | "cancelled"
  sortBy: "createdAt" | "reference" | "service" | "client" | "status"
  sortDir: "asc" | "desc"
}

export function parseInboxFilters(
  query: Record<string, unknown>,
): InboxFilters | null {
  const page = parsePage(query.page)
  const search = parseQueryString(query.search)
  const view = query.view ?? "pending"
  const sortBy = query.sortBy ?? "createdAt"
  const sortDir = query.sortDir ?? "asc"
  if (
    page === null ||
    page > 100_000 ||
    search === null ||
    search.length > 100 ||
    ![
      "pending",
      "under-review",
      "all",
      "awaiting-information",
      "ready-for-quotation",
      "closed",
      "cancelled",
    ].includes(String(view)) ||
    typeof view !== "string" ||
    (sortBy !== "createdAt" &&
      sortBy !== "reference" &&
      sortBy !== "service" &&
      sortBy !== "client" &&
      sortBy !== "status") ||
    (sortDir !== "asc" && sortDir !== "desc")
  )
    return null
  return { page, search, view: view as InboxFilters["view"], sortBy, sortDir }
}
