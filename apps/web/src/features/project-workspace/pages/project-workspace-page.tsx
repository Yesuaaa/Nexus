"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  FolderKanban,
  Layers3,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { KpiDistributionChart } from "@/components/ui/kpi-distribution-chart"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { KpiPieChart } from "@/components/ui/kpi-pie-chart"
import { SearchField } from "@/components/ui/search-field"
import {
  listProjectWorkspaces,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { WorkspaceListTable } from "../components/workspace-list-table"
import { useAsyncResource } from "@/lib/use-async-resource"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canCreateProjectWorkspace } from "@/features/auth/model/permissions"
import { WorkspaceDirectoryPage } from "./workspace-directory-page"

type WorkspaceSort = "recent" | "most-active"

const noWorkspaces: ProjectWorkspaceSummary[] = []

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

export function ProjectWorkspacePage() {
  const account = usePortalAccount()
  return canCreateProjectWorkspace(account) ? (
    <WorkspaceDirectoryPage key={account.id} />
  ) : (
    <StaffProjectWorkspacePage key={account.id} />
  )
}

function StaffProjectWorkspacePage() {
  const [sort, setSort] = useState<WorkspaceSort>("recent")
  const [view, setView] = useState<"active" | "archive">("active")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const list = useAsyncResource(
    (signal) => listProjectWorkspaces({ sort }, signal),
    [sort],
    { fallbackError: "Couldn't load project workspaces." },
  )
  const workspaces = list.data?.workspaces ?? noWorkspaces
  const { loading, error, retry: refresh } = list

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

  const activeCount = workspaces.filter(
    ({ status: itemStatus }) => itemStatus === "IN_PROGRESS",
  ).length
  const openCount = workspaces.filter(({ status: itemStatus }) =>
    ["PLANNED", "IN_PROGRESS", "ON_HOLD"].includes(itemStatus),
  ).length
  const archivedCount = workspaces.filter(({ status: itemStatus }) =>
    ["COMPLETED", "CANCELLED"].includes(itemStatus),
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
      value: workspaces.filter(
        ({ status: itemStatus }) => itemStatus === "PLANNED",
      ).length,
      color: "#7088b5",
    },
    {
      label: "In progress",
      value: activeCount,
      color: "#29906b",
    },
    {
      label: "On hold",
      value: workspaces.filter(
        ({ status: itemStatus }) => itemStatus === "ON_HOLD",
      ).length,
      color: "#c27625",
    },
    {
      label: "Completed",
      value: workspaces.filter(
        ({ status: itemStatus }) => itemStatus === "COMPLETED",
      ).length,
      color: "#4169bd",
    },
    {
      label: "Cancelled",
      value: workspaces.filter(
        ({ status: itemStatus }) => itemStatus === "CANCELLED",
      ).length,
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
        description="Follow project plans, team assignments, and delivery activity for your department."
      />

      <KpiCards
        label="Project summary"
        pending={loading}
        unavailable={!!error}
        className="mt-[18px] grid-cols-4 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
        metrics={[
          {
            label: "Total projects",
            value: workspaces.length,
            description: "Across your department",
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
            description: `${openCount} active or planned`,
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
            description: "Services in project plans",
            icon: Layers3,
            iconClassName: "text-[#526b95]",
            chartValues: serviceSegments.map((segment) => segment.value),
            chartLabel: `Service distribution in project plans: ${serviceSegments.map((segment) => `${segment.label}: ${segment.value}`).join("; ") || "No services"}`,
            chartColor: "#7159bd",
          },
          {
            label: "Tasks completed",
            value: activeTasks,
            description: "Across saved work plans",
            icon: CheckCircle2,
            iconClassName: "text-[#138447]",
            chart: (
              <KpiDonutChart
                label={`Task completion: ${activeTasks} completed of ${totalTaskCount} total`}
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
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 max-[560px]:w-full">
              <SearchField
                label="Search projects"
                placeholder="Search project, service, or client..."
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
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
                onChange={setStatus}
              />
              <FilterSelect
                label="Sort projects"
                value={sort}
                options={sortOptions}
                triggerClassName="w-[174px]"
                onChange={setSort}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={view === "archive"}
              onClick={() => {
                setView((current) =>
                  current === "archive" ? "active" : "archive",
                )
                setStatus("all")
                setSearch("")
              }}
              className="h-[34px] flex-none border-[#d64557] text-xs text-[#b3343b] hover:bg-[#fff0f1] hover:text-[#9f2638] focus-visible:ring-[#b3343b] max-[560px]:h-11 max-[560px]:w-full"
            >
              <Archive size={14} aria-hidden="true" />
              {view === "archive" ? "Back to Projects" : "Archive"}
            </Button>
          </div>
        </div>

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
        ) : loading || workspaces.length ? (
          <WorkspaceListTable
            workspaces={filtered}
            loading={loading}
            viewKey={JSON.stringify([search, view, status, sort])}
            quickKey={search}
            archiveView={view === "archive"}
            onChanged={refresh}
          />
        ) : workspaces.length === 0 && view === "active" ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No project workspaces yet"
            description="Workspaces will appear here once approved bookings are set up for delivery."
          />
        ) : view === "archive" &&
          archivedCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="Archive is empty"
            description="Completed and cancelled projects will appear here."
          />
        ) : workspaces.length > 0 &&
          view === "active" &&
          openCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <EmptyState
            size="lg"
            icon={BriefcaseBusiness}
            title="No active projects"
            description="All completed and cancelled projects are available in Archive."
          />
        ) : (
          <p className="rounded-xl border border-[#e2e6ec] p-8 text-center text-sm text-[#738096]">
            No projects match those filters.
          </p>
        )}
      </section>
    </main>
  )
}
