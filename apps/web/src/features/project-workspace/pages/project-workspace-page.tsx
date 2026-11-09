"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  FolderKanban,
  Layers3,
} from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/components/ui/kpi-cards"
import { KpiDistributionChart } from "@/components/ui/kpi-distribution-chart"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { KpiPieChart } from "@/components/ui/kpi-pie-chart"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listProjectWorkspaces,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { WorkspaceListTable } from "../components/workspace-list-table"

export function ProjectWorkspacePage() {
  const [workspaces, setWorkspaces] = useState<ProjectWorkspaceSummary[]>([])
  const [sort, setSort] = useState<"recent" | "most-active">("recent")
  const [view, setView] = useState<"active" | "archive">("active")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  function refresh() {
    setLoading(true)
    setError("")
    setRevision((value) => value + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    listProjectWorkspaces({ sort }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setWorkspaces(result.workspaces)
          setError("")
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load project workspaces.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [sort, revision])

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
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-4">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Project Workspace
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Follow project plans, team assignments, and delivery activity for
            your department.
          </p>
        </div>
      </header>

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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger
                  aria-label="Filter projects by status"
                  className="h-[34px] w-[185px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {view === "archive" ? "All archived" : "All active"}
                  </SelectItem>
                  {view === "archive" ? (
                    <>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="PLANNED">Planned</SelectItem>
                      <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      <SelectItem value="ON_HOLD">On hold</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(value) => {
                  const nextSort = value as "recent" | "most-active"
                  if (nextSort === sort) return
                  setLoading(true)
                  setError("")
                  setSort(nextSort)
                }}
              >
                <SelectTrigger
                  aria-label="Sort projects"
                  className="h-[34px] w-[174px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent activity</SelectItem>
                  <SelectItem value="most-active">Most activity</SelectItem>
                </SelectContent>
              </Select>
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
          <div
            className="rounded-xl border border-[#f0d1d3] bg-[#fff9f9] p-5 text-sm text-[#9c343b]"
            role="alert"
          >
            {error}
            <Button
              variant="outline"
              className="ml-3 h-8 text-xs"
              onClick={refresh}
            >
              Try again
            </Button>
          </div>
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
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                No project workspaces yet
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                Workspaces will appear here once approved bookings are set up
                for delivery.
              </p>
            </div>
          </div>
        ) : view === "archive" &&
          archivedCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                Archive is empty
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                Completed and cancelled projects will appear here.
              </p>
            </div>
          </div>
        ) : workspaces.length > 0 &&
          view === "active" &&
          openCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                No active projects
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                All completed and cancelled projects are available in Archive.
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-[#e2e6ec] p-8 text-center text-sm text-[#738096]">
            No projects match those filters.
          </p>
        )}
      </section>
    </main>
  )
}
