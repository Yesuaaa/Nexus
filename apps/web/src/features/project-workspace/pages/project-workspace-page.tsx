"use client"

import dynamic from "next/dynamic"
import { PanelLoading } from "@/components/ui/panel-loading"
import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  FolderKanban,
  Layers3,
  Plus,
} from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/components/ui/kpi-cards"
import { SearchField } from "@/components/ui/search-field"
import { Dropdown } from "@/components/ui/dropdown"
import { canCreateProjectWorkspace } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  listProjectWorkspaces,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { WorkspaceListTable } from "../components/workspace-list-table"
const NewWorkspaceDialog = dynamic(
  () =>
    import("./new-workspace-page").then((module) => module.NewWorkspaceDialog),
  { loading: PanelLoading },
)

export function ProjectWorkspacePage() {
  const account = usePortalAccount()
  const [workspaces, setWorkspaces] = useState<ProjectWorkspaceSummary[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [sort, setSort] = useState<"recent" | "most-active">("recent")
  const [view, setView] = useState<"active" | "archive">("active")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)

  function refresh() {
    setLoading(true)
    setError("")
    setRevision((value) => value + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    listProjectWorkspaces({ sort }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setWorkspaces(result.workspaces)
          setCanCreate(result.canCreate)
          setError("")
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load project workspaces.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [sort, revision])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return workspaces.filter((workspace) => {
      const archived = ["COMPLETED", "CANCELLED"].includes(workspace.status)
      const matchesView = view === "archive" ? archived : !archived
      const matchesStatus = status === "all" || workspace.status === status
      const matchesSearch =
        !needle ||
        workspace.name.toLowerCase().includes(needle) ||
        (workspace.client.fullName ?? "").toLowerCase().includes(needle) ||
        workspace.workstreams.some(
          (workstream) =>
            workstream.serviceName.toLowerCase().includes(needle) ||
            workstream.name.toLowerCase().includes(needle),
        )
      return matchesView && matchesStatus && matchesSearch
    })
  }, [search, status, view, workspaces])

  const activeCount = workspaces.filter(
    ({ status: itemStatus }) => itemStatus === "IN_PROGRESS",
  ).length
  const openCount = workspaces.filter(({ status: itemStatus }) =>
    ["PLANNED", "IN_PROGRESS", "ON_HOLD"].includes(itemStatus),
  ).length
  const archivedCount = workspaces.filter(({ status: itemStatus }) =>
    ["COMPLETED", "CANCELLED"].includes(itemStatus),
  ).length
  const workstreamCount = workspaces.reduce(
    (count, workspace) => count + workspace.workstreams.length,
    0,
  )
  const activeTasks = workspaces.reduce(
    (count, workspace) =>
      count +
      workspace.workstreams.reduce(
        (total, workstream) => total + workstream.completedTaskCount,
        0,
      ),
    0,
  )

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Project workspace"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-4">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Project Workspace
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Follow project plans, team assignments, and delivery activity for
            your department.
          </p>
        </div>
        {canCreateProjectWorkspace(account) && canCreate && (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-[34px] text-xs max-[560px]:h-11"
          >
            <Plus size={15} />
            New project
          </Button>
        )}
      </header>

      <KpiCards
        label="Project summary"
        pending={loading}
        unavailable={!!error}
        showCharts={false}
        className="mt-[18px] grid-cols-4 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
        metrics={[
          {
            label: "Total projects",
            value: workspaces.length,
            description: "Across your department",
            icon: FolderKanban,
            iconClassName: "text-[#3153a5]",
          },
          {
            label: "In progress",
            value: activeCount,
            description: `${openCount} active or planned`,
            icon: Activity,
            iconClassName: "text-[#138447]",
          },
          {
            label: "Services",
            value: workstreamCount,
            description: "Services in project plans",
            icon: Layers3,
            iconClassName: "text-[#526b95]",
          },
          {
            label: "Tasks completed",
            value: activeTasks,
            description: "Across saved work plans",
            icon: CheckCircle2,
            iconClassName: "text-[#138447]",
          },
        ]}
      />

      <section
        aria-label={view === "archive" ? "Project archive" : "Project list"}
        className="mt-5"
      >
        <div className="mb-4 grid gap-3">
          <h2 className="sr-only">
            {view === "archive" ? "Project archive" : "Department projects"}
          </h2>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 max-[560px]:w-full">
              <SearchField
                label="Search projects"
                placeholder="Search project, service, or client..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                containerClassName="w-[260px] max-[1050px]:w-[260px] max-[1050px]:flex-none max-[560px]:h-11 max-[560px]:w-full"
              />
              <Dropdown
                value={status}
                onChange={setStatus}
                label="Filter by project status"
                className="w-[150px] max-[560px]:w-full"
                triggerClassName="h-[34px] text-xs max-[560px]:h-11"
                options={[
                  {
                    value: "all",
                    label: view === "archive" ? "All archived" : "All active",
                  },
                  ...(view === "archive"
                    ? [
                        { value: "COMPLETED", label: "Completed" },
                        { value: "CANCELLED", label: "Cancelled" },
                      ]
                    : [
                        { value: "PLANNED", label: "Planned" },
                        { value: "IN_PROGRESS", label: "In progress" },
                        { value: "ON_HOLD", label: "On hold" },
                      ]),
                ]}
              />
              <Dropdown<"recent" | "most-active">
                value={sort}
                label="Sort projects"
                className="w-[174px] max-[560px]:w-full"
                triggerClassName="h-[34px] text-xs max-[560px]:h-11"
                options={[
                  { value: "recent", label: "Most recent activity" },
                  { value: "most-active", label: "Most activity" },
                ]}
                onChange={(value) => {
                  if (value === sort) return
                  setLoading(true)
                  setError("")
                  setSort(value)
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={view === "archive"}
              onClick={() => {
                setView((current) =>
                  current === "archive" ? "active" : "archive",
                )
                setStatus("all")
                setSearch("")
              }}
              className="h-[34px] flex-none text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <Archive size={14} aria-hidden="true" />
              {view === "archive" ? "Back to Projects" : "Archive"}
            </Button>
          </div>
        </div>

        {error ? (
          <div
            className="rounded-xl border border-[#f0d1d3] bg-[#fff9f9] p-5 text-sm text-[#9c343b]"
            role="alert"
          >
            {error}
            <Button
              variant="outline"
              className="ml-3 h-8 text-xs"
              onClick={refresh}
            >
              Try again
            </Button>
          </div>
        ) : loading || workspaces.length ? (
          <WorkspaceListTable
            workspaces={filtered}
            loading={loading}
            viewKey={JSON.stringify([search, view, status, sort])}
            quickKey={search}
            archiveView={view === "archive"}
            onChanged={refresh}
          />
        ) : workspaces.length === 0 && view === "active" ? (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                No project workspaces yet
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                {canCreate
                  ? "Start with a client-accepted booking, then choose a delivery plan for each service."
                  : "Your department head can set up a workspace after a booking is approved."}
              </p>
              {canCreateProjectWorkspace(account) && canCreate && (
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 text-xs"
                >
                  <Plus size={14} />
                  New project
                </Button>
              )}
            </div>
          </div>
        ) : view === "archive" &&
          archivedCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                Archive is empty
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                Completed and cancelled projects will appear here.
              </p>
            </div>
          </div>
        ) : workspaces.length > 0 &&
          view === "active" &&
          openCount === 0 &&
          status === "all" &&
          !search.trim() ? (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d5dce6] px-5 text-center">
            <div>
              <BriefcaseBusiness size={26} className="mx-auto text-[#8293ad]" />
              <h3 className="mt-3 mb-1 text-sm font-semibold text-[#243550]">
                No active projects
              </h3>
              <p className="m-0 max-w-md text-xs leading-5 text-[#738096]">
                All completed and cancelled projects are available in Archive.
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-[#e2e6ec] p-8 text-center text-sm text-[#738096]">
            No projects match those filters.
          </p>
        )}
      </section>
      <NewWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </main>
  )
}
