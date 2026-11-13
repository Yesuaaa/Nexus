"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Archive, FolderKanban, Plus } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  FilterSelect,
  filterSelectTriggerClass,
} from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { statusLabel } from "@/features/projects/model/project-status"
import {
  listWorkspaceDirectory,
  type ProjectStatus,
  type WorkspaceDirectoryQuery,
} from "../api/project-workspace-api"
import { WorkspaceListTable } from "../components/workspace-list-table"
import { NewWorkspacePanel } from "./new-workspace-page"
import {
  parseWorkspaceDirectoryState,
  serializeWorkspaceDirectoryState,
} from "../model/workspace-directory-state"

const statuses: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]

const sortOptions: { value: WorkspaceDirectoryQuery["sort"]; label: string }[] =
  [
    { value: "recent", label: "Recently updated" },
    { value: "name", label: "Workspace name (A–Z)" },
    { value: "client", label: "Client name (A–Z)" },
    { value: "projects", label: "Most projects first" },
  ]

export function WorkspaceDirectoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSearchParams = searchParams.toString()
  const directoryState = useMemo(
    () => parseWorkspaceDirectoryState(new URLSearchParams(rawSearchParams)),
    [rawSearchParams],
  )
  const canonicalSearchParams = serializeWorkspaceDirectoryState(directoryState)
  const [searchDraft, setSearchDraft] = useState({
    source: directoryState.search,
    value: directoryState.search,
  })
  const search =
    searchDraft.source === directoryState.search
      ? searchDraft.value
      : directoryState.search
  const searchTimer = useRef<number | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const query = useMemo(
    () => ({
      search: directoryState.search,
      status: directoryState.status,
      sort: directoryState.sort,
      view: directoryState.view,
    }),
    [
      directoryState.search,
      directoryState.status,
      directoryState.sort,
      directoryState.view,
    ],
  )
  const updateDirectoryState = useCallback(
    (patch: Partial<typeof directoryState>) => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
      const draftSearch = search.trim()
      const searchChanged =
        patch.search === undefined && draftSearch !== directoryState.search
      const next = {
        ...directoryState,
        ...(searchChanged ? { search: draftSearch } : {}),
        ...patch,
      }
      if (searchChanged) next.page = 1
      const params = serializeWorkspaceDirectoryState(next)
      const href = params
        ? `/project-workspace?${params}`
        : "/project-workspace"
      router.replace(href, { scroll: false })
    },
    [directoryState, router, search],
  )
  const changePage = useCallback(
    (page: number) => {
      const next = { ...directoryState, page }
      const params = serializeWorkspaceDirectoryState(next)
      const href = params
        ? `/project-workspace?${params}`
        : "/project-workspace"
      router.replace(href, { scroll: false })
    },
    [directoryState, router],
  )
  useEffect(() => {
    if (rawSearchParams === canonicalSearchParams) return
    const href = canonicalSearchParams
      ? `/project-workspace?${canonicalSearchParams}`
      : "/project-workspace"
    router.replace(href, { scroll: false })
  }, [canonicalSearchParams, rawSearchParams, router])
  const list = usePaginatedList({
    params: query,
    load: ({ page, signal }) =>
      listWorkspaceDirectory({ ...query, page }, signal),
    controlledPage: directoryState.page,
    onPageChange: changePage,
    rows: (result) => result.rows,
    matches: () => false,
    initial: null,
    fallbackError: "Couldn't load project workspaces.",
  })
  function sortBy(value: WorkspaceDirectoryQuery["sort"]) {
    updateDirectoryState({ sort: value, page: 1 })
  }
  const trimmedSearch = search.trim()
  useEffect(() => {
    if (trimmedSearch === directoryState.search) return
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null
      updateDirectoryState({ search: trimmedSearch, page: 1 })
    }, 200)
    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
    }
  }, [directoryState.search, trimmedSearch, updateDirectoryState])
  const archive = directoryState.view === "archive"
  const data = list.loading || list.error ? null : list.data
  const noResults = data?.hasWorkspaces
    ? query.search || query.status
      ? "No workspaces match these filters"
      : archive
        ? "Archive is empty"
        : "No active workspaces"
    : "No project workspaces yet"

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Project workspace"
    >
      <PageHeader
        headingId="project-workspace-management-heading"
        title="Project Workspace Management"
        description="Find and manage the projects your department is responsible for."
        actions={
          <PageHeaderButton onClick={() => setSetupOpen(true)}>
            <Plus aria-hidden="true" />
            Set up workspace
          </PageHeaderButton>
        }
      />
      <section className="mt-5" aria-label="Workspace directory">
        <div className="flex flex-wrap items-start gap-[10px] pb-4 max-[560px]:flex-col max-[560px]:pb-3">
          <SearchField
            containerClassName="flex-none max-[560px]:w-full"
            label="Search workspaces"
            placeholder="Search workspace, project, or client"
            maxLength={200}
            value={search}
            onChange={(event) =>
              setSearchDraft({
                source: directoryState.search,
                value: event.target.value,
              })
            }
          />
          <div className="flex min-w-0 flex-wrap gap-[10px] max-[560px]:w-full max-[560px]:flex-col">
            <FilterSelect
              label="Filter workspaces by status"
              value={directoryState.status}
              options={[
                { value: "", label: "All statuses" },
                ...statuses.map((value) => ({
                  value,
                  label: statusLabel(value),
                })),
              ]}
              triggerClassName={`${filterSelectTriggerClass} w-[140px]`}
              onChange={(value) =>
                updateDirectoryState({ status: value, page: 1 })
              }
            />
            <FilterSelect
              label="Sort workspaces"
              value={directoryState.sort}
              options={sortOptions}
              triggerClassName={`${filterSelectTriggerClass} w-[190px]`}
              onChange={sortBy}
            />
          </div>
          <ManagementViewToggle
            className="ml-auto max-[560px]:ml-0"
            active={!archive}
            ariaLabel="Workspace view"
            views={[
              { value: true, label: "Active", icon: FolderKanban },
              { value: false, label: "Archive", icon: Archive },
            ]}
            onChange={(active) => {
              updateDirectoryState({
                view: active ? "active" : "archive",
                status: "",
                page: 1,
              })
            }}
          />
        </div>
        {list.error ? (
          <Alert as="div">
            {list.error}{" "}
            <Button variant="outline" onClick={list.retry}>
              Try again
            </Button>
          </Alert>
        ) : data && !data.rows.length ? (
          <EmptyState icon={FolderKanban} title={noResults} size="lg" />
        ) : (
          <WorkspaceListTable
            directory
            workspaces={data?.rows ?? []}
            loading={list.loading}
            viewKey={list.tableViewKey}
            quickKey=""
            archiveView={archive}
            directoryState={directoryState}
            onChanged={list.retry}
          />
        )}
        {data && data.total > 0 && (
          <TablePaginationFooter
            {...pageRange(data.page, data.pageSize, data.total)}
            total={data.total}
            page={data.page}
            totalPages={data.totalPages}
            label="Workspace pages"
            itemLabel="workspaces"
            onPageChange={list.setPage}
          />
        )}
      </section>
      {setupOpen && (
        <NewWorkspacePanel
          onClose={() => setSetupOpen(false)}
          onCreated={list.retry}
          returnState={directoryState}
        />
      )}
    </main>
  )
}
