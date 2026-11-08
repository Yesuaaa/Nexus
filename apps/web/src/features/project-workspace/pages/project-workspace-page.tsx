"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers3,
  Plus,
} from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { canCreateProjectWorkspace } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  listProjectWorkspaces,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { WorkspaceListRowActions } from "../components/workspace-list-row-actions"
import { NewWorkspaceDialog } from "./new-workspace-page"

function statusStyle(status: string) {
  if (status === "IN_PROGRESS") return "bg-[#fff1d4] text-[#946000]"
  if (status === "ON_HOLD") return "bg-[#fbe9d5] text-[#9a4b12]"
  if (status === "COMPLETED") return "bg-[#e3f5e9] text-[#13743b]"
  if (status === "CANCELLED") return "bg-[#ffeaeb] text-[#b3343b]"
  return "bg-[#edf1f6] text-[#60718c]"
}

function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ")
}

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
            className="min-h-[36px] rounded-lg bg-[#203f8c] px-3.5 text-xs font-semibold text-white hover:bg-[#172f70]"
          >
            <Plus size={15} />
            New project
          </Button>
        )}
      </header>

      <section
        aria-label="Project summary"
        className="mt-[18px] grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1"
      >
        <SummaryCard
          icon={<FolderKanban size={17} />}
          label="Total projects"
          value={workspaces.length}
          detail="Across your department"
          color="text-[#3153a5]"
        />
        <SummaryCard
          icon={<Activity size={17} />}
          label="In progress"
          value={activeCount}
          detail={`${openCount} active or planned`}
          color="text-[#138447]"
        />
        <SummaryCard
          icon={<Layers3 size={17} />}
          label="Services"
          value={workstreamCount}
          detail="Services in project plans"
          color="text-[#526b95]"
        />
        <SummaryCard
          icon={<CheckCircle2 size={17} />}
          label="Tasks completed"
          value={activeTasks}
          detail="Across saved work plans"
          color="text-[#138447]"
        />
      </section>

      <section
        aria-label={view === "archive" ? "Project archive" : "Project list"}
        className="mt-5"
      >
        <div className="mb-4 grid gap-3">
          <h2 className="sr-only">
            {view === "archive" ? "Project archive" : "Department projects"}
          </h2>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <SearchField
                label="Search projects"
                placeholder="Search project, service, or client..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                containerClassName="w-[260px] max-[1050px]:w-[260px] max-[1050px]:flex-none max-[560px]:w-full"
              />
              <Select
                value={status}
                onValueChange={(value) => setStatus(value ?? "all")}
              >
                <SelectTrigger
                  aria-label="Filter by project status"
                  className="h-[34px] w-[150px] shrink-0 rounded-lg text-xs"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {view === "archive" ? "All archived" : "All active"}
                  </SelectItem>
                  {view === "archive" ? (
                    <>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="PLANNED">Planned</SelectItem>
                      <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      <SelectItem value="ON_HOLD">On hold</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(value) =>
                  setSort(value === "most-active" ? "most-active" : "recent")
                }
              >
                <SelectTrigger
                  aria-label="Sort projects"
                  className="h-[34px] w-[174px] shrink-0 rounded-lg text-xs"
                >
                  <SelectValue placeholder="Sort projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent activity</SelectItem>
                  <SelectItem value="most-active">Most activity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              aria-pressed={view === "archive"}
              onClick={() => {
                setView((current) =>
                  current === "archive" ? "active" : "archive",
                )
                setStatus("all")
                setSearch("")
              }}
              className="inline-flex min-h-[34px] flex-none items-center justify-center gap-[7px] rounded-lg border border-red-500 bg-background px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#244993] focus-visible:ring-offset-2"
            >
              <Archive size={14} aria-hidden="true" />
              {view === "archive" ? "Back to Projects" : "Archive"}
            </button>
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
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        ) : loading ? (
          <p
            className="rounded-xl border border-[#e2e6ec] p-6 text-sm text-[#738096]"
            role="status"
          >
            Loading projects…
          </p>
        ) : filtered.length ? (
          <div className="overflow-x-auto rounded-xl border border-[#e2e6ec] bg-background">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[9%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[17%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-[#edf1f5] text-[11px] font-semibold text-[#273754]">
                <tr>
                  <th className="px-4 py-3 text-left align-middle">Project</th>
                  <th className="px-4 py-3 text-center align-middle">Client</th>
                  <th className="px-4 py-3 text-center align-middle">
                    Services
                  </th>
                  <th className="px-4 py-3 text-center align-middle">Status</th>
                  <th className="px-4 py-3 text-center align-middle">
                    Last updated
                  </th>
                  <th className="px-4 py-3 text-center align-middle">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9edf1] text-xs">
                {filtered.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="transition-colors hover:bg-[#fafbfd]"
                  >
                    <td className="px-4 py-3.5 text-left align-middle">
                      <Link
                        href={`/project-workspace/${encodeURIComponent(workspace.id)}`}
                        className="font-normal text-black no-underline hover:underline"
                      >
                        {workspace.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle text-[#566b8c]">
                      {workspace.client.fullName || "Client"}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <div className="mx-auto flex max-w-[340px] flex-wrap justify-center gap-1.5">
                        {workspace.workstreams.map((workstream) => (
                          <span
                            key={workstream.id}
                            className="rounded-md bg-[#eef2f8] px-2 py-1 text-[10px] text-[#536b91]"
                          >
                            {workstream.serviceName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${statusStyle(workspace.status)}`}
                      >
                        {humanStatus(workspace.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle text-[#647a9c]">
                      <div className="flex items-center justify-center gap-1.5">
                        <Clock3 size={13} />
                        {new Date(workspace.updatedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <WorkspaceListRowActions
                        workspace={workspace}
                        onChanged={() => setRevision((value) => value + 1)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  className="mt-4 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
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
        onCreated={() => setRevision((value) => value + 1)}
      />
    </main>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail: string
  color: string
}) {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-[#fbfcfd] px-4 py-3 shadow-[0_2px_8px_rgb(24_41_68_/_4%)]">
      <div
        className={`flex items-center gap-2 text-[11px] text-[#5d7193] ${color}`}
      >
        {icon}
        <span className="text-[#5d7193]">{label}</span>
      </div>
      <p className="mt-1.5 mb-0 text-[25px] leading-none font-semibold tracking-[-0.03em] text-[#142037]">
        {value}
      </p>
      <p className="mt-1.5 mb-0 truncate text-[10px] text-[#7c8ba2]">
        {detail}
      </p>
    </article>
  )
}
