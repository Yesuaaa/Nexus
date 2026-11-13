export type WorkspaceDirectoryStatus =
  "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED"

export type WorkspaceDirectoryState = {
  page: number
  search: string
  status: WorkspaceDirectoryStatus | ""
  sort: "recent" | "name" | "client" | "projects"
  view: "active" | "archive"
}

export const defaultWorkspaceDirectoryState: WorkspaceDirectoryState = {
  page: 1,
  search: "",
  status: "",
  sort: "recent",
  view: "active",
}

const statuses = new Set<WorkspaceDirectoryStatus>([
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
])

const sorts = new Set<WorkspaceDirectoryState["sort"]>([
  "recent",
  "name",
  "client",
  "projects",
])

function oneValue(params: URLSearchParams, key: string) {
  const values = params.getAll(key)
  return values.length === 1 ? values[0] : values.length ? null : undefined
}

export function parseWorkspaceDirectoryState(
  params: URLSearchParams,
): WorkspaceDirectoryState {
  const search = oneValue(params, "search")
  const status = oneValue(params, "status")
  const sort = oneValue(params, "sort")
  const view = oneValue(params, "view")
  const page = oneValue(params, "page")
  const parsedPage = page && /^\d+$/.test(page) ? Number(page) : NaN

  return {
    page:
      Number.isSafeInteger(parsedPage) &&
      parsedPage >= 1 &&
      parsedPage <= 100_000
        ? parsedPage
        : defaultWorkspaceDirectoryState.page,
    search:
      typeof search === "string" && search.trim().length <= 200
        ? search.trim()
        : defaultWorkspaceDirectoryState.search,
    status:
      status === "" ||
      (typeof status === "string" &&
        statuses.has(status as WorkspaceDirectoryStatus))
        ? (status as WorkspaceDirectoryState["status"])
        : defaultWorkspaceDirectoryState.status,
    sort:
      typeof sort === "string" &&
      sorts.has(sort as WorkspaceDirectoryState["sort"])
        ? (sort as WorkspaceDirectoryState["sort"])
        : defaultWorkspaceDirectoryState.sort,
    view:
      view === "active" || view === "archive"
        ? view
        : defaultWorkspaceDirectoryState.view,
  }
}

export function serializeWorkspaceDirectoryState(
  state: WorkspaceDirectoryState,
) {
  const params = new URLSearchParams()
  if (state.search) params.set("search", state.search)
  if (state.status) params.set("status", state.status)
  if (state.sort !== defaultWorkspaceDirectoryState.sort)
    params.set("sort", state.sort)
  if (state.view !== defaultWorkspaceDirectoryState.view)
    params.set("view", state.view)
  if (state.page !== defaultWorkspaceDirectoryState.page)
    params.set("page", String(state.page))
  return params.toString()
}

export function workspaceDirectoryHref(state = defaultWorkspaceDirectoryState) {
  const query = serializeWorkspaceDirectoryState(state)
  return query ? `/project-workspace?${query}` : "/project-workspace"
}
