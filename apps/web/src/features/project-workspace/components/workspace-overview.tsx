"use client"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { TaskRowActions } from "./task-row-actions"

import { CheckCircle2, ChevronRight, Circle, Flag, Layers3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"

export function WorkspaceOverview({
  workspace,
  onUpdated,
  onEditPlan,
  busy,
}: {
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  onEditPlan: (stream: ProjectWorkspaceDetail["workstreams"][number]) => void
  busy: boolean
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
  const milestone = workspace.workstreams
    .flatMap((stream) => stream.milestones ?? [])
    .find((item) => item.deliveryStatus !== "SENT_TO_CLIENT")
  return (
    <>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Tasks complete",
            value: `${done} / ${tasks.length}`,
            icon: CheckCircle2,
          },
          {
            label: "Phases complete",
            value: `${completedPhases} / ${phases.length}`,
            icon: Layers3,
          },
          {
            label: "Next deliverable",
            value: milestone?.title || "No pending milestone",
            icon: Flag,
          },
        ].map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border border-[#dfe5ec] bg-[#fbfcfd] p-5 shadow-[0_2px_8px_rgb(24_41_68_/_4%)]"
          >
            <p className="m-0 flex items-center gap-2 text-xs text-[#60718c]">
              <Icon size={18} className="text-[#3153a5]" />
              {label}
            </p>
            <p className="mt-3 mb-0 text-xl font-semibold tracking-tight text-[#142037]">
              {value}
            </p>
          </article>
        ))}
      </div>
      <div className="min-w-0">
        <div className="min-w-0 space-y-5">
          {workspace.workstreams.map((stream) => (
            <section
              key={stream.id}
              className="overflow-hidden rounded-xl border border-[#dfe5ec]"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 bg-[#edf1f5] px-5 py-4">
                <h2 className="m-0 text-sm font-semibold">
                  {workspace.workstreams.length > 1
                    ? stream.serviceName
                    : "Project plan"}{" "}
                  <span className="font-normal text-[#60718c]">
                    ({stream.plan?.phases.length ?? 0} phases)
                  </span>
                </h2>
                <Button
                  variant="outline"
                  disabled={busy}
                  className="h-8 text-xs"
                  onClick={() => onEditPlan(stream)}
                >
                  {workspace.workstreams.length > 1
                    ? `Edit ${stream.serviceName}`
                    : "Edit project plan"}
                </Button>
              </header>
              <div className="space-y-3 p-3">
                {stream.plan && (
                  <div
                    className="grid grid-cols-[16px_minmax(0,1fr)_100px_96px_36px] items-center gap-3 px-[17px] py-1 text-[11px] font-semibold text-[#60718c]"
                    aria-hidden="true"
                  >
                    <span className="col-span-2">Phase</span>
                    <span className="text-center">Tasks complete</span>
                    <span className="col-span-2 text-center">Progress</span>
                  </div>
                )}
                {!stream.plan && (
                  <p className="p-3 text-xs text-[#738096]">
                    A delivery template has not been selected yet.
                  </p>
                )}
                {stream.plan?.phases.map((phase, index) => {
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
                      className="group overflow-hidden rounded-lg border border-[#dfe5ec]"
                    >
                      <summary className="grid cursor-pointer list-none grid-cols-[16px_minmax(0,1fr)_100px_96px_36px] items-center gap-3 bg-[#f7f9fc] px-4 py-4 text-xs marker:hidden focus-visible:outline-2 focus-visible:outline-[#294a9b] [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          size={16}
                          className="shrink-0 transition-transform group-open:rotate-90"
                        />
                        <strong className="min-w-0 flex-1">
                          {phase.title}
                        </strong>
                        <span
                          className="text-center tabular-nums"
                          aria-label={`${count} of ${phase.tasks.length} tasks complete`}
                        >
                          {count} / {phase.tasks.length}
                        </span>
                        <div
                          className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e1e6ee]"
                          role="progressbar"
                          aria-label={`${phase.title} progress`}
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-[#294c96]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="w-9 text-right tabular-nums text-[#60718c]">
                          {percent}%
                        </span>
                      </summary>
                      <div className="overflow-x-auto px-4 pb-3">
                        <table className="w-full min-w-[900px] table-fixed text-left text-xs">
                          <colgroup>
                            <col />
                            <col className="w-[22%]" />
                            <col className="w-[15%]" />
                            <col className="w-[14%]" />
                            <col className="w-[96px]" />
                          </colgroup>
                          <thead className="bg-[#e8edf2] text-[11px] text-[#182235]">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-3 font-semibold"
                              >
                                Task
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3 text-center font-semibold"
                              >
                                Assigned staff
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3 text-center font-semibold"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3 text-center font-semibold"
                              >
                                Due
                              </th>
                              <th
                                scope="col"
                                className="px-3 py-3 text-center font-semibold"
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <AnimatedTableBody
                            items={phase.tasks}
                            viewKey={JSON.stringify(
                              phase.tasks.map((task) => [
                                task.id,
                                task.status,
                                task.employeeId,
                                task.dueDate,
                              ]),
                            )}
                            columns={5}
                            rowClassName="border-t border-[#edf0f4]"
                            emptyContent="No tasks in this phase yet."
                            renderRow={(task) => (
                              <>
                                {" "}
                                <td className="px-4 py-3">
                                  <div className="flex items-start gap-2">
                                    {task.status === "DONE" ? (
                                      <CheckCircle2
                                        size={16}
                                        className="shrink-0 text-green-700"
                                      />
                                    ) : (
                                      <Circle
                                        size={16}
                                        className={`shrink-0 ${task.status === "IN_PROGRESS" ? "text-blue-600" : "text-[#94a3b8]"}`}
                                      />
                                    )}
                                    <div>
                                      <p className="m-0">{task.title}</p>
                                      <p className="mt-1 mb-0 text-[10px] text-[#738096]">
                                        {task.role}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center align-middle text-[#60718c]">
                                  {stream.staff?.find(
                                    (person) => person.id === task.employeeId,
                                  )?.fullName || "Unassigned"}
                                </td>
                                <td className="px-3 py-3 text-center align-middle">
                                  <span
                                    className={`inline-flex rounded-md px-2 py-1 text-[10px] ${task.status === "DONE" ? "bg-[#e3f5e9] text-[#13743b]" : task.status === "IN_PROGRESS" ? "bg-[#fff1d4] text-[#946000]" : "bg-[#edf1f6] text-[#60718c]"}`}
                                  >
                                    {task.status === "DONE"
                                      ? "Complete"
                                      : task.status === "IN_PROGRESS"
                                        ? "In progress"
                                        : "Not started"}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-center align-middle text-[#738096]">
                                  {task.dueDate
                                    ? new Date(
                                        `${task.dueDate}T00:00:00`,
                                      ).toLocaleDateString()
                                    : "Not set"}
                                </td>
                                <td className="px-3 py-3 text-center align-middle">
                                  <TaskRowActions
                                    workspaceId={workspace.id}
                                    stream={stream}
                                    task={task}
                                    onUpdated={onUpdated}
                                    disabled={busy}
                                  />
                                </td>
                              </>
                            )}
                          />
                        </table>
                        {!phase.tasks.length && (
                          <p className="text-xs text-[#738096]">
                            No tasks in this phase yet.
                          </p>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
