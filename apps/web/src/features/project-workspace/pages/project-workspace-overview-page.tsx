"use client"

import { useEffect } from "react"
import Link from "next/link"
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  PauseCircle,
} from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/components/ui/kpi-cards"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
} from "@/components/ui/overview-panel"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import type { KpiDistributionSegment } from "@/components/ui/kpi-distribution-chart"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  getProjectWorkspaceOverview,
  onProjectWorkspaceListChanged,
  projectWorkspaceHref,
  type ProjectStatus,
  type ProjectWorkspaceOverview,
  type ProjectWorkspaceOverviewTask,
} from "../api/project-workspace-api"
import { taskStatusLabels } from "../model/task-status"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  defaultWorkspaceDirectoryState,
  workspaceDirectoryHref,
} from "../model/workspace-directory-state"

const projectStatusOrder: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]

const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

const projectStatusColors: Record<
  ProjectStatus,
  { color: string; colorClass: string }
> = {
  PLANNED: { color: "#7088b5", colorClass: "bg-[#7088b5]" },
  IN_PROGRESS: { color: "#29906b", colorClass: "bg-[#29906b]" },
  ON_HOLD: { color: "#c27625", colorClass: "bg-[#c27625]" },
  COMPLETED: { color: "#4169bd", colorClass: "bg-[#4169bd]" },
  CANCELLED: { color: "#d81758", colorClass: "bg-[#d81758]" },
}

type OverviewLoadResult = {
  data: ProjectWorkspaceOverview | null
  error: string
}

function taskNote(task: ProjectWorkspaceOverviewTask, due: string) {
  return `${task.projectName} · Due ${due} · ${taskStatusLabels[task.status]}`
}

export function ProjectWorkspaceOverviewPage() {
  const account = usePortalAccount()
  const departmentId = account.headOf?.id ?? null
  const { formatDateOnly, preferencesLoaded, timeZone } = useDatePreferences()
  const resource = useAsyncResource<OverviewLoadResult>(
    async (signal) => {
      try {
        return {
          data: await getProjectWorkspaceOverview(signal),
          error: "",
        }
      } catch (reason) {
        return {
          data: null,
          error: errorMessage(reason, "Couldn't load project overview."),
        }
      }
    },
    [departmentId, timeZone],
    {
      enabled: Boolean(departmentId) && preferencesLoaded,
      fallbackError: "Couldn't load project overview.",
    },
  )
  useEffect(
    () => onProjectWorkspaceListChanged(resource.retry),
    [resource.retry],
  )

  const data =
    departmentId && !resource.loading
      ? (resource.data?.data ?? undefined)
      : undefined
  const loading =
    Boolean(departmentId) && (!preferencesLoaded || resource.loading)
  const error = !departmentId
    ? "Department Head access is required to view project analytics."
    : loading
      ? ""
      : (resource.data?.error ?? resource.error)
  const unavailable = Boolean(error) && !data
  const totals = data?.totals
  const totalProjects = totals?.totalProjects ?? 0
  const totalTasks = totals?.totalTasks ?? 0
  const completedTasks = totals?.completedTasks ?? 0
  const taskCompletion =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const statusRows = projectStatusOrder.map((status) => ({
    id: status,
    label: projectStatusLabels[status],
    value:
      data?.statusDistribution.find((item) => item.status === status)?.count ??
      0,
    colorClass: projectStatusColors[status].colorClass,
  }))
  const statusSegments: KpiDistributionSegment[] = statusRows.map((row) => ({
    label: row.label,
    value: row.value,
    color: projectStatusColors[row.id].color,
  }))
  const plannedProgressRows =
    data?.workspaceProgress.filter((workspace) => workspace.totalTasks > 0) ??
    []
  const primaryStats: StatStripItem[] = [
    {
      label: "Total Projects",
      value: totalProjects.toLocaleString("en-US"),
      caption: totalProjects
        ? "Across your department"
        : "No department projects yet",
      icon: FolderKanban,
      tone: "bg-[#e8eef8] text-[#284f9e]",
      meter: (
        <SegmentMeter
          label="Project status distribution"
          segments={statusRows.map((row) => ({
            label: row.label,
            value: row.value,
            colorClass: row.colorClass,
          }))}
        />
      ),
    },
    {
      label: "In Progress",
      value: (totals?.inProgress ?? 0).toLocaleString("en-US"),
      caption: "Projects in progress",
      href:
        (totals?.inProgress ?? 0) > 0
          ? workspaceDirectoryHref({
              ...defaultWorkspaceDirectoryState,
              status: "IN_PROGRESS",
            })
          : undefined,
      icon: Activity,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <ProgressMeter
          value={totals?.inProgress ?? 0}
          max={totalProjects}
          label="In progress projects"
          colorClass={projectStatusColors.IN_PROGRESS.colorClass}
        />
      ),
    },
    {
      label: "Completed",
      value: (totals?.completed ?? 0).toLocaleString("en-US"),
      caption: "Projects completed",
      icon: CheckCircle2,
      tone: "bg-[#e8eef8] text-[#4169bd]",
      meter: (
        <ProgressMeter
          value={totals?.completed ?? 0}
          max={totalProjects}
          label="Completed projects"
          colorClass={projectStatusColors.COMPLETED.colorClass}
        />
      ),
    },
    {
      label: "On Hold",
      value: (totals?.onHold ?? 0).toLocaleString("en-US"),
      caption: "Projects on hold",
      href:
        (totals?.onHold ?? 0) > 0
          ? workspaceDirectoryHref({
              ...defaultWorkspaceDirectoryState,
              status: "ON_HOLD",
            })
          : undefined,
      icon: PauseCircle,
      tone: "bg-[#fbf0e2] text-[#a45b12]",
      meter: (
        <ProgressMeter
          value={totals?.onHold ?? 0}
          max={totalProjects}
          label="On hold projects"
          colorClass={projectStatusColors.ON_HOLD.colorClass}
        />
      ),
    },
  ]
  const upcomingRows =
    data?.upcomingDeadlines.map((task) => ({
      id: task.id,
      label: task.title,
      note: taskNote(task, formatDateOnly(task.dueDate)),
    })) ?? []
  const overdueRows =
    data?.overdueTaskList.map((task) => ({
      id: task.id,
      label: task.title,
      note: taskNote(task, formatDateOnly(task.dueDate)),
      tone: "danger" as const,
    })) ?? []

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Project overview"
    >
      <PageHeader
        title="Project Overview"
        description="Monitor project activity, delivery progress, and upcoming work across your department."
        actions={
          <PageHeaderButton asChild>
            <Link href="/project-workspace">Manage projects</Link>
          </PageHeaderButton>
        }
      />

      {error && (
        <Alert className="mt-[18px]">
          {error}
          {departmentId && (
            <Button
              className="ml-2"
              variant="outline"
              size="sm"
              onClick={resource.retry}
            >
              Try again
            </Button>
          )}
        </Alert>
      )}

      <div className="mt-[18px] grid gap-4 max-[560px]:mt-[14px]">
        <StatStrip
          items={primaryStats}
          label="Project overview"
          pending={loading}
          unavailable={unavailable}
        />
        <MiniStats
          label="Department project operations"
          loading={loading}
          items={[
            {
              label: "Workspace groups",
              value: unavailable
                ? "—"
                : (totals?.workspaceGroups ?? 0).toLocaleString("en-US"),
              hint: unavailable ? undefined : "Groups with department projects",
            },
            {
              label: "Projects with tasks",
              value: unavailable
                ? "—"
                : (totals?.projectsWithTasks ?? 0).toLocaleString("en-US"),
              hint: unavailable ? undefined : "At least one work-plan task",
            },
            {
              label: "Unplanned projects",
              value: unavailable
                ? "—"
                : (totals?.projectsWithoutTasks ?? 0).toLocaleString("en-US"),
              hint: unavailable ? undefined : "No work-plan tasks",
            },
            {
              label: "Outstanding tasks",
              value: unavailable
                ? "—"
                : (totals?.outstandingTasks ?? 0).toLocaleString("en-US"),
              hint: unavailable ? undefined : "Not marked complete",
            },
          ]}
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Project status distribution"
            description="All lifecycle statuses across individual projects"
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Project status data is unavailable.
              </p>
            ) : totalProjects === 0 && !loading ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                No department projects yet.
              </p>
            ) : (
              <div className="grid min-w-0 items-center gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <KpiDonutChart
                  label={`Project status distribution: ${statusSegments.map(({ label, value }) => `${label} ${value}`).join(", ")}`}
                  segments={statusSegments}
                  size="dashboard"
                />
                <BreakdownList
                  rows={statusRows}
                  total={totalProjects}
                  loading={loading}
                  unit="projects"
                  empty="No department projects yet."
                />
              </div>
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Workspace progress"
            description="Task-weighted completion across authorized projects"
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Workspace progress is unavailable.
              </p>
            ) : data && data.workspaceProgress.length > 0 ? (
              <div className="grid gap-4">
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-sm font-semibold text-[#182235]">
                      Overall completion
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[#182235] tabular-nums">
                      {completedTasks} / {totalTasks} tasks · {taskCompletion}%
                    </span>
                  </div>
                  <ProgressMeter
                    value={completedTasks}
                    max={totalTasks}
                    label="Task-weighted completion"
                    colorClass="bg-[#29906b]"
                  />
                </div>
                {plannedProgressRows.length > 0 && (
                  <div
                    role="group"
                    aria-label="Workspace completion by workspace"
                    className="grid gap-3.5"
                  >
                    <div
                      aria-hidden="true"
                      className="grid grid-cols-3 text-[10px] leading-none text-[#8a94a6] tabular-nums"
                    >
                      <span>0%</span>
                      <span className="text-center">50%</span>
                      <span className="text-right">100%</span>
                    </div>
                    <ul className="m-0 grid list-none gap-4 p-0">
                      {plannedProgressRows.map((workspace) => {
                        const progress = Math.round(
                          (workspace.completedTasks / workspace.totalTasks) *
                            100,
                        )
                        return (
                          <li key={workspace.identity} className="min-w-0">
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <Link
                                href={projectWorkspaceHref(workspace.identity)}
                                className="min-w-0 truncate font-medium text-[#203f8c] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
                              >
                                {workspace.name}
                              </Link>
                              <span className="shrink-0 text-[#738096] tabular-nums">
                                {workspace.completedTasks}/
                                {workspace.totalTasks} tasks · {progress}%
                              </span>
                            </div>
                            <div className="relative mt-1">
                              <ProgressMeter
                                value={workspace.completedTasks}
                                max={workspace.totalTasks}
                                label={`${workspace.name} task progress`}
                                colorClass="bg-[#29906b]"
                              />
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/80"
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {(totals?.projectsWithoutTasks ?? 0) > 0 && (
                  <KpiCards
                    label="Projects without work plans"
                    pending={false}
                    unavailable={false}
                    showCharts={false}
                    metrics={[
                      {
                        label: "Projects without work plans",
                        value: totals?.projectsWithoutTasks ?? 0,
                        formattedValue: `${totals?.projectsWithoutTasks.toLocaleString("en-US")} unplanned`,
                        description:
                          "Unplanned projects are excluded from task-weighted completion.",
                        icon: ClipboardList,
                        iconClassName: "text-[#738096]",
                      },
                    ]}
                  />
                )}
              </div>
            ) : loading ? (
              <BreakdownList
                rows={[]}
                loading
                unit="tasks"
                empty="No projects yet."
              />
            ) : (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                No projects yet.
              </p>
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Projects by client"
            description="Individual department projects by associated client"
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Client distribution is unavailable.
              </p>
            ) : (
              <BreakdownList
                rows={
                  data?.clientDistribution.map((client) => ({
                    id: client.id,
                    label: client.name,
                    value: client.projectCount,
                  })) ?? []
                }
                total={totalProjects}
                loading={loading}
                unit="projects"
                empty="No client projects yet."
                colorClass="bg-[#4169bd]"
              />
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Upcoming task deadlines"
            description="Unfinished tasks due within the next 14 days"
            action={
              !unavailable && !loading && totals?.upcomingTasks ? (
                <span className="text-[11px] font-medium text-[#738096]">
                  {totals.upcomingTasks} tasks
                </span>
              ) : undefined
            }
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Task deadline data is unavailable.
              </p>
            ) : (
              <ItemList
                rows={upcomingRows}
                loading={loading}
                empty="No task deadlines in the next 14 days."
              />
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Overdue tasks"
            description="Unfinished tasks with due dates before today"
            action={
              !unavailable && !loading && totals?.overdueTasks ? (
                <span className="text-[11px] font-semibold text-[#b4234d]">
                  {totals.overdueTasks} overdue
                </span>
              ) : undefined
            }
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Overdue task data is unavailable.
              </p>
            ) : (
              <ItemList
                rows={overdueRows}
                loading={loading}
                empty="No overdue tasks."
              />
            )}
          </OverviewPanel>
        </div>
      </div>
    </main>
  )
}
