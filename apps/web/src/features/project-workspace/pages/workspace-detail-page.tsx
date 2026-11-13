"use client"
import { WorkspaceTeam } from "../components/workspace-team"
import { WorkspaceActivity } from "../components/workspace-activity"
import { WorkspaceDeliverables } from "../components/workspace-deliverables"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ChevronDown, Pause, Play } from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { ProjectSummary } from "../components/project-summary"
import { WorkspaceOverview } from "../components/workspace-overview"
import { PlanEditor, emptyPlan } from "../components/plan-editor"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pillToneClass } from "@/components/ui/pill"
import { statusTone } from "@/features/projects/model/project-status"
import { humanizeEnum } from "@/lib/format"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
import {
  saveProjectPlan,
  updateProjectWorkspaceStatus,
  type ProjectWorkPlan,
} from "../api/project-workspace-api"
import {
  getProjectWorkspace,
  type ProjectWorkspaceDetail,
} from "../api/project-workspace-api"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

export function WorkspaceDetailPage({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const project = useAsyncResource<ProjectWorkspaceDetail>(
    (signal) => getProjectWorkspace(id, signal),
    [id],
    { fallbackError: "Couldn't load project" },
  )
  const workspace = project.data
    ? { ...project.data, id: id.includes(":") ? id : project.data.id }
    : null
  const setWorkspace = project.setData
  const [actionError, setError] = useState("")
  const error = actionError || project.error
  const [tab, setTab] = useState(
    searchParams.get("tab") === "deliverables" ? "Deliverables" : "Overview",
  )
  const [busy, setBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [editing, setEditing] = useState<{
    projectId: string
    name: string
    updatedAt: string
    plan: ProjectWorkPlan
  } | null>(null)
  async function savePlan() {
    if (!editing || busy) return
    setBusy(true)
    try {
      setWorkspace(
        await saveProjectPlan(
          id,
          editing.projectId,
          editing.plan,
          editing.updatedAt,
        ),
      )
      setEditing(null)
      setError("")
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't save plan"))
    } finally {
      setBusy(false)
    }
  }
  async function changeWorkspaceStatus(
    action: "ON_HOLD" | "RESUME" | "COMPLETE",
  ) {
    if (!workspace || statusBusy) return
    setStatusBusy(true)
    setError("")
    try {
      setWorkspace(await updateProjectWorkspaceStatus(id, action))
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't update project status"))
    } finally {
      setStatusBusy(false)
    }
  }
  const workstreams = workspace?.workstreams ?? []
  const tasks = workstreams.flatMap(
    (stream) => stream.plan?.phases.flatMap((phase) => phase.tasks) ?? [],
  )
  const deliverables = workstreams.flatMap((stream) => stream.milestones ?? [])
  const terminal =
    workstreams.length > 0 &&
    workstreams.every((stream) =>
      ["COMPLETED", "CANCELLED"].includes(stream.status),
    )
  const canComplete =
    workstreams.length > 0 &&
    workstreams.every((stream) =>
      ["IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(stream.status),
    ) &&
    workstreams.every((stream) => stream.plan != null) &&
    tasks.every((task) => task.status === "DONE") &&
    deliverables.every(
      (deliverable) => deliverable.deliveryStatus === "SENT_TO_CLIENT",
    ) &&
    workstreams.some((stream) =>
      ["IN_PROGRESS", "ON_HOLD"].includes(stream.status),
    )
  const completionBlockReason = workstreams.some(
    (stream) => stream.status === "PLANNED",
  )
    ? "Start every service before completing the workspace."
    : workstreams.some((stream) => stream.status === "CANCELLED")
      ? "Resolve cancelled services before completing the workspace."
      : workstreams.some(
            (stream) =>
              !stream.plan ||
              stream.plan.phases.some((phase) =>
                phase.tasks.some((task) => task.status !== "DONE"),
              ),
          )
        ? "Finish every project task first."
        : deliverables.some(
              (deliverable) => deliverable.deliveryStatus !== "SENT_TO_CLIENT",
            )
          ? "Send every deliverable to the client first."
          : "This workspace has no active services to complete."
  return (
    <main className={`${contentClass} p-8`}>
      {error && (
        <Alert variant="text" className="text-base">
          {error}
        </Alert>
      )}
      {!workspace ? (
        <p role="status">Loading project…</p>
      ) : (
        <>
          <header className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h1 className="m-0 break-words text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]">
                {workspace.name}
              </h1>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium capitalize ${pillToneClass(statusTone(workspace.status))}`}
                >
                  {humanizeEnum(workspace.status, { capitalize: false })}
                </span>
                {workspace.canManage && !terminal && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={statusBusy}
                        aria-label="Manage project status"
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-[#ccd5e2] bg-white px-3 text-xs font-medium text-[#203f8c] shadow-sm hover:bg-[#f7f9fc] focus-visible:ring-2 focus-visible:ring-[#294c96] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                      >
                        Manage status{" "}
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={6}
                      className={`${dropdownMenuClass} w-64 text-xs outline-none`}
                    >
                      {workstreams.some(
                        (stream) => stream.status === "IN_PROGRESS",
                      ) && (
                        <DropdownMenuItem
                          disabled={statusBusy}
                          className={dropdownItemClass}
                          onSelect={() => void changeWorkspaceStatus("ON_HOLD")}
                        >
                          <span className="flex items-center gap-2">
                            <Pause size={14} aria-hidden="true" /> Put on hold
                          </span>
                        </DropdownMenuItem>
                      )}
                      {workstreams.some(
                        (stream) => stream.status === "ON_HOLD",
                      ) && (
                        <DropdownMenuItem
                          disabled={statusBusy}
                          className={dropdownItemClass}
                          onSelect={() => void changeWorkspaceStatus("RESUME")}
                        >
                          <span className="flex items-center gap-2">
                            <Play size={14} aria-hidden="true" /> Resume project
                          </span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={statusBusy || !canComplete}
                        className={dropdownItemClass}
                        onSelect={() => void changeWorkspaceStatus("COMPLETE")}
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle2 size={14} aria-hidden="true" /> Mark
                          complete
                        </span>
                      </DropdownMenuItem>
                      {!canComplete && (
                        <p className="m-0 px-2.5 py-2 text-[11px] leading-4 text-[#738096]">
                          {completionBlockReason}
                        </p>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </header>
          {workstreams.some(
            (stream) => stream.canUploadDeliverables && stream.startDate,
          ) && (
            <div
              className="mt-4 flex flex-wrap gap-2"
              aria-label="Project chats"
            >
              {workstreams
                .filter(
                  (stream) => stream.canUploadDeliverables && stream.startDate,
                )
                .map((stream) => (
                  <Button
                    key={stream.id}
                    asChild
                    variant="outline"
                    className="text-xs"
                  >
                    <Link
                      href={`/messages?project=${encodeURIComponent(stream.id)}`}
                    >
                      Chat with client · {stream.name}
                    </Link>
                  </Button>
                ))}
            </div>
          )}
          <nav
            aria-label="Project sections"
            className="my-6 flex gap-6 border-b border-[#e1e4ea]"
          >
            {["Overview", "Work", "Deliverables", "Team", "Activity"].map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`border-b-2 px-1 pb-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#294c96] focus-visible:ring-offset-2 ${tab === item ? "border-[#203f8c] font-semibold text-[#203f8c]" : "border-transparent text-[#738096]"}`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>
          {tab === "Work" && editing && (
            <section className="mb-5 rounded-xl border border-[#dfe4ec] p-5">
              <h2 className="text-sm font-semibold">
                Edit plan · {editing.name}
              </h2>
              <p className="text-xs text-[#738096]">
                Rename phases and tasks, add work, or remove items. Removing a
                phase also removes its tasks when you save.
              </p>
              <PlanEditor
                plan={editing.plan}
                onChange={(plan) =>
                  setEditing((current) =>
                    current ? { ...current, plan } : null,
                  )
                }
                disabled={busy}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Discard changes
                </Button>
                <Button
                  variant="brand"
                  disabled={busy}
                  onClick={() => void savePlan()}
                >
                  {busy ? "Saving…" : "Save plan"}
                </Button>
              </div>
            </section>
          )}
          {tab === "Overview" ? (
            <ProjectSummary
              workspace={workspace}
              onViewTeam={() => setTab("Team")}
              onViewDeliverables={() => setTab("Deliverables")}
            />
          ) : tab === "Work" ? (
            !editing && (
              <WorkspaceOverview
                workspace={workspace}
                busy={busy}
                onUpdated={setWorkspace}
                onEditPlan={(stream) =>
                  setEditing({
                    projectId: stream.id,
                    name: stream.serviceName,
                    updatedAt: stream.updatedAt,
                    plan: structuredClone(stream.plan ?? emptyPlan()),
                  })
                }
              />
            )
          ) : tab === "Deliverables" ? (
            <WorkspaceDeliverables
              workspace={workspace}
              onUpdated={setWorkspace}
            />
          ) : tab === "Activity" ? (
            <WorkspaceActivity workspace={workspace} />
          ) : (
            <WorkspaceTeam
              workspace={workspace}
              onUpdated={setWorkspace}
              onChanged={project.retry}
            />
          )}
        </>
      )}
    </main>
  )
}
