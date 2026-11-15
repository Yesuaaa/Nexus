export type DepartmentDirectorySort = "name" | "head" | "members" | "projects"

export type DepartmentDirectoryState = {
  search: string
  sort: DepartmentDirectorySort
  direction: "asc" | "desc"
  page: number
}

export const defaultDepartmentDirectoryState: DepartmentDirectoryState = {
  search: "",
  sort: "name",
  direction: "asc",
  page: 1,
}

const sorts = new Set<DepartmentDirectorySort>([
  "name",
  "head",
  "members",
  "projects",
])

function oneValue(params: URLSearchParams, key: string) {
  const values = params.getAll(key)
  return values.length === 1 ? values[0] : values.length ? null : undefined
}

function defaultDirection(sort: DepartmentDirectorySort) {
  return sort === "name" || sort === "head" ? "asc" : "desc"
}

export function parseDepartmentDirectoryState(
  params: URLSearchParams,
): DepartmentDirectoryState {
  const rawSearch = oneValue(params, "search")
  const rawSort = oneValue(params, "sort")
  const rawDirection = oneValue(params, "direction")
  const rawPage = oneValue(params, "page")
  const sort =
    typeof rawSort === "string" && sorts.has(rawSort as DepartmentDirectorySort)
      ? (rawSort as DepartmentDirectorySort)
      : defaultDepartmentDirectoryState.sort
  const parsedPage =
    typeof rawPage === "string" && /^\d+$/.test(rawPage)
      ? Number(rawPage)
      : Number.NaN

  return {
    search:
      typeof rawSearch === "string" && rawSearch.trim().length <= 100
        ? rawSearch.trim()
        : defaultDepartmentDirectoryState.search,
    sort,
    direction:
      rawDirection === "asc" || rawDirection === "desc"
        ? rawDirection
        : defaultDirection(sort),
    page:
      Number.isSafeInteger(parsedPage) &&
      parsedPage >= 1 &&
      parsedPage <= 100_000
        ? parsedPage
        : defaultDepartmentDirectoryState.page,
  }
}

export function serializeDepartmentDirectoryState(
  state: DepartmentDirectoryState,
) {
  const params = new URLSearchParams()
  if (state.search) params.set("search", state.search)
  if (state.sort !== defaultDepartmentDirectoryState.sort)
    params.set("sort", state.sort)
  if (state.direction !== defaultDirection(state.sort))
    params.set("direction", state.direction)
  if (state.page !== defaultDepartmentDirectoryState.page)
    params.set("page", String(state.page))
  return params.toString()
}

export function departmentDirectoryHref(state: DepartmentDirectoryState) {
  const query = serializeDepartmentDirectoryState(state)
  return query ? `/project-management?${query}` : "/project-management"
}
