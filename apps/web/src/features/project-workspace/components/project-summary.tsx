"use client"

import {
  Activity,
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  Layers3,
  UsersRound,
} from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { OverviewPanel } from "@/components/ui/overview-panel"
import { Pill } from "@/components/ui/pill"
import { ProgressMeter, StatStrip } from "@/components/ui/stat-strip"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { statusTone } from "@/features/projects/model/project-status"
import { humanizeEnum } from "@/lib/format"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"
import { taskStatusLabels, taskStatusTones } from "../model/task-status"

export function ProjectSummary({
  workspace,
  onViewTeam,
  onViewDeliverables,
  onViewWork,
  onViewActivity,
}: {
  workspace: ProjectWorkspaceDetail
  onViewTeam: () => void
  onViewDeliverables: () => void
  onViewWork: () => void
  onViewActivity: () => void
}) {
  const { formatDate, formatDateOnly, formatDateTime, timeZone } =
    useDatePreferences()
  const phases = workspace.workstreams.flatMap((stream) =>
    (stream.plan?.phases ?? []).map((phase) => ({ ...phase, stream })),
  )
  const tasks = phases.flatMap((phase) =>
    phase.tasks.map((task) => ({ ...task, stream: phase.stream })),
  )
  const completed = tasks.filter((task) => task.status === "DONE").length
  const percent = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0
  const completedPhases = phases.filter(
    (phase) =>
      phase.tasks.length > 0 &&
      phase.tasks.every((task) => task.status === "DONE"),
  ).length
  const deliverables = workspace.workstreams.flatMap(
    (stream) => stream.milestones ?? [],
  )
  const sent = deliverables.filter(
    (item) => item.deliveryStatus === "SENT_TO_CLIENT",
  ).length
  const staff = [
    ...new Map(
      workspace.workstreams.flatMap((stream) =>
        (stream.staff ?? []).map((person) => [person.id, person] as const),
      ),
    ).values(),
  ]
  const leads = [
    ...new Map(
      workspace.workstreams.flatMap((stream) =>
        (stream.staff ?? [])
          .filter((person) => person.isTeamLead)
          .map((person) => [person.id, person] as const),
      ),
    ).values(),
  ]
  const dates = workspace.workstreams
    .flatMap((stream) => (stream.startDate ? [stream.startDate] : []))
    .sort()
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const upcoming = tasks
    .filter(
      (task) =>
        task.status !== "DONE" &&
        task.dueDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) &&
        task.dueDate >= today,
    )
    .sort(
      (a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 5)
  const recent = [...workspace.activity]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
  const action = (label: string, onClick: () => void) => (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      {label}
    </Button>
  )
  return (
    <div className="space-y-4">
      <StatStrip
        label="Project summary"
        className="max-[560px]:grid-cols-2 [&>article>div]:h-full"
        wrapLabels
        pending={false}
        unavailable={false}
        items={[
          {
            label: "Overall progress",
            value: tasks.length ? `${percent}%` : "—",
            caption: `${completed} of ${tasks.length} tasks complete`,
            icon: CheckCircle2,
            tone: "bg-[#edf3fc] text-[#294c96]",
            ...(tasks.length
              ? {
                  meter: (
                    <ProgressMeter
                      value={completed}
                      max={tasks.length}
                      label="Overall task progress"
                      colorClass="bg-[#294c96]"
                    />
                  ),
                }
              : {}),
          },
          {
            label: "Phases",
            value: `${completedPhases} / ${phases.length}`,
            caption: "Completed",
            icon: Layers3,
            tone: "bg-[#edf3fc] text-[#294c96]",
          },
          {
            label: "Deliverables",
            value: `${sent} / ${deliverables.length}`,
            caption: "Sent to client",
            icon: ClipboardList,
            tone: "bg-[#edf3fc] text-[#294c96]",
          },
          {
            label: "Assigned team",
            value: String(staff.length),
            caption: "Members",
            icon: UsersRound,
            tone: "bg-[#edf3fc] text-[#294c96]",
          },
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <OverviewPanel
          title="Phase progress"
          variant="compact"
          action={action("View work", onViewWork)}
        >
          {phases.length ? (
            <ul className="m-0 grid list-none gap-4 p-0">
              {phases.map((phase) => {
                const done = phase.tasks.filter(
                  (task) => task.status === "DONE",
                ).length
                return (
                  <li
                    key={`${phase.stream.id}:${phase.id}`}
                    className="min-w-0"
                  >
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="min-w-0 break-words font-medium">
                        {phase.title}
                        {workspace.workstreams.length > 1 && (
                          <span className="ml-2 font-normal text-[#65718a]">
                            {phase.stream.serviceName}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[#65718a]">
                        {phase.tasks.length
                          ? `${Math.round((done / phase.tasks.length) * 100)}%`
                          : "No tasks"}
                      </span>
                    </div>
                    {phase.tasks.length > 0 && (
                      <>
                        <ProgressMeter
                          value={done}
                          max={phase.tasks.length}
                          label={`${phase.title} progress`}
                          colorClass="bg-[#294c96]"
                        />
                        <p className="mt-1 text-[11px] text-[#65718a]">
                          {done} of {phase.tasks.length} tasks complete
                        </p>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              description="No project phases have been planned yet."
            />
          )}
        </OverviewPanel>
        <OverviewPanel title="Project details" variant="compact">
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-xs">
            <dt className="text-[#65718a]">Client</dt>
            <dd className="m-0 break-words">
              {workspace.client.fullName || "Client"}
            </dd>
            <dt className="text-[#65718a]">Services</dt>
            <dd className="m-0 break-words">
              {workspace.workstreams
                .map((stream) => stream.serviceName)
                .join(", ") || "Not specified"}
            </dd>
            <dt className="text-[#65718a]">Status</dt>
            <dd className="m-0">
              <Pill tone={statusTone(workspace.status)}>
                {humanizeEnum(workspace.status, { capitalize: false })}
              </Pill>
            </dd>
            <dt className="text-[#65718a]">Started</dt>
            <dd className="m-0">
              {dates[0] ? formatDate(dates[0]) : "Not started"}
            </dd>
            {leads.length > 0 && (
              <>
                <dt className="text-[#65718a]">
                  Team lead{leads.length > 1 ? "s" : ""}
                </dt>
                <dd className="m-0 break-words">
                  {leads.map((person) => person.fullName).join(", ")}
                </dd>
              </>
            )}
          </dl>
          <h3 className="mt-5 text-xs font-semibold">Project scope</h3>
          {workspace.workstreams.length ? (
            workspace.workstreams.map((stream) => (
              <div key={stream.id} className="mt-2">
                {workspace.workstreams.length > 1 && (
                  <p className="mb-1 text-xs font-medium">
                    {stream.serviceName}
                  </p>
                )}
                <p className="m-0 whitespace-pre-wrap break-words text-xs leading-5 text-[#60718c]">
                  {stream.description ||
                    "No project description has been provided."}
                </p>
              </div>
            ))
          ) : (
            <p className="mt-2 text-xs text-[#65718a]">
              No project description has been provided.
            </p>
          )}
        </OverviewPanel>
        <OverviewPanel
          title="Upcoming tasks"
          variant="compact"
          action={action("View work", onViewWork)}
        >
          {upcoming.length ? (
            <ul className="m-0 list-none divide-y divide-[#edf0f4] p-0">
              {upcoming.map((task) => {
                const assignee = task.stream.staff?.find(
                  (person) => person.id === task.employeeId,
                )
                return (
                  <li
                    key={`${task.stream.id}:${task.id}`}
                    className="flex min-w-0 items-center gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="m-0 break-words font-medium">
                        {task.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Pill tone={taskStatusTones[task.status]}>
                          {taskStatusLabels[task.status]}
                        </Pill>
                        {assignee && (
                          <span className="flex items-center gap-1 text-[#65718a]">
                            <Avatar name={assignee.fullName} size="sm" />
                            {assignee.fullName}
                          </span>
                        )}
                      </div>
                    </div>
                    <time
                      className="shrink-0 text-[#65718a]"
                      dateTime={task.dueDate ?? undefined}
                    >
                      {formatDateOnly(task.dueDate!)}
                    </time>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              description="No upcoming incomplete tasks with due dates."
            />
          )}
        </OverviewPanel>
        <OverviewPanel
          title="Assigned team"
          variant="compact"
          action={action("View team", onViewTeam)}
        >
          {staff.length ? (
            <ul className="m-0 list-none divide-y divide-[#edf0f4] p-0">
              {staff.slice(0, 5).map((person) => (
                <li key={person.id} className="flex items-center gap-3 py-2">
                  <Avatar name={person.fullName} />
                  <div className="min-w-0 text-xs">
                    <p className="m-0 break-words font-medium">
                      {person.fullName}
                    </p>
                    <p className="mt-1 text-[#65718a]">
                      {person.position || "Staff"}
                      {leads.some((lead) => lead.id === person.id)
                        ? " · Team lead"
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState size="sm" description="No staff assigned yet." />
          )}
        </OverviewPanel>
        <OverviewPanel
          title="Recent activity"
          variant="compact"
          className="lg:col-span-2"
          action={action("View all activity", onViewActivity)}
        >
          {recent.length ? (
            <ol className="m-0 list-none divide-y divide-[#edf0f4] p-0">
              {recent.map((event) => {
                const Icon =
                  event.type === "STAFFING_APPROVED"
                    ? UsersRound
                    : event.type.includes("TASK") ||
                        event.type.includes("MILESTONE")
                      ? CheckCircle2
                      : FilePenLine
                return (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 py-2.5 text-xs"
                  >
                    <Icon
                      size={16}
                      className="mt-0.5 shrink-0 text-[#294c96]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {event.actor?.fullName || "System"}
                      </span>
                      <p className="mt-1 mb-0 whitespace-pre-wrap break-words text-[#60718c]">
                        {event.summary}
                      </p>
                    </div>
                    <time
                      dateTime={event.createdAt}
                      className="shrink-0 text-[#65718a]"
                    >
                      {formatDateTime(event.createdAt)}
                    </time>
                  </li>
                )
              })}
            </ol>
          ) : (
            <EmptyState
              size="sm"
              icon={Activity}
              description="No project activity yet."
            />
          )}
        </OverviewPanel>
      </div>
      <div className="flex justify-end">
        {action("View deliverables", onViewDeliverables)}
      </div>
    </div>
  )
}
