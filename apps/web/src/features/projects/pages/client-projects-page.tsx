"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useMemo, useState } from "react"
import { CheckCircle2, FileCheck2, FolderKanban, Plus } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { ClientTableSkeleton } from "@/components/ui/client-table-skeleton"
import { SearchField } from "@/components/ui/search-field"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { useLocalTable } from "@/components/ui/use-local-table"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  listClientProjects,
  type ClientProjectSummary,
} from "../api/projects-api"
import { ClientProjectsTable } from "../components/client-projects-table"

type ProjectFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED"
type ProjectSort = "NEWEST" | "OLDEST"

const filterOptions: { value: ProjectFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]
const sortOptions: { value: ProjectSort; label: string }[] = [
  { value: "NEWEST", label: "Most recently updated" },
  { value: "OLDEST", label: "Least recently updated" },
]
const noProjects: ClientProjectSummary[] = []

function isActive(status: string) {
  return status === "IN_PROGRESS" || status === "ON_HOLD"
}

export function ClientProjectsPage() {
  const { formatDate } = useDatePreferences()
  const {
    data: projects = noProjects,
    loading,
    error,
  } = useAsyncResource((signal) => listClientProjects(signal), [], {
    fallbackError: "Couldn't load your projects.",
  })
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ProjectFilter>("ALL")
  const [sort, setSort] = useState<ProjectSort>("NEWEST")

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
  const table = useLocalTable(visibleProjects, {
    view: [filter, sort, query],
    loading,
  })

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
          <Button asChild className={clientPageHeaderActionClass}>
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
            onChange={(event) => setQuery(event.target.value)}
          />
          <FilterSelect
            label="Filter projects by status"
            value={filter}
            options={filterOptions}
            triggerClassName="w-[165px]"
            onChange={setFilter}
          />
          <FilterSelect
            label="Sort projects"
            value={sort}
            options={sortOptions}
            triggerClassName="w-[180px]"
            onChange={setSort}
          />
        </div>

        {error ? (
          <Alert as="div" className="rounded-xl px-5 py-6 text-sm">
            {error}
          </Alert>
        ) : loading ? (
          <ClientTableSkeleton
            label="your projects"
            columns={7}
            gridClassName="grid grid-cols-[76px_minmax(180px,1.25fr)_minmax(180px,1.25fr)_minmax(145px,.9fr)_minmax(100px,.7fr)_minmax(130px,.9fr)_120px] items-center gap-3.5"
          />
        ) : projects.length === 0 ? (
          <EmptyState
            as="section"
            size="lg"
            headingLevel={2}
            icon={FolderKanban}
            title="No projects yet"
            description="Once a booked service is activated, it will appear here with its progress and shared deliverables."
            className="bg-white/60"
            action={
              <Button variant="brand" asChild>
                <Link href="/services">
                  <Plus size={16} aria-hidden="true" />
                  Book a service
                </Link>
              </Button>
            }
          />
        ) : visibleProjects.length === 0 ? (
          <EmptyState
            as="section"
            title="No projects match"
            description="Try another search or status filter."
            className="bg-white"
          />
        ) : (
          <>
            <ClientProjectsTable
              projects={table.visible}
              formatDate={formatDate}
              viewKey={table.viewKey}
              quickKey={`${filter}:${sort}:${query}`}
              onRowsSettled={table.onRowsSettled}
            />
            <TablePaginationFooter
              {...table.footer}
              label="My Projects pages"
              onPageChange={table.setPage}
              className="text-[#52627a]"
            />
          </>
        )}
      </div>
    </main>
  )
}
