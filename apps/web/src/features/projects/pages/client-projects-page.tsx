"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Code2,
  FileCheck2,
  FolderKanban,
  Image,
  Megaphone,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import { ClientPageHeader } from "@/components/layout/client-page-header"
import { KpiCards } from "@/components/ui/kpi-cards"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listClientProjects,
  type ClientProjectSummary,
} from "../api/projects-api"

type ProjectFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED"
type ProjectSort = "NEWEST" | "OLDEST"
const PAGE_SIZE = 10

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function statusClass(status: string) {
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800"
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800"
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (status === "ON_HOLD") return "bg-orange-100 text-orange-800"
  return "bg-slate-100 text-slate-700"
}

function isActive(status: string) {
  return status === "IN_PROGRESS" || status === "ON_HOLD"
}

type ProjectCardVisual = {
  Icon: LucideIcon
  iconClassName: string
  iconBackgroundClassName: string
  progressClassName: string
  progressBadgeClassName: string
  label: string
}

function projectCardVisual(service?: string): ProjectCardVisual {
  const normalizedService = service?.toLocaleLowerCase() ?? ""

  if (
    normalizedService.includes("marketing") ||
    normalizedService.includes("campaign")
  ) {
    return {
      Icon: Megaphone,
      iconClassName: "text-[#6950d8]",
      iconBackgroundClassName: "bg-[#eeeaff]",
      progressClassName: "bg-[#3159bf]",
      progressBadgeClassName: "bg-[#eeeaff] text-[#6041d2]",
      label: service || "Digital Marketing",
    }
  }

  if (
    normalizedService.includes("design") ||
    normalizedService.includes("ui") ||
    normalizedService.includes("ux")
  ) {
    return {
      Icon: Image,
      iconClassName: "text-[#279153]",
      iconBackgroundClassName: "bg-[#ddf5e6]",
      progressClassName: "bg-[#159447]",
      progressBadgeClassName: "bg-[#ddf5e6] text-[#167a42]",
      label: service || "UI/UX Design",
    }
  }

  return {
    Icon: Code2,
    iconClassName: "text-[#245bc4]",
    iconBackgroundClassName: "bg-[#dcecff]",
    progressClassName: "bg-[#1c52b8]",
    progressBadgeClassName: "bg-[#e2efff] text-[#14479f]",
    label: service || "Web Development",
  }
}

export function ClientProjectsPage() {
  const { formatDate } = useDatePreferences()
  const [projects, setProjects] = useState<ClientProjectSummary[]>([])
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ProjectFilter>("ALL")
  const [sort, setSort] = useState<ProjectSort>("NEWEST")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    listClientProjects(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProjects(result)
          setError("")
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load your projects.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const activeCount = projects.filter((project) =>
    isActive(project.status),
  ).length
  const completedCount = projects.filter(
    (project) => project.status === "COMPLETED",
  ).length
  const deliverableCount = projects.reduce(
    (total, project) => total + project.deliverableCount,
    0,
  )
  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return projects
      .filter((project) => {
        const matchesFilter =
          filter === "ALL" ||
          (filter === "ACTIVE" && isActive(project.status)) ||
          project.status === filter
        const searchable = [
          project.name,
          project.request?.service.name,
          project.request?.referenceNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
        return matchesFilter && (!normalized || searchable.includes(normalized))
      })
      .sort((first, second) => {
        const updatedDifference =
          new Date(second.updatedAt).getTime() -
          new Date(first.updatedAt).getTime()
        return sort === "NEWEST" ? updatedDifference : -updatedDifference
      })
  }, [filter, projects, query, sort])
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginatedProjects = visibleProjects.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  )
  const from = visibleProjects.length ? pageStart + 1 : 0
  const to = Math.min(pageStart + PAGE_SIZE, visibleProjects.length)

  const projectStats = [
    {
      label: "Active projects",
      value: activeCount,
      description: "Currently underway",
      icon: FolderKanban,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Completed",
      value: completedCount,
      description: "Finished projects",
      icon: CheckCircle2,
      iconClassName: "text-[#159447]",
    },
    {
      label: "Shared deliverables",
      value: deliverableCount,
      description: "Ready for your review",
      icon: FileCheck2,
      iconClassName: "text-[#2058d4]",
    },
  ]

  return (
    <main
      className={cn(contentClass, "p-[clamp(20px,2.1vw,32px)]")}
      aria-label="My projects"
    >
      <ClientPageHeader
        eyebrow="Projects"
        title="My Projects"
        description="Follow project progress and review work shared with you."
        actions={
          <Button
            asChild
            className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70] max-[560px]:h-11"
          >
            <Link href="/services">
              <Plus size={16} aria-hidden="true" />
              New Service Request
            </Link>
          </Button>
        }
      />

      <div className="mt-[clamp(30px,4vw,52px)] space-y-5">
        <KpiCards
          metrics={projectStats}
          label="Project summary"
          pending={loading}
          unavailable={Boolean(error)}
          showCharts={false}
          variant="blue"
          className="grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1"
        />

        <div className="flex flex-wrap items-center gap-2.5 pb-1 max-[560px]:flex-col max-[560px]:items-stretch">
          <label className="relative block min-w-[220px] flex-1 sm:w-[260px] sm:flex-none">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[#8091aa]"
            />
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search project, service or reference..."
              className="h-[34px] w-full rounded-lg border border-[#e1e4ea] bg-transparent pr-3 pl-9 text-xs outline-none placeholder:text-[#8091aa] focus-visible:ring-2 focus-visible:ring-[#28468f]/20 max-[560px]:h-11"
            />
          </label>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as ProjectFilter)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter projects by status"
              className="h-[34px] w-[165px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as ProjectSort)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Sort projects"
              className="h-[34px] w-[180px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEWEST">Most recently updated</SelectItem>
              <SelectItem value="OLDEST">Least recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : loading ? (
          <p role="status" className="py-10 text-center text-sm text-[#60718c]">
            Loading your projects…
          </p>
        ) : projects.length === 0 ? (
          <section className="grid justify-items-center rounded-xl border border-dashed border-[#ccd7e5] bg-white/60 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-[#edf2f9] text-[#2b4b97]">
              <FolderKanban size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 mb-0 text-base font-semibold">
              No projects yet
            </h2>
            <p className="mt-2 mb-0 max-w-sm text-xs leading-5 text-[#667894]">
              Once a booked service is activated, it will appear here with its
              progress and shared deliverables.
            </p>
            <Button className="mt-5 bg-[#243f8f] hover:bg-[#1d367d]" asChild>
              <Link href="/services">
                <Plus size={16} aria-hidden="true" />
                Book a service
              </Link>
            </Button>
          </section>
        ) : visibleProjects.length === 0 ? (
          <section className="rounded-xl border border-[#dce3eb] bg-white px-5 py-10 text-center">
            <p className="m-0 text-sm font-medium">No projects match</p>
            <p className="mt-1.5 mb-0 text-xs text-[#667894]">
              Try another search or status filter.
            </p>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProjects.map((project) => {
                const percent = project.taskCount
                  ? Math.min(
                      100,
                      Math.round(
                        (project.completedTasks / project.taskCount) * 100,
                      ),
                    )
                  : 0
                const visual = projectCardVisual(project.request?.service.name)
                const VisualIcon = visual.Icon

                return (
                  <article
                    key={project.id}
                    className="group flex min-h-[236px] flex-col rounded-2xl border border-[#e0e5ed] bg-white p-5 shadow-[0_3px_16px_rgba(38,58,90,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd6e5] hover:shadow-[0_8px_24px_rgba(38,58,90,0.09)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={`grid size-11 place-items-center rounded-xl ${visual.iconBackgroundClassName} ${visual.iconClassName}`}
                      >
                        <VisualIcon
                          size={22}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </span>
                      <Button
                        id={`project-view-${project.id}`}
                        variant="outline"
                        className="size-8 shrink-0 border-0 bg-transparent p-0 text-[#253b61] hover:bg-[#f2f5fa] hover:text-[#173b87]"
                        asChild
                      >
                        <Link
                          href={`/projects/${encodeURIComponent(project.id)}`}
                          aria-label={`View ${project.name}`}
                        >
                          <ArrowUpRight
                            size={21}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[12px] font-medium text-[#52647f]">
                          {visual.label}
                        </p>
                        <h2 className="mt-1 mb-0 truncate text-[19px] leading-tight font-semibold tracking-[-0.025em] text-[#101d35]">
                          {project.name}
                        </h2>
                        {project.request?.referenceNumber && (
                          <p className="mt-1 mb-0 truncate text-[11px] text-[#8391a5]">
                            {project.request.referenceNumber}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[18px] leading-none font-semibold ${visual.progressBadgeClassName}`}
                      >
                        {percent}%
                      </span>
                    </div>

                    <div
                      className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5eaf1]"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${project.name} progress`}
                    >
                      <div
                        className={`h-full rounded-full ${visual.progressClassName}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                      <div className="min-w-0 text-[11px] text-[#52647f]">
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            size={17}
                            strokeWidth={1.6}
                            className="shrink-0 text-[#3c526f]"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            Last updated {formatDate(project.updatedAt)}
                          </span>
                        </div>
                        <span className="mt-1 block pl-[25px] text-[#8492a6]">
                          {project.deliverableCount} deliverable
                          {project.deliverableCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${statusClass(project.status)}`}
                      >
                        {statusLabel(project.status)}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
              <span role="status" aria-live="polite" aria-atomic="true">
                Showing {from}–{to} of {visibleProjects.length}
              </span>
              <NumberedPagination
                page={currentPage}
                totalPages={totalPages}
                label="My Projects pages"
                onPageChange={setPage}
              />
            </footer>
          </>
        )}
      </div>
    </main>
  )
}
