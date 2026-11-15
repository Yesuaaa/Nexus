"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Archive,
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  FolderKanban,
  Layers3,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { KpiDistributionChart } from "@/components/ui/kpi-distribution-chart"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { KpiPieChart } from "@/components/ui/kpi-pie-chart"
import { SearchField } from "@/components/ui/search-field"
import {
  listProjectWorkspaces,
  onProjectWorkspaceListChanged,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { WorkspaceListTable } from "../components/workspace-list-table"
import { useAsyncResource } from "@/lib/use-async-resource"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canCreateProjectWorkspace } from "@/features/auth/model/permissions"
import { WorkspaceDirectoryPage } from "./workspace-directory-page"
import {
  parseWorkspaceDirectoryState,
  serializeWorkspaceDirectoryState,
  workspaceDirectoryHref,
  type WorkspaceDirectoryState,
} from "../model/workspace-directory-state"

type WorkspaceSort = "recent" | "most-active"

const noWorkspaces: ProjectWorkspaceSummary[] = []
const emptyProjectCounts = {
  total: 0,
  byStatus: {
    PLANNED: 0,
    IN_PROGRESS: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  },
}

const activeStatusOptions = [
  { value: "all", label: "All active" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ON_HOLD", label: "On hold" },
]
const archivedStatusOptions = [
  { value: "all", label: "All archived" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]
const sortOptions: { value: WorkspaceSort; label: string }[] = [
  { value: "recent", label: "Most recent activity" },
  { value: "most-active", label: "Most activity" },
]
const staffWorkspaceViews = [
  { value: false, label: "Active", icon: BriefcaseBusiness },
  { value: true, label: "Archive", icon: Archive },
] as const

export function ProjectWorkspacePage() {
  const account = usePortalAccount()
  return canCreateProjectWorkspace(account) ? (
    <WorkspaceDirectoryPage key={account.id} />
  ) : (
    <StaffProjectWorkspacePage key={account.id} />
  )
}

function StaffProjectWorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSearchParams = searchParams.toString()
  const parsedState = useMemo(
    () => parseWorkspaceDirectoryState(new URLSearchParams(rawSearchParams)),
    [rawSearchParams],
  )
  const directoryState = useMemo<WorkspaceDirectoryState>(
    () => ({
      ...parsedState,
      departmentId: "",
      view: parsedState.view === "archive" ? "archive" : "active",
      sort: parsedState.sort === "most-active" ? "most-active" : "recent",
    }),
    [parsedState],
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
  const sort: WorkspaceSort =
    directoryState.sort === "most-active" ? "most-active" : "recent"
  const view = directoryState.view
  const status = directoryState.status || "all"
  const updateWorkspaceState = useCallback(
    (patch: Partial<WorkspaceDirectoryState>) => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
      const next = {
        ...directoryState,
        search: search.trim(),
        ...patch,
        page: 1,
      }
      router.replace(workspaceDirectoryHref(next), { scroll: false })
    },
    [directoryState, router, search],
  )
  useEffect(() => {
    if (rawSearchParams === canonicalSearchParams) return
    router.replace(workspaceDirectoryHref(directoryState), { scroll: false })
  }, [canonicalSearchParams, directoryState, rawSearchParams, router])
  const trimmedSearch = search.trim()
  const searchPending = trimmedSearch !== directoryState.search
  useEffect(() => {
    if (trimmedSearch === directoryState.search) return
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null
      updateWorkspaceState({ search: trimmedSearch })
    }, 200)
    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
    }
  }, [directoryState.search, trimmedSearch, updateWorkspaceState])
  const list = useAsyncResource(
    (signal) => listProjectWorkspaces({ sort }, signal),
    [sort],
    { fallbackError: "Couldn't load project workspaces." },
  )
  const workspaces = list.data?.workspaces ?? noWorkspaces
  const projectCounts = list.data?.projectCounts ?? emptyProjectCounts
  const resultsTruncated = list.data?.resultsTruncated ?? false
  const { loading, error, retry: refresh } = list
  useEffect(
    () => onProjectWorkspaceListChanged(refresh, { crossTabOnly: true }),
    [refresh],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return workspaces.filter((workspace) => {
      const archived = ["COMPLETED", "CANCELLED"].includes(workspace.status)
      const matchesView = view === "archive" ? archived : !archived
      const matchesStatus = status === "all" || workspace.status === status
      const matchesSearch =
        !needle ||
        workspace.name.toLowerCase().includes(needle) ||
        (workspace.client.fullName ?? "").toLowerCase().includes(needle) ||
        workspace.workstreams.some(
          (workstream) =>
            workstream.serviceName.toLowerCase().includes(needle) ||
            workstream.name.toLowerCase().includes(needle),
        )
      return matchesView && matchesStatus && matchesSearch
    })
  }, [search, status, view, workspaces])

  const activeCount = projectCounts.byStatus.IN_PROGRESS
  const openCount =
    projectCounts.byStatus.PLANNED +
    projectCounts.byStatus.IN_PROGRESS +
    projectCounts.byStatus.ON_HOLD
  const archivedCount =
    projectCounts.byStatus.COMPLETED + projectCounts.byStatus.CANCELLED
  const archivedWorkspaceCount = workspaces.filter(({ status }) =>
    ["COMPLETED", "CANCELLED"].includes(status),
  ).length
  const workstreamCount = workspaces.reduce(
    (count, workspace) => count + workspace.workstreams.length,
    0,
  )
  const activeTasks = workspaces.reduce(
    (count, workspace) =>
      count +
      workspace.workstreams.reduce(
        (total, workstream) => total + workstream.completedTaskCount,
        0,
      ),
    0,
  )
  const totalTaskCount = workspaces.reduce(
    (count, workspace) =>
      count +
      workspace.workstreams.reduce(
        (total, workstream) => total + workstream.taskCount,
        0,
      ),
    0,
  )
  const serviceCounts = workspaces.reduce((counts, workspace) => {
    workspace.workstreams.forEach((workstream) => {
      counts.set(
        workstream.serviceName,
        (counts.get(workstream.serviceName) ?? 0) + 1,
      )
    })
    return counts
  }, new Map<string, number>())
  const topServices = [...serviceCounts.entries()]
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 5)
  const remainingServiceCount =
    workstreamCount - topServices.reduce((count, [, value]) => count + value, 0)
  const serviceSegments = [
    ...topServices.map(([label, value], index) => ({
      label,
      value,
      color: ["#4169bd", "#29906b", "#7159bd", "#c27625", "#d81758"][index],
    })),
    ...(remainingServiceCount > 0
      ? [
          {
            label: "Other services",
            value: remainingServiceCount,
            color: "#8a9ab1",
          },
        ]
      : []),
  ]
  const projectStatusSegments = [
    {
      label: "Planned",
      value: projectCounts.byStatus.PLANNED,
      color: "#7088b5",
    },
    {
      label: "In progress",
      value: activeCount,
      color: "#29906b",
    },
    {
      label: "On hold",
      value: projectCounts.byStatus.ON_HOLD,
      color: "#c27625",
    },
    {
      label: "Completed",
      value: projectCounts.byStatus.COMPLETED,
      color: "#4169bd",
    },
    {
      label: "Cancelled",
      value: projectCounts.byStatus.CANCELLED,
      color: "#d81758",
    },
  ]
  const activeProjectStatusSegments = projectStatusSegments.filter(
    ({ label }) => !["Completed", "Cancelled"].includes(label),
  )
  const taskSegments = [
    { label: "Completed", value: activeTasks, color: "#29906b" },
    {
      label: "Remaining",
      value: Math.max(totalTaskCount - activeTasks, 0),
      color: "#e3e9ef",
    },
  ]

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Project workspace"
    >
      <PageHeader
        title="Project Workspace"
        description="Follow projects assigned to you, their plans, and delivery activity."
      />

      <KpiCards
        label="Project summary"
        pending={loading}
        unavailable={!!error}
        className="mt-[18px] grid-cols-4 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
        metrics={[
          {
            label: "Total projects",
            value: projectCounts.total,
            description: "Across projects assigned to you",
            icon: FolderKanban,
            iconClassName: "text-[#3153a5]",
            chart: (
              <KpiDistributionChart
                label={`Project status distribution: ${projectStatusSegments.map((segment) => `${segment.label}: ${segment.value}`).join("; ")}`}
                segments={projectStatusSegments}
              />
            ),
          },
          {
            label: "In progress",
            value: activeCount,
            description: `${openCount} active, planned, or on hold`,
            icon: Activity,
            iconClassName: "text-[#138447]",
            chart: (
              <KpiPieChart
                label={`Active project status distribution: ${activeProjectStatusSegments.map((segment) => `${segment.label}: ${segment.value}`).join("; ")}`}
                segments={activeProjectStatusSegments}
              />
            ),
          },
          {
            label: "Services",
            value: workstreamCount,
            description: resultsTruncated
              ? "In loaded project plans"
              : "Services in project plans",
            icon: Layers3,
            iconClassName: "text-[#526b95]",
            chart: (
              <KpiDistributionChart
                label={`Service distribution in ${resultsTruncated ? "loaded " : ""}project plans: ${serviceSegments.map((segment) => `${segment.label}: ${segment.value}`).join("; ") || "No services"}`}
                segments={serviceSegments}
              />
            ),
          },
          {
            label: "Tasks completed",
            value: activeTasks,
            description: resultsTruncated
              ? "Across loaded project plans"
              : "Across saved work plans",
            icon: CheckCircle2,
            iconClassName: "text-[#138447]",
            chart: (
              <KpiDonutChart
                label={`Task completion${resultsTruncated ? " in loaded projects" : ""}: ${activeTasks} completed of ${totalTaskCount} total`}
                segments={taskSegments}
              />
            ),
          },
        ]}
      />

      <section
        aria-label={view === "archive" ? "Project archive" : "Project list"}
        className="mt-5"
      >
        <div className="mb-4 grid gap-3">
          <h2 className="sr-only">
            {view === "archive" ? "Project archive" : "Department projects"}
          </h2>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <div className={`${filterBarClass} min-w-0 max-[560px]:w-full`}>
              <SearchField
                label="Search projects"
                placeholder="Search project, service, or client..."
                value={search}
                maxLength={100}
                onChange={(event) =>
                  setSearchDraft({
                    source: directoryState.search,
                    value: event.target.value,
                  })
                }
                containerClassName="max-[560px]:h-11"
              />
              <FilterSelect
                label="Filter projects by status"
                value={status}
                options={
                  view === "archive"
                    ? archivedStatusOptions
                    : activeStatusOptions
                }
                triggerClassName="w-[185px]"
                onChange={(value) =>
                  updateWorkspaceState({
                    status:
                      value === "all"
                        ? ""
                        : (value as WorkspaceDirectoryState["status"]),
                  })
                }
              />
              <FilterSelect
                label="Sort projects"
                value={sort}
                options={sortOptions}
                triggerClassName="w-[174px]"
                onChange={(value) => updateWorkspaceState({ sort: value })}
              />
            </div>
            <ManagementViewToggle
              active={view === "archive"}
              views={staffWorkspaceViews}
              ariaLabel="Project list view"
              className="max-[560px]:w-full"
              onChange={(archive) =>
                updateWorkspaceState({
                  view: archive ? "archive" : "active",
                  status: "",
                })
              }
            />
          </div>
        </div>
        {resultsTruncated && (
          <p role="status" className="mb-3 text-xs text-[#65718a]">
            Search, filters, and activity sorting use the first 200 assigned
            projects, so some results may be missing.
          </p>
        )}

        {error ? (
          <Alert as="div" className="rounded-xl p-5 text-sm">
            {error}
            <Button
              variant="outline"
              className="ml-3 h-8 text-xs"
              onClick={refresh}
            >
              Try again
            </Button>
          </Alert>
        ) : loading || searchPending || filtered.length > 0 ? (
          <WorkspaceListTable
            workspaces={filtered}
            loading={loading || searchPending}
            animateRows={false}
            viewKey={JSON.stringify([search, view, status, sort])}
            quickKey={search}
            archiveView={view === "archive"}
            directoryState={directoryState}
            onChanged={refresh}
          />
        ) : search.trim() || status !== "all" ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No projects match those filters"
            description={
              resultsTruncated
                ? "No loaded projects match. Some assigned projects may be outside the first 200 results."
                : "Try changing the search or status filter."
            }
          />
        ) : projectCounts.total === 0 ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No assigned projects yet"
            description="Projects assigned to you will appear here."
          />
        ) : view === "archive" && archivedCount === 0 ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="Archive is empty"
            description="Completed and cancelled projects will appear here."
          />
        ) : view === "archive" &&
          archivedWorkspaceCount === 0 &&
          archivedCount > 0 &&
          !resultsTruncated ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No fully archived workspaces"
            description="Completed or cancelled projects inside an active workspace remain listed with that workspace."
          />
        ) : view === "active" && openCount === 0 ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No active projects"
            description="All completed and cancelled projects are available in Archive."
          />
        ) : resultsTruncated ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="Projects are outside the loaded results"
            description="The Staff list currently loads up to 200 assigned projects. Some projects may be missing from this view."
          />
        ) : (
          <WorkspaceListTable
            workspaces={filtered}
            loading={loading || searchPending}
            animateRows={false}
            viewKey={JSON.stringify([search, view, status, sort])}
            quickKey={search}
            archiveView={view === "archive"}
            directoryState={directoryState}
            onChanged={refresh}
          />
        )}
      </section>
    </main>
  )
}
