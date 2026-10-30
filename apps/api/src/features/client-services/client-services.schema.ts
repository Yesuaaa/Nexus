import { parsePage, parseQueryString } from "../../shared/query-helpers.js"
import { ServiceRequestStatus } from "../../generated/prisma/client.js"

export type ClientRequestFilters = {
  page: number
  search: string
  status: ServiceRequestStatus | ""
  sortOrder: "asc" | "desc"
}

export function parseClientRequestFilters(
  query: Record<string, unknown>,
): ClientRequestFilters | null {
  const page = parsePage(query.page)
  const search = parseQueryString(query.search)
  const status = parseQueryString(query.status)
  const rawSort = parseQueryString(query.sortOrder)
  const sortOrder = rawSort === "" ? "desc" : rawSort
  if (
    page === null ||
    search === null ||
    search.length > 100 ||
    status === null ||
    (status !== "" &&
      !Object.values(ServiceRequestStatus).includes(
        status as ServiceRequestStatus,
      )) ||
    (sortOrder !== "asc" && sortOrder !== "desc")
  )
    return null
  return {
    page,
    search: search.trim(),
    status: status as ServiceRequestStatus | "",
    sortOrder,
  }
}
