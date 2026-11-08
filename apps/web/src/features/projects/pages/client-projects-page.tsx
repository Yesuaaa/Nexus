"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import { KpiCards } from "@/components/ui/kpi-cards"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
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
    <main className={`${contentClass} p-6 max-[767px]:p-4`}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e9ee] px-7 py-6 max-[767px]:px-4">
        <div>
          <h1 className="m-0 text-[24px] leading-tight font-semibold tracking-[-0.025em]">
            My Projects
          </h1>
          <p className="mt-1.5 mb-0 text-xs text-[#60718c]">
            Follow project progress and review work shared with you.
          </p>
        </div>
        <Button className="bg-[#243f8f] text-white hover:bg-[#1d367d]" asChild>
          <Link href="/services">
            <Plus size={16} aria-hidden="true" />
            Book a service
          </Link>
        </Button>
      </header>

      <div className="space-y-5 p-7 max-[767px]:p-4">
        <KpiCards
          metrics={projectStats}
          label="Project summary"
          pending={loading}
          unavailable={Boolean(error)}
          showCharts={false}
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
            <div className="overflow-x-auto rounded-xl border border-[#dce3eb] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="bg-[#e9eef3] text-[#1c2b40]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Project
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Service
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Progress
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Last updated
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-center font-semibold"
                    >
                      Deliverables
                    </th>
                    <th
                      scope="col"
                      className="w-[108px] px-4 py-3 text-center font-semibold"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8edf2]">
                  {paginatedProjects.map((project) => {
                    const percent = project.taskCount
                      ? Math.round(
                          (project.completedTasks / project.taskCount) * 100,
                        )
                      : 0
                    return (
                      <tr key={project.id} className="hover:bg-[#f8fafc]">
                        <th
                          scope="row"
                          className="px-4 py-4 font-medium text-[#111d30]"
                        >
                          {project.name}
                          {project.request?.referenceNumber && (
                            <span className="mt-1 block font-normal text-[11px] text-[#71839d]">
                              {project.request.referenceNumber}
                            </span>
                          )}
                        </th>
                        <td className="px-4 py-4 text-[#50627e]">
                          {project.request?.service.name || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(project.status)}`}
                          >
                            {statusLabel(project.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {project.taskCount ? (
                            <div className="flex w-[160px] min-w-[136px] items-center gap-2">
                              <div
                                className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3e8ef]"
                                role="progressbar"
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${project.name} progress`}
                              >
                                <div
                                  className="h-full rounded-full bg-[#2c4e9b]"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="w-9 text-right text-[#637690]">
                                {percent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#71839d]">Not started</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#5e7391]">
                          {formatDate(project.updatedAt)}
                        </td>
                        <td className="px-4 py-4 text-center text-[#5e7391]">
                          {project.deliverableCount}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button
                            id={`project-view-${project.id}`}
                            variant="outline"
                            className="size-9 shrink-0 p-0 text-[#586d8a]"
                            asChild
                          >
                            <Link
                              href={`/projects/${encodeURIComponent(project.id)}`}
                              aria-label={`View ${project.name}`}
                            >
                              <Eye size={17} aria-hidden="true" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
