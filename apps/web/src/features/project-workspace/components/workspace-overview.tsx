"use client"

import { CheckCircle2, ChevronRight, Circle, Flag, Layers3 } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { OverviewPanel } from "@/components/ui/overview-panel"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { ProgressMeter, StatStrip } from "@/components/ui/stat-strip"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import type {
  ProjectWorkspaceDetail,
  ProjectWorkPlan,
} from "../api/project-workspace-api"
import { taskStatusLabels, taskStatusTones } from "../model/task-status"
import { TaskRowActions } from "./task-row-actions"

type Workstream = ProjectWorkspaceDetail["workstreams"][number]
type Phase = ProjectWorkPlan["phases"][number]

const taskGrid =
  "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(90px,.7fr)_minmax(92px,.8fr)_64px] items-center gap-3 @max-[540px]:grid-cols-[minmax(0,1fr)_auto]"

function PhaseTasks({
  phase,
  stream,
  workspaceId,
  onUpdated,
  busy,
  readOnly,
}: {
  phase: Phase
  stream: Workstream
  workspaceId: string
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  busy: boolean
  readOnly: boolean
}) {
  const { formatDateOnly } = useDatePreferences()
  const labels = ["Task", "Assigned staff", "Status", "Due", "Actions"]
  const rowGrid = cn(
    taskGrid,
    readOnly &&
      "@min-[541px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(90px,.7fr)_minmax(92px,.8fr)]",
  )

  return (
    <ResponsiveDataTable
      label={`${phase.title} tasks`}
      className="rounded-none border-0"
    >
      <ResponsiveDataTableHeader
        className="@max-[540px]:sr-only"
        rowClassName={rowGrid}
      >
        {(readOnly ? labels.slice(0, -1) : labels).map((label) => (
          <ResponsiveDataTableColumnHeader key={label}>
            {label}
          </ResponsiveDataTableColumnHeader>
        ))}
      </ResponsiveDataTableHeader>
      <AnimatedSlotGridBody
        items={phase.tasks}
        getKey={(task) => task.id}
        viewKey={phase.id}
        animateRows={false}
        autoRowHeight
        rowClassName={(_task, _index, isLast) =>
          cn(
            rowGrid,
            "min-h-[52px] px-4 py-2.5 text-xs hover:bg-[#f8fafd]",
            !isLast && "border-b border-[#eceef1]",
          )
        }
        emptyContent="No tasks in this phase yet."
        renderRow={(task) => (
          <>
            <ResponsiveDataTableCell className="min-w-0 @max-[540px]:col-start-1 @max-[540px]:row-start-1">
              <div className="flex items-start gap-2">
                {task.status === "DONE" ? (
                  <CheckCircle2
                    size={16}
                    className="shrink-0 text-green-700"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={16}
                    className={cn(
                      "shrink-0 text-[#94a3b8]",
                      task.status === "IN_PROGRESS" && "text-blue-600",
                    )}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="m-0 font-medium">{task.title}</p>
                  <p className="mt-1 mb-0 text-[11px] text-[#65718a]">
                    {task.role}
                  </p>
                </div>
              </div>
            </ResponsiveDataTableCell>
            <ResponsiveDataTableCell className="min-w-0 break-words text-[#65718a] @max-[540px]:col-span-2">
              <span className="hidden font-medium @max-[540px]:inline">
                Assigned staff:{" "}
              </span>
              {stream.staff?.find((person) => person.id === task.employeeId)
                ?.fullName || "Unassigned"}
            </ResponsiveDataTableCell>
            <ResponsiveDataTableCell className="@max-[540px]:col-span-2">
              <span className="mr-1 hidden font-medium text-[#65718a] @max-[540px]:inline">
                Status:
              </span>
              <Pill tone={taskStatusTones[task.status]}>
                {taskStatusLabels[task.status]}
              </Pill>
            </ResponsiveDataTableCell>
            <ResponsiveDataTableCell className="text-[#65718a] @max-[540px]:col-span-2">
              <span className="hidden font-medium @max-[540px]:inline">
                Due:{" "}
              </span>
              {task.dueDate ? (
                <time dateTime={task.dueDate}>
                  {formatDateOnly(task.dueDate)}
                </time>
              ) : (
                "Not set"
              )}
            </ResponsiveDataTableCell>
            {!readOnly && (
              <ResponsiveDataTableCell className="justify-self-end @max-[540px]:col-start-2 @max-[540px]:row-start-1">
                <TaskRowActions
                  workspaceId={workspaceId}
                  stream={stream}
                  task={task}
                  onUpdated={onUpdated}
                  disabled={busy}
                />
              </ResponsiveDataTableCell>
            )}
          </>
        )}
      />
    </ResponsiveDataTable>
  )
}

export function WorkspaceOverview({
  workspace,
  onUpdated,
  onEditPlan,
  busy,
  readOnly = false,
}: {
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  onEditPlan: (stream: Workstream) => void
  busy: boolean
  readOnly?: boolean
}) {
  const phases = workspace.workstreams.flatMap(
    (stream) => stream.plan?.phases ?? [],
  )
  const tasks = phases.flatMap((phase) => phase.tasks)
  const done = tasks.filter((task) => task.status === "DONE").length
  const completedPhases = phases.filter(
    (phase) =>
      phase.tasks.length > 0 &&
      phase.tasks.every((task) => task.status === "DONE"),
  ).length
  const nextWorkstream = workspace.workstreams.find((stream) =>
    stream.milestones?.some((item) => item.deliveryStatus !== "SENT_TO_CLIENT"),
  )
  const milestone = nextWorkstream?.milestones?.find(
    (item) => item.deliveryStatus !== "SENT_TO_CLIENT",
  )
  return (
    <div className="grid min-w-0 gap-5">
      <StatStrip
        label="Work plan summary"
        pending={false}
        unavailable={false}
        compact
        className="grid-cols-3 max-[1050px]:grid-cols-3 max-[650px]:grid-cols-1"
        items={[
          {
            label: "Tasks complete",
            value: `${done} / ${tasks.length}`,
            caption: `${tasks.length - done} remaining`,
            icon: CheckCircle2,
            tone: "bg-[#e8f3ed] text-[#267449]",
          },
          {
            label: "Phases complete",
            value: `${completedPhases} / ${phases.length}`,
            caption: `${phases.length - completedPhases} remaining`,
            icon: Layers3,
            tone: "bg-[#e7eefb] text-[#294c96]",
          },
          {
            label: "Next deliverable",
            value: milestone?.title || "None pending",
            caption: nextWorkstream?.serviceName ?? "No pending milestone",
            icon: Flag,
            tone: "bg-[#fff2e2] text-[#986018]",
          },
        ]}
      />
      {workspace.workstreams.map((stream) => (
        <OverviewPanel
          key={stream.id}
          title={
            workspace.workstreams.length > 1
              ? stream.serviceName
              : "Project plan"
          }
          description={
            stream.plan
              ? `${stream.plan.phases.length} ${stream.plan.phases.length === 1 ? "phase" : "phases"}`
              : undefined
          }
          action={
            !readOnly && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onEditPlan(stream)}
              >
                {workspace.workstreams.length > 1
                  ? `Edit ${stream.serviceName}`
                  : "Edit project plan"}
              </Button>
            )
          }
        >
          {stream.plan?.phases.length ? (
            <div className="grid gap-3">
              {stream.plan.phases.map((phase, index) => {
                const count = phase.tasks.filter(
                  (task) => task.status === "DONE",
                ).length
                const percent = phase.tasks.length
                  ? Math.round((count / phase.tasks.length) * 100)
                  : 0
                return (
                  <details
                    key={phase.id}
                    open={index === 0}
                    className="group rounded-lg border border-[#e8ebef]"
                  >
                    <summary
                      className={cn(
                        "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3 text-xs marker:hidden hover:bg-[#f8fafd] group-open:rounded-b-none group-open:border-b group-open:border-[#e8ebef] [&::-webkit-details-marker]:hidden",
                        focusRing,
                      )}
                    >
                      <ChevronRight
                        size={16}
                        className="shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                      <strong className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {phase.title}
                      </strong>
                      <span
                        className="text-[#65718a] tabular-nums"
                        aria-label={`${count} of ${phase.tasks.length} tasks complete`}
                      >
                        {count} / {phase.tasks.length} tasks
                      </span>
                      <span className="w-16 max-[450px]:hidden">
                        <ProgressMeter
                          value={percent}
                          max={100}
                          label={`${phase.title} progress`}
                          colorClass="bg-[#294c96]"
                        />
                      </span>
                      <span className="w-9 text-right text-[#65718a] tabular-nums">
                        {percent}%
                      </span>
                    </summary>
                    <PhaseTasks
                      phase={phase}
                      stream={stream}
                      workspaceId={workspace.id}
                      onUpdated={onUpdated}
                      busy={busy}
                      readOnly={readOnly}
                    />
                  </details>
                )
              })}
            </div>
          ) : (
            <EmptyState
              size="sm"
              title={
                stream.plan
                  ? "No phases in this plan"
                  : "A delivery template has not been selected yet."
              }
            />
          )}
        </OverviewPanel>
      ))}
    </div>
  )
}
