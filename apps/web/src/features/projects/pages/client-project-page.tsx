"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  Clock3,
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  Send,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { contentClass } from "@/components/layout/styles"
import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs"
import {
  createProjectCancellationRequest,
  createProjectChangeRequest,
  getProject,
  updateProjectBrief,
  type ProjectChangeRequest,
  type ProjectChangeRequestKind,
  type ProjectWorkspace,
} from "../api/projects-api"
import {
  ClientProjectBriefDrawer,
  RequestProjectDialog,
} from "../components/client-project-forms"

type ClientTab = "overview" | "deliverables"

function statusClass(status: string) {
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800"
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800"
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (status === "ON_HOLD") return "bg-orange-100 text-orange-800"
  return "bg-slate-100 text-slate-700"
}

function changeStatusClass(request: ProjectChangeRequest) {
  if (request.kind === "CANCELLATION" && request.status === "ACCEPTED")
    return "bg-rose-100 text-rose-800"
  if (request.status === "ACCEPTED") return "bg-emerald-100 text-emerald-800"
  if (request.status === "NOT_APPROVED") return "bg-rose-100 text-rose-700"
  return "bg-amber-100 text-amber-800"
}

function changeStatusLabel(request: ProjectChangeRequest) {
  if (request.kind === "CANCELLATION" && request.status === "ACCEPTED")
    return "Cancelled"
  const { status } = request
  if (status === "ACCEPTED") return "Accepted"
  if (status === "NOT_APPROVED") return "Not approved"
  return "Under review"
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClientProjectPage({
  projectId,
  initialTab = "overview",
}: {
  projectId: string
  initialTab?: ClientTab
}) {
  const { formatDate } = useDatePreferences()
  const [project, setProject] = useState<ProjectWorkspace | null>(null)
  const [tab, setTab] = useState<ClientTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)

  useBreadcrumbLabel(projectId, project?.name)

  useEffect(() => {
    const controller = new AbortController()
    getProject(projectId, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setProject(next)
          setError("")
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load this project.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [projectId])

  function selectTab(next: ClientTab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === "deliverables") url.searchParams.set("tab", next)
    else url.searchParams.delete("tab")
    window.history.replaceState(null, "", url)
  }

  const progress = project?.progress ?? { completed: 0, total: 0 }
  const progressPercent = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0
  const deliverables = project?.deliverables ?? []
  const changeRequests = project?.changeRequests ?? []
  const pendingChange = changeRequests.some(
    (request) => request.kind === "CHANGE" && request.status === "PENDING",
  )
  const pendingCancellation = changeRequests.some(
    (request) =>
      request.kind === "CANCELLATION" && request.status === "PENDING",
  )
  const editable =
    project?.status === "IN_PROGRESS" || project?.status === "ON_HOLD"
  const canRequestChange = editable && !pendingChange
  const canRequestCancellation =
    editable && !!project?.request && !pendingCancellation
  const cancellationDisabledReason = pendingCancellation
    ? "A cancellation request is already under review."
    : !project?.request
      ? "Cancellation requests need a linked booking so the Department Head can review them."
      : !editable
        ? "This project is no longer active."
        : null
  const canStartProjectRequest = canRequestChange || canRequestCancellation
  const defaultRequestKind: ProjectChangeRequestKind = canRequestChange
    ? "CHANGE"
    : "CANCELLATION"

  async function saveBrief(brief: { name: string; description: string }) {
    if (busy) return
    setBusy(true)
    try {
      setProject(await updateProjectBrief(projectId, brief))
      setBriefOpen(false)
      sileo.success({ title: "Project brief updated" })
    } catch (reason) {
      sileo.error({
        title: "Couldn't update the brief",
        description:
          reason instanceof Error ? reason.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function submitProjectRequest(
    kind: ProjectChangeRequestKind,
    details: string,
  ) {
    if (busy) return
    setBusy(true)
    try {
      const update =
        kind === "CANCELLATION"
          ? createProjectCancellationRequest(projectId, details)
          : createProjectChangeRequest(projectId, details)
      setProject(await update)
      setRequestOpen(false)
      sileo.success({
        title:
          kind === "CANCELLATION"
            ? "Cancellation request sent for review"
            : "Change request sent",
      })
    } catch (reason) {
      sileo.error({
        title:
          kind === "CANCELLATION"
            ? "Couldn't send the cancellation request"
            : "Couldn't send the change request",
        description:
          reason instanceof Error ? reason.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className={`${contentClass} p-6 max-[767px]:p-4`}>
        <p role="status" className="py-12 text-center text-sm text-[#60718c]">
          Loading project…
        </p>
      </main>
    )
  }
  if (error || !project) {
    return (
      <main className={`${contentClass} p-6 max-[767px]:p-4`}>
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
        >
          {error || "This project could not be found."}
        </div>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/projects">
            <ArrowLeft size={16} />
            Back to My Projects
          </Link>
        </Button>
      </main>
    )
  }

  return (
    <main className={`${contentClass} p-6 max-[767px]:p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e9ee] px-7 pt-6 pb-0 max-[767px]:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="m-0 text-[24px] leading-tight font-semibold tracking-[-0.025em]">
              {project.name}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(project.status)}`}
            >
              {project.status.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-2 mb-0 text-xs text-[#60718c]">
            {project.request?.service.name || "Project"}
            {project.request?.referenceNumber && (
              <span> · {project.request.referenceNumber}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-4 max-[767px]:pt-0">
          {editable && !pendingCancellation && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setBriefOpen(true)}
            >
              <Pencil size={15} aria-hidden="true" /> Edit brief
            </Button>
          )}
          {editable && (
            <Button
              type="button"
              disabled={!canStartProjectRequest || busy}
              onClick={() => setRequestOpen(true)}
              className="bg-[#243f8f] hover:bg-[#1d367d]"
            >
              <Send size={15} aria-hidden="true" />
              {canStartProjectRequest
                ? "New project request"
                : "Request under review"}
            </Button>
          )}
          {project.startDate && (
            <Link
              href={`/messages?project=${encodeURIComponent(project.id)}`}
              className={`${rowActionButton} size-9 hover:bg-[#f1f5fc] hover:text-foreground`}
              aria-label="Open project conversation"
              title="Chat with project team"
            >
              <MessageSquare size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="w-full border-t border-[#e5e9ee]">
          <div
            className="flex gap-5"
            role="tablist"
            aria-label="Project sections"
          >
            {(
              [
                ["overview", "Overview"],
                [
                  "deliverables",
                  `Deliverables${deliverables.length ? ` (${deliverables.length})` : ""}`,
                ],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`${key}-panel`}
                onClick={() => selectTab(key)}
                className={`relative -mb-px min-h-11 border-0 border-b-2 bg-transparent px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/35 ${tab === key ? "border-[#243f8f] text-[#183a85]" : "border-transparent text-[#6b7d96] hover:text-[#203e81]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "overview" ? (
        <div
          id="overview-panel"
          role="tabpanel"
          className="space-y-5 p-7 max-[767px]:p-4"
        >
          <section className="overflow-hidden rounded-xl border border-[#dce3eb] bg-white">
            <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="p-5 md:p-6">
                <h2 className="m-0 text-sm font-semibold">Project details</h2>
                <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {[
                    ["Service", project.request?.service.name || "—"],
                    [
                      "Request reference",
                      project.request?.referenceNumber || "—",
                    ],
                    ["Status", project.status.replaceAll("_", " ")],
                    [
                      "Started",
                      project.startDate
                        ? formatDate(project.startDate)
                        : "Not started",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-[#edf0f4] pb-3">
                      <dt className="text-[11px] text-[#687b96]">{label}</dt>
                      <dd className="mt-1.5 ml-0 text-xs font-medium text-[#16233a]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="border-t border-[#e7ecf1] bg-[#f7f9fc] p-5 md:border-t-0 md:border-l md:p-6">
                <p className="m-0 text-xs text-[#61748f]">Overall progress</p>
                <p className="mt-2 mb-0 text-[31px] leading-none font-semibold text-[#203f8c]">
                  {progressPercent}
                  <span className="text-base">%</span>
                </p>
                <p className="mt-2 mb-0 text-[11px] text-[#71839d]">
                  {progress.completed} of {progress.total} tasks complete
                </p>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-[#e0e6ef]"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Overall project progress"
                >
                  <div
                    className="h-full rounded-full bg-[#2c4e9b] transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
            <h2 className="m-0 text-sm font-semibold">Project brief</h2>
            <p className="mt-3 mb-0 whitespace-pre-wrap text-xs leading-6 text-[#5f718b] [overflow-wrap:anywhere]">
              {project.description || "No project brief has been added yet."}
            </p>
          </section>

          <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm font-semibold">Project requests</h2>
                <p className="mt-1 mb-0 text-[11px] text-[#71839d]">
                  Track scope changes and cancellation requests.
                </p>
              </div>
            </div>
            {changeRequests.length ? (
              <ul className="mt-4 list-none divide-y divide-[#e9edf2] p-0">
                {changeRequests.map((request) => (
                  <li key={request.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${changeStatusClass(request)}`}
                      >
                        {changeStatusLabel(request)}
                      </span>
                      <span className="text-[11px] text-[#71839d]">
                        Sent {formatDate(request.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 mb-0 text-[11px] font-medium text-[#60718c]">
                      {request.kind === "CANCELLATION"
                        ? "Cancellation request"
                        : "Change request"}
                    </p>
                    <p className="mt-3 mb-0 whitespace-pre-wrap text-xs leading-5 text-[#26364e] [overflow-wrap:anywhere]">
                      {request.details}
                    </p>
                    {request.responseNote && (
                      <p className="mt-2 mb-0 rounded-lg bg-[#f5f7fa] px-3 py-2 text-xs leading-5 text-[#60718c]">
                        <span className="font-medium text-[#26364e]">
                          Department response:{" "}
                        </span>
                        {request.responseNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#f7f9fc] p-4">
                <Clock3
                  size={17}
                  className="mt-0.5 shrink-0 text-[#58729e]"
                  aria-hidden="true"
                />
                <p className="m-0 text-xs leading-5 text-[#687b96]">
                  {project.request
                    ? 'No project requests yet. Use "New project request" above to ask the Department Head for a scope change or cancellation.'
                    : 'No project requests yet. Use "New project request" above to ask the Department Head for a scope change.'}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div
          id="deliverables-panel"
          role="tabpanel"
          className="space-y-4 p-7 max-[767px]:p-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold">
                Shared deliverables
              </h2>
              <p className="mt-1 mb-0 text-xs text-[#71839d]">
                Files the project team has reviewed and shared with you.
              </p>
            </div>
            <span className="text-xs text-[#71839d]">
              {deliverables.length}{" "}
              {deliverables.length === 1 ? "file" : "files"}
            </span>
          </div>
          {deliverables.length ? (
            <div className="overflow-hidden rounded-xl border border-[#dce3eb] bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_150px_170px_100px] gap-4 bg-[#e9eef3] px-4 py-3 text-[11px] font-semibold text-[#1c2b40] max-[800px]:grid-cols-[minmax(0,1fr)_130px_88px] max-[560px]:grid-cols-[minmax(0,1fr)_36px] max-[560px]:gap-3">
                <span>Deliverable</span>
                <span className="max-[800px]:hidden">Shared on</span>
                <span className="max-[560px]:hidden">Status</span>
                <span className="text-center">Open</span>
              </div>
              <ul className="m-0 list-none divide-y divide-[#e8edf2] p-0">
                {deliverables.map((deliverable) => {
                  const review = deliverable.clientReviews.find(
                    (item) =>
                      item.workflowFileId === deliverable.workflowFile.id,
                  )
                  const reviewLabel = review
                    ? review.status === "APPROVED"
                      ? "Approved"
                      : "Revision requested"
                    : "Awaiting your review"
                  return (
                    <li
                      key={deliverable.id}
                      className="grid grid-cols-[minmax(0,1fr)_150px_170px_100px] items-center gap-4 px-4 py-4 hover:bg-[#f9fbfd] max-[800px]:grid-cols-[minmax(0,1fr)_130px_88px] max-[560px]:grid-cols-[minmax(0,1fr)_36px] max-[560px]:gap-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf2fa] text-[#31518f]">
                          <FileText size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 break-words text-xs font-medium text-[#18263b]">
                            {deliverable.title}
                          </p>
                          <p className="mt-1 mb-0 truncate text-[11px] text-[#71839d]">
                            {deliverable.workflowFile.name} ·{" "}
                            {formatBytes(deliverable.workflowFile.size)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-[#60718c] max-[800px]:hidden">
                        {deliverable.sentToClientAt
                          ? formatDate(deliverable.sentToClientAt)
                          : formatDate(deliverable.workflowFile.createdAt)}
                      </span>
                      <span
                        className={`justify-self-start rounded-full px-2.5 py-1 text-[10px] font-medium max-[560px]:col-start-1 max-[560px]:row-start-2 ${review?.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : review?.status === "REVISION_REQUESTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
                      >
                        {reviewLabel}
                      </span>
                      <Button
                        variant="outline"
                        className="size-9 shrink-0 justify-self-center p-0 text-[#586d8a] max-[560px]:col-start-2 max-[560px]:row-span-2 max-[560px]:row-start-1"
                        asChild
                      >
                        <Link
                          href={`/projects/${encodeURIComponent(project.id)}/deliverables/${encodeURIComponent(deliverable.id)}`}
                          aria-label={`View ${deliverable.title}`}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </Link>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <section className="grid justify-items-center rounded-xl border border-dashed border-[#ccd7e5] bg-white/60 px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-[#edf2f9] text-[#2b4b97]">
                <FileText size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 mb-0 text-base font-semibold">
                No deliverables shared yet
              </h3>
              <p className="mt-2 mb-0 max-w-sm text-xs leading-5 text-[#667894]">
                When your project team shares a reviewed file, you can open it
                here and approve it or request a revision.
              </p>
            </section>
          )}
        </div>
      )}

      <ClientProjectBriefDrawer
        key={briefOpen ? "brief-open" : "brief-closed"}
        open={briefOpen}
        name={project.name}
        description={project.description ?? ""}
        busy={busy}
        onOpenChange={setBriefOpen}
        onSave={(brief) => void saveBrief(brief)}
      />
      <RequestProjectDialog
        key={requestOpen ? "request-open" : "request-closed"}
        open={requestOpen}
        busy={busy}
        changeAvailable={canRequestChange}
        cancellationAvailable={canRequestCancellation}
        cancellationDisabledReason={cancellationDisabledReason}
        defaultKind={defaultRequestKind}
        onOpenChange={setRequestOpen}
        onSubmit={(kind, details) => void submitProjectRequest(kind, details)}
      />
    </main>
  )
}
