import { ClientRowTable } from "@/components/ui/client-row-table"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import type { ServiceIconKey } from "@/features/services/api/services-api"
import { ServiceIcon } from "@/features/services/components/service-icon"
import Link from "next/link"
import { Eye } from "lucide-react"
import type { ClientProjectSummary } from "../api/projects-api"

type ProjectRowVisual = {
  iconClassName: string
  iconKey: ServiceIconKey
}

function projectRowVisual(serviceName?: string): ProjectRowVisual {
  const normalizedName = serviceName?.toLocaleLowerCase() ?? ""

  if (
    normalizedName.includes("community") ||
    normalizedName.includes("social")
  ) {
    return {
      iconClassName: "text-[#19864a]",
      iconKey: "social",
    }
  }

  if (
    normalizedName.includes("marketing") ||
    normalizedName.includes("advertising") ||
    normalizedName.includes("campaign")
  ) {
    return {
      iconClassName: "text-[#6547d7]",
      iconKey: "advertising",
    }
  }

  if (
    normalizedName.includes("design") ||
    normalizedName.includes("creative")
  ) {
    return {
      iconClassName: "text-[#19864a]",
      iconKey: "design",
    }
  }

  if (normalizedName.includes("search") || normalizedName.includes("seo")) {
    return {
      iconClassName: "text-[#245bc4]",
      iconKey: "search",
    }
  }

  if (
    normalizedName.includes("web") ||
    normalizedName.includes("development") ||
    normalizedName.includes("code")
  ) {
    return {
      iconClassName: "text-[#245bc4]",
      iconKey: "code",
    }
  }

  return {
    iconClassName: "text-[#6547d7]",
    iconKey: "business",
  }
}

function statusLabel(status: string) {
  const label = status.toLowerCase().replaceAll("_", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function statusClass(status: string) {
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800"
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800"
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (status === "ON_HOLD") return "bg-orange-100 text-orange-800"
  return "bg-slate-100 text-slate-700"
}

function projectProgress(project: ClientProjectSummary) {
  return project.taskCount
    ? Math.min(
        100,
        Math.round((project.completedTasks / project.taskCount) * 100),
      )
    : 0
}

function ProjectAction({
  project,
}: {
  project: ClientProjectSummary
}) {
  return (
    <Link
      id={`project-view-${project.id}`}
      className={rowActionButton}
      aria-label={`View ${project.name}`}
      href={`/projects/${encodeURIComponent(project.id)}`}
    >
      <Eye size={15} aria-hidden="true" />
      <HoverTooltip>View project</HoverTooltip>
    </Link>
  )
}

export function ClientProjectsTable({
  projects,
  formatDate,
  viewKey,
  quickKey,
}: {
  projects: ClientProjectSummary[]
  formatDate: (value: Date | string) => string
  viewKey: string
  quickKey: string
}) {
  return (
    <ClientRowTable
      items={projects}
      viewKey={viewKey}
      quickKey={quickKey}
      getKey={(project) => project.id}
      caption="My projects"
      ariaLabel="My projects"
      columns={[
        { className: "w-[76px]", label: "Project icon" },
        { className: "w-[24%]", label: "Project" },
        { className: "w-[24%]", label: "Service and deliverables" },
        { className: "w-[18%]", label: "Progress" },
        { className: "w-[12%]", label: "Status" },
        { className: "w-[16%]", label: "Last updated" },
        { className: "w-[120px]", label: "Actions" },
      ]}
      rowClassName="h-[66px] align-middle"
      emptyContent="No projects match"
      renderRow={(project) => {
        const serviceName = project.request?.service.name || "Project"
        const visual = projectRowVisual(project.request?.service.name)
        const percent = projectProgress(project)
        return (
          <>
            <td className="rounded-l-xl border-y border-l border-[#e1e7ef] bg-[#f4f7fb] px-3 py-2 align-middle">
              <span
                className={`request-icon-float mx-auto grid size-11 place-items-center rounded-2xl border-2 border-current ${visual.iconClassName}`}
              >
                <ServiceIcon iconKey={visual.iconKey} size={22} />
              </span>
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle">
              <Link
                href={`/projects/${encodeURIComponent(project.id)}`}
                className="cursor-pointer rounded text-left font-semibold text-[#17243b] hover:underline focus-visible:outline-2 focus-visible:outline-[#294c96]"
              >
                {project.name}
              </Link>
              <p className="mt-1 mb-0 break-all text-[10px] text-[#738096]">
                {project.request?.referenceNumber || project.id}
              </p>
            </td>
            <td className="border-y border-l border-[#e7ebf1] bg-[#f4f7fb] px-4 py-2 align-middle">
              <span className="block break-words font-medium">
                {serviceName}
              </span>
              <span className="mt-1 block text-[11px] text-[#738096]">
                {project.deliverableCount}{" "}
                {project.deliverableCount === 1
                  ? "deliverable"
                  : "deliverables"}
              </span>
            </td>
            <td className="border-y border-l border-[#e7ebf1] bg-[#f4f7fb] px-4 py-2 align-middle">
              <div className="mt-1.5 flex max-w-[220px] items-center gap-2">
                <div
                  className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#dfe6ef]"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${project.name} progress`}
                >
                  <div
                    className="h-full rounded-full bg-[#294c96]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] text-[#738096]">
                  {percent}%
                </span>
              </div>
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle">
              <Pill className={statusClass(project.status)}>
                {statusLabel(project.status)}
              </Pill>
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle text-[#52627a]">
              <time dateTime={project.updatedAt}>
                {formatDate(project.updatedAt)}
              </time>
            </td>
            <td className="rounded-r-xl border-y border-r border-[#e1e7ef] bg-[#f4f7fb] px-3 py-2 align-middle">
              <ProjectAction project={project} />
            </td>
          </>
        )
      }}
      renderMobileRow={(project) => {
        const serviceName = project.request?.service.name || "Project"
        const visual = projectRowVisual(project.request?.service.name)
        const percent = projectProgress(project)
        return (
          <article className="min-w-0 rounded-lg border border-[#e8ebef] bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`request-icon-float grid size-10 shrink-0 place-items-center rounded-xl border-2 border-current ${visual.iconClassName}`}
                >
                  <ServiceIcon iconKey={visual.iconKey} size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 min-w-0 break-words text-sm font-semibold">
                    {project.name}
                  </h2>
                  <p className="mt-1 mb-0 break-all text-[10px] text-[#738096]">
                    {project.request?.referenceNumber || project.id}
                  </p>
                </div>
              </div>
              <Pill className={statusClass(project.status)}>
                {statusLabel(project.status)}
              </Pill>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[#738096]">Service</dt>
                <dd className="mt-1 ml-0 break-words font-medium">
                  {serviceName}
                </dd>
              </div>
              <div>
                <dt className="text-[#738096]">Progress</dt>
                <dd className="mt-1 ml-0 font-medium">{percent}%</dd>
              </div>
              <div>
                <dt className="text-[#738096]">Deliverables</dt>
                <dd className="mt-1 ml-0 font-medium">
                  {project.deliverableCount}
                </dd>
              </div>
            </dl>
            <div className="mt-4 space-y-3 border-t border-[#eceef1] pt-3">
              <time
                className="block text-[11px] whitespace-nowrap text-[#52627a]"
                dateTime={project.updatedAt}
              >
                Last updated {formatDate(project.updatedAt)}
              </time>
              <ProjectAction project={project} />
            </div>
          </article>
        )
      }}
    />
  )
}
