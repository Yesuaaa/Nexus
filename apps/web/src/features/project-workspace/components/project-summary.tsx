import { ArrowRight, CheckCircle2, Circle } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { pillToneClass } from "@/components/ui/pill"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { statusTone } from "@/features/projects/model/project-status"
import { humanizeEnum } from "@/lib/format"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"
import {
  deliverableStatusClass,
  deliverableStatusLabel,
} from "./deliverable-status"

export function ProjectSummary({
  workspace,
  onViewTeam,
  onViewDeliverables,
}: {
  workspace: ProjectWorkspaceDetail
  onViewTeam: () => void
  onViewDeliverables: () => void
}) {
  const tasks = workspace.workstreams.flatMap(
    (stream) => stream.plan?.phases.flatMap((phase) => phase.tasks) ?? [],
  )
  const done = tasks.filter((task) => task.status === "DONE").length
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const staff = [
    ...new Map(
      workspace.workstreams.flatMap((stream) =>
        (stream.staff ?? []).map((person) => [person.id, person] as const),
      ),
    ).values(),
  ]
  const dates = workspace.workstreams
    .flatMap((stream) => (stream.startDate ? [stream.startDate] : []))
    .sort()
  return (
    <div className="space-y-5">
      <section
        className="grid overflow-hidden rounded-xl border border-[#dfe5ec] bg-[#fbfcfd] shadow-[0_2px_8px_rgb(24_41_68_/_4%)] lg:grid-cols-[minmax(0,1fr)_320px]"
        aria-labelledby="project-details-heading"
      >
        <div className="p-5 sm:p-6">
          <h2
            id="project-details-heading"
            className="mt-0 mb-5 text-sm font-semibold"
          >
            Project details
          </h2>
          <dl className="m-0 grid gap-x-8 gap-y-5 text-xs sm:grid-cols-2">
            {[
              ["Client", workspace.client.fullName || "Client"],
              [
                "Services",
                workspace.workstreams
                  .map((stream) => stream.serviceName)
                  .join(", "),
              ],
              ["Status", humanizeEnum(workspace.status, { capitalize: false })],
              [
                "Started",
                dates[0]
                  ? new Date(dates[0]).toLocaleDateString()
                  : "Not started",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[#738096]">{label}</dt>
                <dd className="m-0 mt-1.5 leading-5 font-medium">
                  {label === "Status" ? (
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] capitalize ${pillToneClass(statusTone(workspace.status))}`}
                    >
                      {value}
                    </span>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col justify-center border-t border-[#e5e9ef] bg-[#f5f7fb] p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <p className="m-0 text-xs font-medium text-[#60718c]">
            Overall task progress
          </p>
          <p className="mt-3 mb-2 text-[32px] leading-none font-semibold tracking-tight text-[#203f8c]">
            {percent}
            <span className="text-xl">%</span>
          </p>
          <p className="mt-0 mb-4 text-xs text-[#738096]">
            {done} of {tasks.length} tasks complete
          </p>
          <ProgressMeter
            value={percent}
            max={100}
            label="Overall task progress"
            colorClass="bg-[#294c96]"
          />
        </div>
      </section>
      {workspace.workstreams.map((stream) => (
        <section
          key={stream.id}
          className="grid overflow-hidden rounded-xl border border-[#dfe5ec] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="p-5 sm:p-6">
            <h2 className="mt-0 mb-3 text-sm font-semibold">
              {workspace.workstreams.length > 1
                ? stream.serviceName
                : "Project scope"}
            </h2>
            <p className="m-0 max-w-prose whitespace-pre-wrap text-xs leading-6 text-[#60718c]">
              {stream.description ||
                "No project description has been provided."}
            </p>
          </div>
          <div className="border-t border-[#e5e9ef] p-5 sm:p-6 lg:border-t-0 lg:border-l">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="m-0 text-xs font-semibold">
                Expected deliverables
              </h3>
              <span className="text-[11px] text-[#738096]">
                {stream.milestones?.filter(
                  (item) => item.deliveryStatus === "SENT_TO_CLIENT",
                ).length ?? 0}{" "}
                / {stream.milestones?.length ?? 0} sent
              </span>
            </div>
            {stream.milestones?.length ? (
              <ul className="m-0 list-none divide-y divide-[#edf0f4] p-0">
                {stream.milestones.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-3 text-xs"
                  >
                    {item.deliveryStatus === "SENT_TO_CLIENT" ? (
                      <CheckCircle2
                        size={17}
                        className="shrink-0 text-[#294c96]"
                      />
                    ) : (
                      <Circle size={17} className="shrink-0 text-[#94a3b8]" />
                    )}
                    <span className="flex-1">{item.title}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] ${deliverableStatusClass(item.deliveryStatus)}`}
                    >
                      {deliverableStatusLabel(item.deliveryStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#738096]">
                No deliverables recorded yet.
              </p>
            )}
            <button
              type="button"
              onClick={onViewDeliverables}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#294c96] hover:underline"
            >
              View deliverables <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </section>
      ))}
      <section className="rounded-xl border border-[#dfe5ec] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-semibold">
            Assigned staff{" "}
            <span className="font-normal text-[#738096]">({staff.length})</span>
          </h2>
          <button
            onClick={onViewTeam}
            className="text-xs font-semibold text-[#294c96] hover:underline"
          >
            View team
          </button>
        </div>
        {staff.length ? (
          <div className="mt-4 divide-y divide-[#e9edf1] overflow-hidden rounded-lg border border-[#e2e6ec]">
            {staff.map((person) => (
              <div
                key={person.id}
                className="flex min-h-16 items-center gap-3 px-4 py-3 text-xs transition-colors hover:bg-[#fafbfd]"
              >
                <Avatar name={person.fullName} />
                <div className="min-w-0">
                  <p className="m-0 truncate font-medium">{person.fullName}</p>
                  <p className="mt-1 mb-0 truncate text-[11px] text-[#738096]">
                    {person.position || "Staff"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-0 mt-3 text-xs text-[#738096]">
            No staff assigned yet. The department head can approve staffing from
            Team.
          </p>
        )}
      </section>
    </div>
  )
}
