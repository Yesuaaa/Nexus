"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, FileCheck2, FolderKanban, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import { ClientPageHeader } from "@/components/layout/client-page-header"
import { KpiCards } from "@/components/ui/kpi-cards"
import { ClientTableSkeleton } from "@/components/ui/client-table-skeleton"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchField } from "@/components/ui/search-field"
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
import { ClientProjectDetailsDrawer } from "../components/client-project-details-drawer"
import { ClientProjectsTable } from "../components/client-projects-table"

type ProjectFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED"
type ProjectSort = "NEWEST" | "OLDEST"
const PAGE_SIZE = 10

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
  const [selectedProject, setSelectedProject] =
    useState<ClientProjectSummary | null>(null)

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
          <SearchField
            label="Search projects"
            placeholder="Search project, service or reference…"
            value={query}
            maxLength={100}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
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
          <ClientTableSkeleton
            label="your projects"
            columns={7}
            gridClassName="grid grid-cols-[76px_minmax(180px,1.25fr)_minmax(180px,1.25fr)_minmax(145px,.9fr)_minmax(100px,.7fr)_minmax(130px,.9fr)_120px] items-center gap-3.5"
          />
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
            <ClientProjectsTable
              projects={paginatedProjects}
              formatDate={formatDate}
              viewKey={`${filter}:${sort}:${query}:${currentPage}`}
              quickKey={`${filter}:${sort}:${query}`}
              onView={setSelectedProject}
            />
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
      {selectedProject && (
        <ClientProjectDetailsDrawer
          key={selectedProject.id}
          project={selectedProject}
          formatDate={formatDate}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </main>
  )
}
