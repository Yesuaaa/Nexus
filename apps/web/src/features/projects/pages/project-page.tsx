"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckCircle2, Circle, FolderKanban } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  getProject,
  updateMilestone,
  type ProjectWorkspace,
} from "../api/projects-api"

export function ProjectPage({ projectId }: { projectId: string }) {
  const account = usePortalAccount()
  const [project, setProject] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getProject(projectId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setProject(result)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load this project.",
          )
      })
    return () => controller.abort()
  }, [projectId])

  async function complete(id: string, completed: boolean) {
    if (pending) return
    setPending(id)
    try {
      setProject(await updateMilestone(projectId, id, completed))
      sileo.success({
        title: completed ? "Milestone completed" : "Milestone reopened",
      })
    } catch (reason) {
      sileo.error({
        title: "Couldn't update milestone",
        description:
          reason instanceof Error ? reason.message : "Please try again.",
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <main
      className={`${contentClass} p-6 max-[767px]:p-4`}
      aria-label="Project workspace"
    >
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : !project ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading project…
        </p>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[#e9eef8] text-[#203f8c]">
                <FolderKanban size={23} aria-hidden="true" />
              </span>
              <div>
                <p className="m-0 text-xs text-muted-foreground">
                  {project.request?.service.name || "Project workspace"}
                </p>
                <h1 className="mt-1 mb-2 text-xl font-semibold">
                  {project.name}
                </h1>
                <span className="inline-block rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[11px] font-medium text-[#285c3c]">
                  {project.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
            {project.request &&
              (account.role === "USER" || Boolean(account.headOf)) && (
                <Button variant="outline" asChild>
                  <Link
                    href={`/messages?request=${encodeURIComponent(project.request.id)}`}
                  >
                    View service conversation
                  </Link>
                </Button>
              )}
          </header>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section
              aria-labelledby="milestone-heading"
              className="rounded-xl border border-border p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="milestone-heading"
                  className="m-0 text-sm font-semibold"
                >
                  Deliverables & milestones
                </h2>
                <span className="text-xs text-muted-foreground">
                  {project.milestones.filter((item) => item.completedAt).length}
                  /{project.milestones.length} completed
                </span>
              </div>
              {project.milestones.length ? (
                <ul className="mt-4 list-none divide-y divide-border p-0">
                  {project.milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="flex items-center gap-3 py-4"
                    >
                      {milestone.completedAt ? (
                        <CheckCircle2
                          className="shrink-0 text-green-700"
                          size={19}
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle
                          className="shrink-0 text-muted-foreground"
                          size={19}
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm [overflow-wrap:anywhere]">
                          {milestone.title}
                        </p>
                        {milestone.completedAt && (
                          <p className="mt-1 mb-0 text-[11px] text-muted-foreground">
                            Completed{" "}
                            {new Date(milestone.completedAt).toLocaleDateString(
                              "en-PH",
                            )}
                          </p>
                        )}
                      </div>
                      {project.canManage && (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={Boolean(pending)}
                          onClick={() =>
                            void complete(milestone.id, !milestone.completedAt)
                          }
                        >
                          {pending === milestone.id
                            ? "Saving…"
                            : milestone.completedAt
                              ? "Reopen"
                              : "Mark complete"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-xs text-muted-foreground">
                  No milestones have been set for this project.
                </p>
              )}
            </section>
            <aside className="self-start rounded-xl border border-border p-5">
              <h2 className="mt-0 text-sm font-semibold">Project overview</h2>
              <p className="text-xs leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {project.description ||
                  "Your department head will coordinate the project through your service conversation."}
              </p>
              <dl className="mt-5 grid gap-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Request reference</dt>
                  <dd className="m-0 mt-1">
                    {project.request?.referenceNumber || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="m-0 mt-1">
                    {project.startDate
                      ? new Date(project.startDate).toLocaleDateString(
                          "en-PH",
                          { dateStyle: "medium" },
                        )
                      : "Not started"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </>
      )}
    </main>
  )
}
