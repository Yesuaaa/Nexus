"use client"

import { useEffect, useState } from "react"
import { Archive, FolderKanban, Plus } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Dropdown } from "@/components/ui/dropdown"
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

const dropdownTriggerClass =
  "h-[34px] rounded-md border-[#e1e4ea] bg-transparent text-xs font-normal shadow-sm"

export function WorkspaceDirectoryPage() {
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [status, setStatus] = useState("")
  const [sort, setSort] = useState<WorkspaceDirectoryQuery["sort"]>("recent")
  const [archive, setArchive] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const query = {
    search: appliedSearch,
    status,
    sort,
    view: archive ? "archive" : "active",
  } as const
  const list = usePaginatedList({
    params: query,
    load: ({ page, signal }) =>
      listWorkspaceDirectory({ ...query, page }, signal),
    rows: (result) => result.rows,
    matches: () => false,
    initial: null,
    fallbackError: "Couldn't load project workspaces.",
  })
  const { setPage } = list
  function sortBy(value: WorkspaceDirectoryQuery["sort"]) {
    setSort(value)
    setPage(1)
  }
  const trimmedSearch = search.trim()
  useEffect(() => {
    if (trimmedSearch === appliedSearch) return
    const timer = window.setTimeout(() => {
      setAppliedSearch(trimmedSearch)
      setPage(1)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [trimmedSearch, appliedSearch, setPage])
  const data = list.loading || list.error ? null : list.data
  const noResults = data?.hasWorkspaces
    ? query.search || status
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
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex min-w-0 flex-wrap gap-[10px] max-[560px]:w-full max-[560px]:flex-col">
            <Dropdown
              className="w-[140px] max-[560px]:w-full"
              triggerClassName={dropdownTriggerClass}
              label="Filter workspaces by status"
              value={status}
              options={[
                { value: "", label: "All statuses" },
                ...statuses.map((value) => ({
                  value,
                  label: statusLabel(value),
                })),
              ]}
              onChange={(value) => {
                setStatus(value)
                list.setPage(1)
              }}
            />
            <Dropdown
              className="w-[190px] max-[560px]:w-full"
              triggerClassName={dropdownTriggerClass}
              label="Sort workspaces"
              value={sort}
              options={sortOptions}
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
              setArchive(!active)
              setStatus("")
              list.setPage(1)
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
        />
      )}
    </main>
  )
}
