"use client"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckCircle2, Circle, FolderKanban } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { contentClass } from "@/components/layout/styles"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  deliverableStatusClass,
  deliverableStatusLabel,
} from "@/features/project-workspace/components/deliverable-status"
import {
  getProject,
  reviewProjectCancellationRequest,
  reviewProjectChangeRequest,
  updateMilestone,
  type ProjectChangeRequest,
  type ProjectWorkspace,
} from "../api/projects-api"
import { ReviewProjectChangeDialog } from "../components/client-project-forms"

export function ProjectPage({ projectId }: { projectId: string }) {
  const { formatDate } = useDatePreferences()
  const account = usePortalAccount()
  const [project, setProject] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState<string | null>(null)
  const [reviewItem, setReviewItem] = useState<ProjectChangeRequest | null>(
    null,
  )
  const [reviewDecision, setReviewDecision] = useState<
    "ACCEPTED" | "NOT_APPROVED"
  >("ACCEPTED")
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
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

  async function submitChangeReview(responseNote: string) {
    if (!reviewItem || reviewBusy) return
    setReviewBusy(true)
    try {
      const updated =
        reviewItem.kind === "CANCELLATION"
          ? await reviewProjectCancellationRequest(
              projectId,
              reviewItem.id,
              reviewDecision,
              responseNote,
            )
          : await reviewProjectChangeRequest(
              projectId,
              reviewItem.id,
              reviewDecision,
              responseNote,
            )
      setProject(updated)
      setReviewOpen(false)
      setReviewItem(null)
      sileo.success({
        title:
          reviewItem.kind === "CANCELLATION"
            ? reviewDecision === "ACCEPTED"
              ? "Project cancellation approved"
              : "Cancellation request declined"
            : reviewDecision === "ACCEPTED"
              ? "Change request accepted"
              : "Change request declined",
      })
    } catch (reason) {
      sileo.error({
        title: "Couldn't review the request",
        description:
          reason instanceof Error ? reason.message : "Please try again.",
      })
    } finally {
      setReviewBusy(false)
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
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${project.status === "CANCELLED" ? "bg-rose-100 text-rose-800" : project.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-800" : project.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                >
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
          {project.canReviewChanges &&
            Boolean(project.changeRequests?.length) && (
              <section className="mt-5 rounded-xl border border-[#dce3eb] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-sm font-semibold">
                      Client project requests
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-[#667894]">
                      Review scope changes and cancellation requests sent by the
                      client.
                    </p>
                  </div>
                </div>
                <ul className="mt-4 list-none divide-y divide-[#e8edf2] p-0">
                  {project.changeRequests?.map((changeRequest) => (
                    <li
                      key={changeRequest.id}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-[#667894]">
                          {changeRequest.kind === "CANCELLATION"
                            ? "Cancellation request"
                            : "Change request"}
                          {" · "}
                          Requested by{" "}
                          {changeRequest.requestedBy.fullName || "Client"}
                          {" · "}
                          {formatDate(changeRequest.createdAt)}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${changeRequest.kind === "CANCELLATION" && changeRequest.status === "ACCEPTED" ? "bg-rose-100 text-rose-800" : changeRequest.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" : changeRequest.status === "NOT_APPROVED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
                        >
                          {changeRequest.kind === "CANCELLATION" &&
                          changeRequest.status === "ACCEPTED"
                            ? "Cancelled"
                            : changeRequest.status === "ACCEPTED"
                              ? "Accepted"
                              : changeRequest.status === "NOT_APPROVED"
                                ? "Not approved"
                                : "Under review"}
                        </span>
                      </div>
                      <p className="mt-3 mb-0 whitespace-pre-wrap text-xs leading-5 text-[#26364e] [overflow-wrap:anywhere]">
                        {changeRequest.details}
                      </p>
                      {changeRequest.responseNote && (
                        <p className="mt-2 mb-0 text-xs leading-5 text-[#667894]">
                          Response: {changeRequest.responseNote}
                        </p>
                      )}
                      {changeRequest.status === "PENDING" &&
                        (changeRequest.kind === "CANCELLATION" ||
                          ["IN_PROGRESS", "ON_HOLD"].includes(
                            project.status,
                          )) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className={`h-8 px-3 text-xs ${changeRequest.kind === "CANCELLATION" ? "bg-[#b53244] hover:bg-[#982a3a]" : "bg-[#243f8f] hover:bg-[#1d367d]"}`}
                              onClick={() => {
                                setReviewItem(changeRequest)
                                setReviewDecision("ACCEPTED")
                                setReviewOpen(true)
                              }}
                            >
                              {changeRequest.kind === "CANCELLATION"
                                ? "Approve cancellation"
                                : "Accept request"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-3 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => {
                                setReviewItem(changeRequest)
                                setReviewDecision("NOT_APPROVED")
                                setReviewOpen(true)
                              }}
                            >
                              Not approve
                            </Button>
                          </div>
                        )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
                  {project.workspaceManaged
                    ? project.milestones.filter(
                        (item) => item.deliveryStatus === "SENT_TO_CLIENT",
                      ).length
                    : project.milestones.filter((item) => item.completedAt)
                        .length}
                  /{project.milestones.length}{" "}
                  {project.workspaceManaged ? "sent" : "completed"}
                </span>
              </div>
              {project.milestones.length ? (
                <ul className="mt-4 list-none divide-y divide-border p-0">
                  {project.milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="flex items-center gap-3 py-4"
                    >
                      {(
                        project.workspaceManaged
                          ? milestone.deliveryStatus === "SENT_TO_CLIENT"
                          : Boolean(milestone.completedAt)
                      ) ? (
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
                        {project.workspaceManaged ? (
                          <span
                            className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] ${deliverableStatusClass(milestone.deliveryStatus)}`}
                          >
                            {deliverableStatusLabel(milestone.deliveryStatus)}
                          </span>
                        ) : milestone.completedAt ? (
                          <p className="mt-1 mb-0 text-[11px] text-muted-foreground">
                            Completed {formatDate(milestone.completedAt)}
                          </p>
                        ) : null}
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
                      ? formatDate(project.startDate)
                      : "Not started"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </>
      )}
      {reviewItem && (
        <ReviewProjectChangeDialog
          key={`${reviewOpen}-${reviewDecision}-${reviewItem.id}`}
          open={reviewOpen}
          requestKind={reviewItem.kind}
          decision={reviewDecision}
          requestDetails={reviewItem.details}
          busy={reviewBusy}
          onOpenChange={setReviewOpen}
          onSubmit={(responseNote) => void submitChangeReview(responseNote)}
        />
      )}
    </main>
  )
}
