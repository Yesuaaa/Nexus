"use client"

import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Flag,
  Layers3,
  UsersRound,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  ProjectTaskStatus,
  ProjectWorkspaceDetail,
} from "../api/project-workspace-api"

export function WorkspaceOverview({
  workspace,
  onStatus,
  onViewTeam,
  busy,
}: {
  workspace: ProjectWorkspaceDetail
  onStatus: (
    projectId: string,
    taskId: string,
    status: ProjectTaskStatus,
  ) => void
  onViewTeam: () => void
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
    .find((item) => !item.completedAt)
  const people = new Map(
    workspace.workstreams.flatMap((stream) =>
      (stream.staff ?? []).map((person) => [person.id, person] as const),
    ),
  )
  const roles = new Map<string, number>()
  for (const person of people.values()) {
    const role = person.position || "Staff"
    roles.set(role, (roles.get(role) ?? 0) + 1)
  }
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
            label: "Next milestone",
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
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          {workspace.workstreams.map((stream) => (
            <section
              key={stream.id}
              className="overflow-hidden rounded-xl border border-[#dfe5ec]"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 bg-[#edf1f5] px-5 py-4">
                <h2 className="m-0 text-sm font-semibold">
                  {workspace.workstreams.length > 1
                    ? stream.serviceName
                    : "Project plan"}{" "}
                  <span className="font-normal text-[#60718c]">
                    ({stream.plan?.phases.length ?? 0} phases)
                  </span>
                </h2>
                <span className="text-[11px] text-[#60718c]">
                  Completed tasks · Progress
                </span>
              </header>
              <div className="space-y-3 p-3">
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
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 bg-[#f7f9fc] px-4 py-4 text-xs marker:hidden focus-visible:outline-2 focus-visible:outline-[#294a9b] [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          size={16}
                          className="shrink-0 transition-transform group-open:rotate-90"
                        />
                        <strong className="min-w-0 flex-1">
                          {phase.title}
                        </strong>
                        <span className="w-12 text-center tabular-nums">
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
                        <table className="w-full min-w-[460px] text-left text-xs">
                          <thead className="text-[10px] text-[#60718c]">
                            <tr>
                              <th className="py-3 font-medium">Task</th>
                              <th className="px-3 py-3 font-medium">Status</th>
                              <th className="py-3 font-medium">Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {phase.tasks.map((task) => (
                              <tr
                                key={task.id}
                                className="border-t border-[#edf0f4]"
                              >
                                <td className="py-3">
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
                                <td className="px-3 py-3">
                                  <Select
                                    value={task.status}
                                    disabled={busy}
                                    onValueChange={(value) => {
                                      if (
                                        value === "DONE" ||
                                        value === "IN_PROGRESS" ||
                                        value === "NOT_STARTED"
                                      )
                                        onStatus(stream.id, task.id, value)
                                    }}
                                  >
                                    <SelectTrigger
                                      aria-label={`Status for ${task.title}`}
                                      className={`h-8 w-[130px] text-[11px] ${task.status === "DONE" ? "bg-[#e3f5e9] text-[#13743b]" : task.status === "IN_PROGRESS" ? "bg-[#e8efff] text-[#294c96]" : "bg-[#edf1f6] text-[#60718c]"}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NOT_STARTED">
                                        Not started
                                      </SelectItem>
                                      <SelectItem value="IN_PROGRESS">
                                        In progress
                                      </SelectItem>
                                      <SelectItem value="DONE">
                                        Complete
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="whitespace-nowrap py-3 text-[#738096]">
                                  Not set
                                </td>
                              </tr>
                            ))}
                          </tbody>
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
        <aside className="rounded-xl border border-[#dfe5ec] p-5 shadow-[0_2px_8px_rgb(24_41_68_/_4%)]">
          <h2 className="mt-0 text-sm font-semibold">Team</h2>
          {[...roles.entries()].map(([role, count]) => (
            <div
              key={role}
              className="flex items-center gap-3 border-b border-[#edf0f4] py-3 text-xs"
            >
              <UsersRound size={17} className="text-[#60718c]" />
              <span className="flex-1">{role}</span>
              <span className="rounded-md border border-[#dfe5ec] px-2 py-1">
                {count}
              </span>
            </div>
          ))}
          {!people.size && (
            <p className="text-xs leading-5 text-[#738096]">
              No staff assigned yet.
            </p>
          )}
          <button
            onClick={onViewTeam}
            className="mt-5 text-xs font-semibold text-[#294c96] hover:underline"
          >
            View team
          </button>
        </aside>
      </div>
    </>
  )
}
