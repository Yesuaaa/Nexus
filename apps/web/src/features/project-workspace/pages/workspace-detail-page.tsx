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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  notifyProjectWorkspaceListChanged,
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
import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs"

const detailTabs = [
  "Overview",
  "Work",
  "Deliverables",
  "Team",
  "Activity",
] as const
type DetailTab = (typeof detailTabs)[number]

export function WorkspaceDetailPage({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const project = useAsyncResource<{
    workspace: ProjectWorkspaceDetail | null
    error: string
  }>(
    async (signal) => {
      try {
        return { workspace: await getProjectWorkspace(id, signal), error: "" }
      } catch (reason) {
        return {
          workspace: null,
          error: errorMessage(reason, "Couldn't load project"),
        }
      }
    },
    [id],
    { fallbackError: "Couldn't load project" },
  )
  const workspace = project.data?.workspace
    ? {
        ...project.data.workspace,
        id: id.includes(":") ? id : project.data.workspace.id,
      }
    : null
  useBreadcrumbLabel(id, workspace?.name)
  const setWorkspace = (updated: ProjectWorkspaceDetail) => {
    project.setData((current) =>
      current ? { ...current, workspace: updated } : current,
    )
  }
  function updateWorkspaceAndNotify(updated: ProjectWorkspaceDetail) {
    setWorkspace(updated)
    notifyProjectWorkspaceListChanged()
  }
  const [actionError, setError] = useState("")
  const loadError = project.data?.error || project.error
  const error = actionError || (project.loading ? "" : loadError)
  const [tab, setTab] = useState<DetailTab>(
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
      updateWorkspaceAndNotify(
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
      updateWorkspaceAndNotify(await updateProjectWorkspaceStatus(id, action))
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
    <main className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}>
      {error && (
        <Alert variant="text" className="text-base">
          {error}
          {!workspace && loadError && (
            <Button
              className="ml-2"
              variant="outline"
              size="sm"
              onClick={project.retry}
            >
              Try again
            </Button>
          )}
        </Alert>
      )}
      {!workspace ? (
        project.loading ? (
          <p role="status">Loading project…</p>
        ) : loadError ? null : (
          <p role="status">Project workspace not found.</p>
        )
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
                      <Button
                        type="button"
                        variant="brandOutline"
                        size="sm"
                        disabled={statusBusy}
                        aria-label="Manage project status"
                      >
                        Manage status{" "}
                        <ChevronDown size={14} aria-hidden="true" />
                      </Button>
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
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as DetailTab)}
          >
            <TabsList
              aria-label="Project sections"
              className="my-6 h-auto max-w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-[#e1e4ea] bg-transparent p-0"
            >
              {detailTabs.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className="h-auto shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 text-xs text-[#738096] shadow-none data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#203f8c] data-[state=active]:shadow-none"
                >
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="Overview" className="m-0 outline-none">
              <ProjectSummary
                workspace={workspace}
                onViewTeam={() => setTab("Team")}
                onViewDeliverables={() => setTab("Deliverables")}
              />
            </TabsContent>
            <TabsContent value="Work" className="m-0 outline-none">
              {editing ? (
                <section className="mb-5 rounded-xl border border-[#dfe4ec] p-5">
                  <h2 className="text-sm font-semibold">
                    Edit plan · {editing.name}
                  </h2>
                  <p className="text-xs text-[#738096]">
                    Rename phases and tasks, add work, or remove items. Removing
                    a phase also removes its tasks when you save.
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
              ) : (
                <WorkspaceOverview
                  workspace={workspace}
                  busy={busy}
                  onUpdated={updateWorkspaceAndNotify}
                  onEditPlan={(stream) =>
                    setEditing({
                      projectId: stream.id,
                      name: stream.serviceName,
                      updatedAt: stream.updatedAt,
                      plan: structuredClone(stream.plan ?? emptyPlan()),
                    })
                  }
                />
              )}
            </TabsContent>
            <TabsContent value="Deliverables" className="m-0 outline-none">
              <WorkspaceDeliverables
                workspace={workspace}
                onUpdated={setWorkspace}
              />
            </TabsContent>
            <TabsContent value="Team" className="m-0 outline-none">
              <WorkspaceTeam
                workspace={workspace}
                onUpdated={setWorkspace}
                onChanged={project.retry}
              />
            </TabsContent>
            <TabsContent value="Activity" className="m-0 outline-none">
              <WorkspaceActivity workspace={workspace} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  )
}
