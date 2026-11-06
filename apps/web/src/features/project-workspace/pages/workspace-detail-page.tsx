"use client"

import { useEffect, useState } from "react"
import { contentClass } from "@/components/layout/styles"
import { WorkspaceOverview } from "../components/workspace-overview"
import { PlanEditor, emptyPlan } from "../components/plan-editor"
import { Button } from "@/components/ui/button"
import {
  saveProjectPlan,
  type ProjectWorkPlan,
} from "../api/project-workspace-api"
import {
  getProjectWorkspace,
  updateProjectTask,
  type ProjectWorkspaceDetail,
  type ProjectTaskStatus,
} from "../api/project-workspace-api"

export function WorkspaceDetailPage({ id }: { id: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspaceDetail | null>(
    null,
  )
  const [error, setError] = useState("")
  const [tab, setTab] = useState("Overview & Work")
  const [busy, setBusy] = useState(false)
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
      setError(reason instanceof Error ? reason.message : "Couldn't save plan")
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    getProjectWorkspace(id, controller.signal)
      .then(setWorkspace)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Couldn't load project",
          )
      })
    return () => controller.abort()
  }, [id])
  async function changeTask(
    projectId: string,
    taskId: string,
    status: ProjectTaskStatus,
  ) {
    if (busy) return
    setBusy(true)
    try {
      setWorkspace(await updateProjectTask(id, projectId, taskId, status))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save task")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className={`${contentClass} p-8`}>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!workspace ? (
        <p role="status">Loading project…</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-xs text-[#738096]">
            {workspace.client.fullName} ·{" "}
            {workspace.status.replaceAll("_", " ")}
          </p>
          <nav
            aria-label="Project sections"
            className="my-6 flex gap-6 border-b border-[#e1e4ea]"
          >
            {["Overview & Work", "Team", "Activity"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`border-b-2 px-1 pb-3 text-xs ${tab === item ? "border-[#203f8c] font-semibold text-[#203f8c]" : "border-transparent text-[#738096]"}`}
              >
                {item}
              </button>
            ))}
          </nav>
          {tab === "Overview & Work" && (
            <div className="mb-5">
              {editing ? (
                <section className="rounded-xl border border-[#dfe4ec] p-5">
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
                      className="bg-[#294c96] text-white hover:bg-[#203f80]"
                      disabled={busy}
                      onClick={() => void savePlan()}
                    >
                      {busy ? "Saving…" : "Save plan"}
                    </Button>
                  </div>
                </section>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  {workspace.workstreams.map((stream) => (
                    <Button
                      key={stream.id}
                      variant="outline"
                      disabled={busy}
                      className="text-xs"
                      onClick={() =>
                        setEditing({
                          projectId: stream.id,
                          name: stream.serviceName,
                          updatedAt: stream.updatedAt,
                          plan: structuredClone(stream.plan ?? emptyPlan()),
                        })
                      }
                    >
                      Edit{" "}
                      {workspace.workstreams.length > 1
                        ? stream.serviceName
                        : "project plan"}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "Overview & Work" ? (
            <WorkspaceOverview
              workspace={workspace}
              busy={busy}
              onStatus={(projectId, taskId, status) =>
                void changeTask(projectId, taskId, status)
              }
              onViewTeam={() => setTab("Team")}
            />
          ) : tab === "Activity" ? (
            workspace.activity.map((event) => (
              <article
                key={event.id}
                className="border-b border-[#e1e4ea] py-4"
              >
                <p className="text-sm">{event.summary}</p>
                <p className="text-xs text-[#738096]">
                  {event.actor?.fullName || "System"} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </article>
            ))
          ) : (
            workspace.workstreams.map((stream) => (
              <section
                key={stream.id}
                className="mb-5 rounded-xl border border-[#e1e4ea] p-5"
              >
                <h2 className="text-sm font-semibold">{stream.serviceName}</h2>
                {tab === "Team" ? (
                  <>
                    <p className="text-xs text-[#738096]">
                      {stream.staff
                        ?.map((person) => person.fullName)
                        .join(", ") || "No staff assigned yet."}
                    </p>
                    {stream.canAssign && stream.requestId && (
                      <a
                        className="text-xs text-[#203f8c] underline"
                        href={`/messages?request=${encodeURIComponent(stream.requestId)}`}
                      >
                        Manage approved staffing
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-6 text-[#738096]">
                      {stream.description}
                    </p>
                    {stream.plan?.phases.map((phase) => (
                      <div key={phase.id} className="mt-5">
                        <h3 className="text-xs font-semibold">{phase.title}</h3>
                        {phase.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-4 border-b border-[#edf0f4] py-3"
                          >
                            <div>
                              <p className="m-0 text-xs">{task.title}</p>
                              <span className="text-[10px] text-[#738096]">
                                {task.role}
                              </span>
                            </div>
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={task.status}
                              onChange={(event) =>
                                void changeTask(
                                  stream.id,
                                  task.id,
                                  event.target.value as ProjectTaskStatus,
                                )
                              }
                              className="rounded-md border border-[#dfe4ec] bg-transparent p-2 text-xs"
                            >
                              <option value="NOT_STARTED">Not started</option>
                              <option value="IN_PROGRESS">In progress</option>
                              <option value="DONE">Done</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    ))}
                    {!stream.plan && (
                      <p className="text-xs text-[#738096]">
                        A delivery template has not been selected yet.
                      </p>
                    )}
                  </>
                )}
              </section>
            ))
          )}
        </>
      )}
    </main>
  )
}
