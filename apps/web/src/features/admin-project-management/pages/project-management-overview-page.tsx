"use client"

import Link from "next/link"
import { Activity, CheckCircle2, FolderKanban, PauseCircle } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { MemberIdentity } from "@/components/ui/member-identity"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
} from "@/components/ui/overview-panel"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { ProgressMeter, SegmentMeter } from "@/components/ui/stat-strip"
import { Skeleton } from "@/components/ui/skeleton"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  projectStatusValues,
  type ProjectStatus,
} from "@/features/project-management/model/project-contracts"
import {
  statusLabel,
  statusTone,
} from "@/features/projects/model/project-status"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  getProjectManagementOverview,
  type ProjectManagementOverview,
} from "../api/project-management-api"

const projectStatusColors: Record<ProjectStatus, string> = {
  PLANNED: "#7088b5",
  IN_PROGRESS: "#29906b",
  ON_HOLD: "#c27625",
  COMPLETED: "#4169bd",
  CANCELLED: "#d81758",
}

const projectStatusBarClasses: Record<ProjectStatus, string> = {
  PLANNED: "bg-[#7088b5]",
  IN_PROGRESS: "bg-[#29906b]",
  ON_HOLD: "bg-[#c27625]",
  COMPLETED: "bg-[#4169bd]",
  CANCELLED: "bg-[#d81758]",
}

const projectUpdatesGridClass =
  "grid grid-cols-[minmax(0,1fr)_auto_96px] items-center gap-3 max-[700px]:grid-cols-[minmax(0,1fr)_auto]"

const emptyTotals: ProjectManagementOverview["totals"] = {
  totalProjects: 0,
  planned: 0,
  inProgress: 0,
  onHold: 0,
  completed: 0,
  cancelled: 0,
  workspaceGroups: 0,
  departmentsWithProjects: 0,
  projectsWithoutDepartment: 0,
  projectsWithTasks: 0,
  projectsWithoutTasks: 0,
  totalTasks: 0,
  completedTasks: 0,
  activeProjects: 0,
  activeProjectsWithoutLead: 0,
  activeProjectsWithoutTeam: 0,
  activeAssignments: 0,
}

function departmentStatusSummary(
  department: ProjectManagementOverview["departments"][number],
) {
  return [
    [department.planned, "planned"],
    [department.inProgress, "in progress"],
    [department.onHold, "on hold"],
    [department.completed, "completed"],
    [department.cancelled, "cancelled"],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" · ")
}

function departmentStatusSegments(
  department: ProjectManagementOverview["departments"][number],
) {
  const counts: Record<ProjectStatus, number> = {
    PLANNED: department.planned,
    IN_PROGRESS: department.inProgress,
    ON_HOLD: department.onHold,
    COMPLETED: department.completed,
    CANCELLED: department.cancelled,
  }
  return projectStatusValues.map((status) => ({
    label: statusLabel(status),
    value: counts[status],
    colorClass: projectStatusBarClasses[status],
  }))
}

function departmentHref(departmentId: string) {
  return `/project-management/departments/${encodeURIComponent(departmentId)}/projects`
}

function DepartmentBreakdown({
  data,
  loading,
  unavailable,
}: {
  data: ProjectManagementOverview | undefined
  loading: boolean
  unavailable: boolean
}) {
  if (unavailable)
    return (
      <EmptyState
        title="Department breakdown unavailable"
        description="Retry the overview to load department project counts."
        size="sm"
        role="status"
      />
    )

  const departments = data?.departments ?? []
  if (loading)
    return (
      <div className="grid" aria-busy="true">
        <span className="sr-only" role="status">
          Loading department comparisons…
        </span>
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            aria-hidden="true"
            className="grid gap-3 border-b border-[#eceef1] py-4 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
              <div className="grid gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )

  if (departments.length === 0)
    return (
      <p className="m-0 py-4 text-xs text-[#8a94a6]">
        No projects have been assigned to a department yet.
      </p>
    )

  return (
    <div>
      <ul
        aria-label="Project status legend"
        className="m-0 mb-2 flex list-none flex-wrap gap-x-4 gap-y-2 border-b border-[#eceef1] pb-3 pl-0"
      >
        {projectStatusValues.map((status) => (
          <li
            key={status}
            className="flex items-center gap-1.5 text-[10px] text-[#738096]"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-sm"
              style={{ backgroundColor: projectStatusColors[status] }}
            />
            {statusLabel(status)}
          </li>
        ))}
      </ul>
      <ul aria-label="Department comparisons" className="m-0 list-none p-0">
        {departments.map((department) => {
          const taskPercent = department.totalTasks
            ? Math.round(
                (department.completedTasks / department.totalTasks) * 100,
              )
            : 0
          return (
            <li
              key={department.departmentId ?? "unassigned"}
              className="border-b border-[#eceef1] py-4 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 items-baseline justify-between gap-4">
                {department.departmentId ? (
                  <Link
                    href={departmentHref(department.departmentId)}
                    className="min-w-0 break-words font-medium text-[#203f8c] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
                  >
                    {department.departmentName}
                  </Link>
                ) : (
                  <span className="min-w-0 break-words font-medium text-[#182235]">
                    {department.departmentName}
                  </span>
                )}
                <span className="shrink-0 text-xs text-[#738096] tabular-nums">
                  {department.projectCount.toLocaleString("en-US")}{" "}
                  {department.projectCount === 1 ? "project" : "projects"}
                </span>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                <div className="min-w-0">
                  <p className="m-0 text-[10px] font-medium text-[#65718a]">
                    Project status mix
                  </p>
                  <SegmentMeter
                    segments={departmentStatusSegments(department)}
                    label={`Project status mix for ${department.departmentName}`}
                  />
                  <p className="mt-1.5 mb-0 text-[10px] leading-4 text-[#8a94a6]">
                    {departmentStatusSummary(department) || "No projects"}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="m-0 text-[10px] font-medium text-[#65718a]">
                      Task completion
                    </p>
                    {department.totalTasks > 0 && (
                      <span className="text-[11px] font-medium text-[#4169bd] tabular-nums">
                        {taskPercent}%
                      </span>
                    )}
                  </div>
                  {department.totalTasks > 0 ? (
                    <>
                      <ProgressMeter
                        value={department.completedTasks}
                        max={department.totalTasks}
                        label={`${department.departmentName} task completion`}
                        colorClass="bg-[#4169bd]"
                      />
                      <p className="mt-1.5 mb-0 text-[10px] text-[#8a94a6] tabular-nums">
                        {department.completedTasks.toLocaleString("en-US")} of{" "}
                        {department.totalTasks.toLocaleString("en-US")} tasks
                        complete
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 mb-0 text-[10px] text-[#8a94a6]">
                      No planned tasks
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RecentProjectUpdates({
  data,
  loading,
  unavailable,
  formatDate,
}: {
  data: ProjectManagementOverview | undefined
  loading: boolean
  unavailable: boolean
  formatDate: (value: string) => string
}) {
  if (unavailable)
    return (
      <EmptyState
        title="Recent project updates unavailable"
        description="Retry the overview to load recent project updates."
        size="sm"
        role="status"
      />
    )

  const projects = data?.recentlyUpdatedProjects ?? []
  return (
    <ResponsiveDataTable label="Recently updated projects">
      <ResponsiveDataTableHeader rowClassName={projectUpdatesGridClass}>
        <ResponsiveDataTableColumnHeader>
          Project
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Status
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader className="text-right max-[700px]:hidden">
          Last updated
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>
      <ResponsiveDataTableBody>
        {loading ? (
          <DataTableSkeletonRows
            label="recent project updates"
            rows={4}
            rowClassName={cn(
              projectUpdatesGridClass,
              "min-h-[54px] px-4 py-2.5",
            )}
            cellClassNames={["min-w-0", "", "text-right max-[700px]:hidden"]}
            cellSkeletonClassNames={["h-3 w-4/5", "h-4 w-14", "h-3 w-20"]}
          />
        ) : projects.length === 0 ? (
          <ResponsiveDataTableRow>
            <ResponsiveDataTableCell
              aria-colspan={3}
              className="px-4 py-6 text-center text-xs text-[#8a94a6]"
            >
              No projects have been updated yet.
            </ResponsiveDataTableCell>
          </ResponsiveDataTableRow>
        ) : (
          projects.map((project) => (
            <ResponsiveDataTableRow
              key={project.id}
              className={cn(
                projectUpdatesGridClass,
                "min-h-[54px] border-b border-[#eceef1] bg-background px-4 py-2.5 last:border-b-0",
              )}
            >
              <ResponsiveDataTableCell className="min-w-0">
                <span
                  className="block break-words text-xs font-medium text-[#182235]"
                  title={project.name}
                >
                  {project.name}
                </span>
                <span className="mt-1 block text-[10px] text-[#8a94a6] min-[701px]:hidden">
                  {formatDate(project.updatedAt)}
                </span>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell>
                <Pill tone={statusTone(project.status)}>
                  {statusLabel(project.status)}
                </Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="text-right text-[11px] text-[#738096] tabular-nums max-[700px]:hidden">
                {formatDate(project.updatedAt)}
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ))
        )}
      </ResponsiveDataTableBody>
    </ResponsiveDataTable>
  )
}

export function ProjectManagementOverviewPage() {
  const { formatDate } = useDatePreferences()
  const overview = useAsyncResource(getProjectManagementOverview, [], {
    fallbackError: "Couldn't load company-wide project analytics.",
  })
  const data = overview.data
  const loading = overview.loading && !data
  const unavailable = Boolean(overview.error) && !data
  const totals = data?.totals ?? emptyTotals
  const statusSegments = (data?.statusDistribution ?? []).map((item) => ({
    label: statusLabel(item.status),
    value: item.count,
    color: projectStatusColors[item.status],
  }))
  const totalTasks = totals.totalTasks
  const completionPercent = totalTasks
    ? Math.round((totals.completedTasks / totalTasks) * 100)
    : 0
  const displayedStaffAssignments = (data?.topStaffAssignments ?? []).slice(
    0,
    6,
  )
  const maxDisplayedStaffAssignments = Math.max(
    0,
    ...displayedStaffAssignments.map((staff) => staff.activeProjects),
  )

  const kpis: KpiMetric[] = [
    {
      label: "Total projects",
      value: totals.totalProjects,
      description: "All departments and statuses",
      icon: FolderKanban,
      iconClassName: "text-[#284f9e]",
    },
    {
      label: "In progress",
      value: totals.inProgress,
      description: `${totals.activeProjects.toLocaleString("en-US")} active projects total`,
      icon: Activity,
      iconClassName: "text-[#25745b]",
    },
    {
      label: "Completed",
      value: totals.completed,
      description: "Completed project records",
      icon: CheckCircle2,
      iconClassName: "text-[#4169bd]",
    },
    {
      label: "On hold",
      value: totals.onHold,
      description: "Projects currently on hold",
      icon: PauseCircle,
      iconClassName: "text-[#805316]",
    },
  ]

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Project Management Overview"
    >
      <PageHeader
        title="Project Management Overview"
        description="Current project status, department distribution, work-plan progress, and active assignments across the company."
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/project-management">View project management</Link>
          </Button>
        }
      />
      {overview.error && (
        <Alert className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
          <span>{overview.error}</span>
          <Button
            type="button"
            variant="brandOutline"
            size="sm"
            onClick={overview.retry}
          >
            Try again
          </Button>
        </Alert>
      )}

      <div className="mt-[18px] grid min-w-0 gap-4 max-[560px]:mt-[14px]">
        <KpiCards
          metrics={kpis}
          label="Company-wide project summary"
          pending={loading}
          unavailable={unavailable}
          showCharts={false}
          className="grid-cols-4 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
        />
        <MiniStats
          label="Project management figures"
          loading={loading}
          items={[
            {
              label: "Workspace groups",
              value: unavailable
                ? "—"
                : totals.workspaceGroups.toLocaleString("en-US"),
              hint: "Persisted groups",
            },
            {
              label: "Departments with projects",
              value: unavailable
                ? "—"
                : totals.departmentsWithProjects.toLocaleString("en-US"),
              hint: "Based on accepted department",
            },
            {
              label: "Projects without a department",
              value: unavailable
                ? "—"
                : totals.projectsWithoutDepartment.toLocaleString("en-US"),
              hint: "Includes missing or unaccepted requests",
            },
            {
              label: "Active staff assignments",
              value: unavailable
                ? "—"
                : totals.activeAssignments.toLocaleString("en-US"),
              hint: "Planned, in progress, or on hold projects",
            },
          ]}
        />

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Project status distribution"
            description="Current status across individual project records."
          >
            {unavailable ? (
              <EmptyState
                title="Project status data unavailable"
                description="Retry the overview to load project status counts."
                size="sm"
                role="status"
              />
            ) : (
              <div className="grid min-w-0 items-center gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                {loading ? (
                  <Skeleton className="mx-auto size-40 rounded-full" />
                ) : totals.totalProjects > 0 ? (
                  <KpiDonutChart
                    label={`Project status distribution: ${(data?.statusDistribution ?? []).map(({ status, count }) => `${statusLabel(status)} ${count}`).join(", ")}`}
                    segments={statusSegments}
                    size="dashboard"
                  />
                ) : (
                  <p className="m-0 text-center text-xs text-[#8a94a6]">
                    No project records yet.
                  </p>
                )}
                <BreakdownList
                  rows={
                    totals.totalProjects > 0
                      ? (data?.statusDistribution ?? []).map((item) => ({
                          id: item.status,
                          label: statusLabel(item.status),
                          value: item.count,
                          colorClass: projectStatusBarClasses[item.status],
                        }))
                      : []
                  }
                  total={totals.totalProjects}
                  loading={loading}
                  unit="projects"
                  empty="No project records yet."
                />
              </div>
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Task progress"
            description="Completion across valid work-plan tasks from projects in every status. Projects without tasks are excluded from the task denominator."
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Work-plan progress is unavailable.
              </p>
            ) : loading ? (
              <div className="grid gap-3" aria-busy="true">
                <div className="flex items-end justify-between gap-3">
                  <div className="grid gap-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-14" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <MiniStats
                  label="Project work-plan coverage"
                  loading
                  items={[
                    { label: "Projects with tasks", value: "" },
                    { label: "Projects without tasks", value: "" },
                    { label: "Tasks completed", value: "" },
                    { label: "Tasks outstanding", value: "" },
                  ]}
                />
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-medium text-[#65718a]">
                        Overall task completion
                      </p>
                      <p className="mt-1 mb-0 text-[11px] text-[#738096] tabular-nums">
                        {totalTasks > 0
                          ? `${totals.completedTasks.toLocaleString("en-US")} of ${totalTasks.toLocaleString("en-US")} tasks complete`
                          : "No valid work-plan tasks are recorded yet."}
                      </p>
                    </div>
                    <span className="shrink-0 text-3xl leading-none font-semibold tracking-[-0.03em] text-[#182235] tabular-nums">
                      {totalTasks > 0 ? `${completionPercent}%` : "—"}
                    </span>
                  </div>
                  {totalTasks > 0 && (
                    <ProgressMeter
                      value={totals.completedTasks}
                      max={totalTasks}
                      label="Company-wide task completion"
                      colorClass="bg-[#29906b]"
                    />
                  )}
                </div>
                <MiniStats
                  label="Project work-plan coverage"
                  loading={loading}
                  items={[
                    {
                      label: "Projects with tasks",
                      value: totals.projectsWithTasks.toLocaleString("en-US"),
                    },
                    {
                      label: "Projects without tasks",
                      value:
                        totals.projectsWithoutTasks.toLocaleString("en-US"),
                    },
                    {
                      label: "Tasks completed",
                      value: totals.completedTasks.toLocaleString("en-US"),
                    },
                    {
                      label: "Tasks outstanding",
                      value: Math.max(
                        0,
                        totals.totalTasks - totals.completedTasks,
                      ).toLocaleString("en-US"),
                    },
                  ]}
                />
              </div>
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Projects by department"
            description="Projects are assigned by their accepted department; records without one are grouped as Unassigned."
            className="lg:col-span-2"
          >
            <DepartmentBreakdown
              data={data}
              loading={loading}
              unavailable={unavailable}
            />
          </OverviewPanel>

          <OverviewPanel
            title="Workload & staffing"
            description="Active includes planned, in progress, and on hold. Assignment bars compare counts among the staff shown, not utilization."
          >
            {unavailable ? (
              <p className="m-0 text-xs leading-5 text-[#8a94a6]">
                Assignment figures are unavailable.
              </p>
            ) : (
              <div className="grid gap-4">
                <MiniStats
                  label="Active workload coverage"
                  loading={loading}
                  columns={2}
                  items={[
                    {
                      label: "Active projects",
                      value: totals.activeProjects.toLocaleString("en-US"),
                    },
                    {
                      label: "Active staff assignments",
                      value: totals.activeAssignments.toLocaleString("en-US"),
                    },
                    {
                      label: "Projects without a team lead",
                      value:
                        totals.activeProjectsWithoutLead.toLocaleString(
                          "en-US",
                        ),
                      emphasis:
                        totals.activeProjectsWithoutLead > 0
                          ? "attention"
                          : undefined,
                    },
                    {
                      label: "Projects without team members",
                      value:
                        totals.activeProjectsWithoutTeam.toLocaleString(
                          "en-US",
                        ),
                      emphasis:
                        totals.activeProjectsWithoutTeam > 0
                          ? "attention"
                          : undefined,
                    },
                  ]}
                />
                <div className="border-t border-[#eceef1] pt-4">
                  <h3 className="m-0 text-xs font-semibold text-[#182235]">
                    Assignment distribution
                  </h3>
                  <p className="mt-1 mb-3 text-[11px] leading-4 text-[#8a94a6]">
                    Bars compare active project assignments among the staff
                    shown.
                  </p>
                  {displayedStaffAssignments.length === 0 ? (
                    <ItemList
                      rows={[]}
                      loading={loading}
                      empty="No active project assignments yet."
                    />
                  ) : (
                    <ul
                      aria-label="Staff active project assignment comparison"
                      className="m-0 grid list-none gap-3 p-0"
                    >
                      {displayedStaffAssignments.map((staff) => (
                        <li key={staff.employeeId} className="min-w-0">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0" title={staff.fullName}>
                              <MemberIdentity
                                member={{ fullName: staff.fullName }}
                                secondaryText={
                                  staff.leadProjects > 0
                                    ? `Team lead on ${staff.leadProjects} ${staff.leadProjects === 1 ? "project" : "projects"}`
                                    : null
                                }
                              />
                            </div>
                            <span className="shrink-0 text-xs text-[#738096] tabular-nums">
                              {staff.activeProjects.toLocaleString("en-US")}{" "}
                              {staff.activeProjects === 1
                                ? "project"
                                : "projects"}
                            </span>
                          </div>
                          {maxDisplayedStaffAssignments > 0 && (
                            <ProgressMeter
                              value={staff.activeProjects}
                              max={maxDisplayedStaffAssignments}
                              label={`Relative active project assignments for ${staff.fullName}; compared with the highest count shown`}
                              colorClass="bg-[#4169bd]"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </OverviewPanel>

          <OverviewPanel
            title="Recently updated projects"
            description="Latest recorded project updates by timestamp."
          >
            <RecentProjectUpdates
              data={data}
              loading={loading}
              unavailable={unavailable}
              formatDate={formatDate}
            />
          </OverviewPanel>
        </div>
      </div>
    </main>
  )
}
