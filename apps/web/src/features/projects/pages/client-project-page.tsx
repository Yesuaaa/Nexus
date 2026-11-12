"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  Clock3,
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  Info,
  Plus,
  UsersRound,
} from "lucide-react"
import { sileo } from "sileo"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill, pillToneClass, type PillTone } from "@/components/ui/pill"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
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
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { statusLabel, statusTone } from "../model/project-status"

type ClientTab = "overview" | "deliverables" | "notes" | "team"

function changeStatusTone(request: ProjectChangeRequest): PillTone {
  if (request.kind === "CANCELLATION" && request.status === "ACCEPTED")
    return "danger"
  if (request.status === "ACCEPTED") return "success"
  if (request.status === "NOT_APPROVED") return "danger"
  return "warning"
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
  const {
    data: project,
    error,
    loading,
    setData: setProject,
  } = useAsyncResource<ProjectWorkspace>(
    (signal) => getProject(projectId, signal),
    [projectId],
    { fallbackError: "Couldn't load this project." },
  )
  const [tab] = useState<ClientTab>(initialTab)
  const [busy, setBusy] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)

  useBreadcrumbLabel(projectId, project?.name)

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
    if (busy) return false
    setBusy(true)
    try {
      setProject(await updateProjectBrief(projectId, brief))
      sileo.success({ title: "Project brief updated" })
      return true
    } catch (reason) {
      sileo.error({
        title: "Couldn't update the brief",
        description: errorMessage(reason, "Please try again."),
      })
      return false
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
        description: errorMessage(reason, "Please try again."),
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
        <Alert as="div" className="rounded-xl p-5 text-sm">
          {error || "This project could not be found."}
        </Alert>
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
      <ClientPageHeader
        eyebrow="Project Overview"
        title={<span className="[overflow-wrap:anywhere]">{project.name}</span>}
        description={project.request?.service.name || "Project"}
        actions={
          <Pill
            tone={statusTone(project.status)}
            className="tracking-normal capitalize"
          >
            {statusLabel(project.status)}
          </Pill>
        }
      />
      <Tabs value={tab}>
        <TabsContent value="overview" className="mt-5 grid gap-4">
          <section className="overflow-hidden rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
            <dl className="m-0 grid gap-5 border-b border-[#e5e9ee] pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
              {[
                ["Service", project.request?.service.name || "—"],
                [
                  "Started",
                  project.startDate
                    ? formatDate(project.startDate)
                    : "Not started",
                ],
                ["Reference No.", project.request?.referenceNumber || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs text-[#52627a]">{label}</dt>
                  <dd className="m-0 min-w-0 text-xs font-medium [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-[#eaeff1] p-4 md:p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#ccd5e2] bg-white text-[#203f8c]">
                <Clock3 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-[145px]">
                <p className="m-0 text-xs text-[#52627a]">
                  {progress.total
                    ? `${progress.completed} of ${progress.total} tasks complete`
                    : "No tasks scheduled yet"}
                </p>
                <p className="mt-1 mb-0 text-2xl leading-none font-semibold tabular-nums text-[#203f8c]">
                  {progressPercent}%
                </p>
              </div>
              <div
                className="min-w-[220px] flex-1 overflow-hidden rounded-full bg-[#dfe6ef]"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Task progress"
              >
                <div
                  className="h-2 rounded-full bg-[#294c96] transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9ee] pb-3">
              <h2 className="m-0 text-base font-semibold">Project brief</h2>
              {editable && !pendingCancellation && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBriefOpen(true)}
                >
                  <Pencil size={15} aria-hidden="true" /> Edit brief
                </Button>
              )}
            </div>
            <p className="mt-3 mb-0 whitespace-pre-wrap text-xs leading-6 text-[#5f718b] [overflow-wrap:anywhere]">
              {project.description || "No project brief has been added yet."}
            </p>
          </section>

          <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9ee] pb-3">
              <h2 className="m-0 text-base font-semibold">Project requests</h2>
              {editable && (
                <Button
                  type="button"
                  disabled={!canStartProjectRequest || busy}
                  onClick={() => setRequestOpen(true)}
                  className={clientPageHeaderActionClass}
                >
                  <Plus size={16} aria-hidden="true" />
                  {canStartProjectRequest
                    ? "New project request"
                    : "Request under review"}
                </Button>
              )}
            </div>
            {changeRequests.length ? (
              <ul className="mt-4 list-none divide-y divide-[#e9edf2] p-0">
                {changeRequests.map((request) => (
                  <li key={request.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${pillToneClass(changeStatusTone(request))}`}
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
                <Info
                  size={17}
                  className="mt-0.5 shrink-0 text-[#58729e]"
                  aria-hidden="true"
                />
                <div>
                  <p className="m-0 text-xs font-semibold">
                    No project requests yet
                  </p>
                  <p className="mt-1 mb-0 text-xs text-[#52627a]">
                    {project.request
                      ? "Scope changes and cancellation requests will appear here."
                      : "Scope change requests will appear here."}
                  </p>
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
              <h2 className="m-0 border-b border-[#e5e9ee] pb-3 text-base font-semibold">
                Latest notes
              </h2>
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#eaeff1] p-4">
                <FileText
                  size={17}
                  className="mt-0.5 shrink-0 text-[#58729e]"
                  aria-hidden="true"
                />
                <p className="m-0 text-xs text-[#52627a]">
                  No notes added yet.
                </p>
              </div>
            </section>
            <section className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
              <h2 className="m-0 border-b border-[#e5e9ee] pb-3 text-base font-semibold">
                Project team
              </h2>
              <div className="mt-4 rounded-lg bg-[#eaeff1] p-4">
                <p className="m-0 text-xs font-semibold">Team lead</p>
                <p className="mt-1 mb-0 text-xs text-[#52627a]">
                  No team lead assigned.
                </p>
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="notes" className="mt-5">
          <section aria-label="Project notes">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold">Project notes</h2>
                <p className="mt-1 mb-0 text-xs text-[#738096]">
                  Notes and project context shared with you.
                </p>
              </div>
            </div>
            {project.description ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <article className="group relative aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-2xl bg-[#294c96] p-6 text-white shadow-[0_8px_24px_rgb(26_58_128_/_10%)]">
                  <span
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,transparent_40%,rgb(20_54_129_/_42%))]"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex h-full min-w-0 flex-col">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-current bg-[rgb(22_48_105_/_10%)]">
                      <FileText
                        size={24}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="mt-auto min-w-0">
                      <h3 className="m-0 text-xl leading-tight font-bold tracking-[-0.025em]">
                        Project brief
                      </h3>
                      <p className="mt-2 mb-0 whitespace-pre-wrap text-sm leading-6 text-white/80 [overflow-wrap:anywhere]">
                        {project.description}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            ) : (
              <section className="grid min-h-[230px] w-full max-w-[340px] place-items-center rounded-2xl border border-dashed border-[#ccd7e8] bg-white px-6 text-center">
                <div>
                  <FileText
                    size={24}
                    className="mx-auto text-[#58729e]"
                    aria-hidden="true"
                  />
                  <p className="mt-3 mb-0 text-sm font-semibold text-[#243c69]">
                    No notes added yet
                  </p>
                </div>
              </section>
            )}
          </section>
        </TabsContent>
        <TabsContent value="team" className="mt-5">
          <section aria-label="Project team">
            <div className="mb-4">
              <h2 className="m-0 text-base font-semibold">Project team</h2>
              <p className="mt-1 mb-0 text-xs text-[#738096]">
                People assigned to this project.
              </p>
            </div>
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex justify-center">
                <article className="w-full max-w-[360px] rounded-2xl border border-[#dce3eb] bg-white p-5 shadow-[0_4px_14px_rgb(31_55_94_/_5%)]">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-[#245bc4] bg-[#f7f9fc] text-[#245bc4]">
                      <UsersRound
                        size={22}
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-sm font-semibold text-[#17243b]">
                        Team lead
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[#738096]">
                        <Info size={14} aria-hidden="true" />
                        <span>No team lead assigned.</span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
              <div className="mx-auto mt-4 grid max-w-3xl gap-4 md:grid-cols-2">
                {[0, 1].map((memberIndex) => (
                  <article
                    key={memberIndex}
                    className="min-w-0 rounded-2xl border border-dashed border-[#ccd7e8] bg-[#f7f9fc] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-[#6547d7] bg-white text-[#6547d7]">
                        <UsersRound
                          size={22}
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <h3 className="m-0 text-sm font-semibold text-[#17243b]">
                          Team member
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#738096]">
                          <Info size={14} aria-hidden="true" />
                          <span>No team member assigned yet.</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </TabsContent>
        <TabsContent
          value="deliverables"
          className="mt-5 space-y-4 rounded-xl border border-[#dce3eb] bg-white p-5"
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
            <ul className="m-0 grid list-none gap-2 p-0">
              {deliverables.map((deliverable) => {
                const review = deliverable.clientReviews.find(
                  (item) => item.workflowFileId === deliverable.workflowFile.id,
                )
                const reviewLabel = review
                  ? review.status === "APPROVED"
                    ? "Approved"
                    : "Revision requested"
                  : "Awaiting your review"
                return (
                  <li
                    key={deliverable.id}
                    className="grid min-h-[66px] grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,120px)_32px] items-center gap-x-4 gap-y-2 rounded-xl border border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 max-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,130px)_32px] max-[767px]:grid-cols-[minmax(0,1fr)_32px]"
                  >
                    <div className="flex min-w-0 items-center gap-3 lg:border-r lg:border-[#e1e7ef] lg:pr-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-current text-[#6b46e5]">
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
                    <Pill
                      tone={
                        review?.status === "APPROVED"
                          ? "success"
                          : review?.status === "REVISION_REQUESTED"
                            ? "danger"
                            : "warning"
                      }
                      className="max-[767px]:col-start-1 max-[767px]:row-start-2"
                    >
                      {reviewLabel}
                    </Pill>
                    <span className="text-xs text-[#60718c] max-[1024px]:col-start-1 max-[1024px]:row-start-2 max-[767px]:row-start-3">
                      {deliverable.sentToClientAt
                        ? formatDate(deliverable.sentToClientAt)
                        : formatDate(deliverable.workflowFile.createdAt)}
                    </span>
                    <Link
                      href={`/projects/${encodeURIComponent(project.id)}/deliverables/${encodeURIComponent(deliverable.id)}`}
                      className={`${rowActionButton} justify-self-end max-[1024px]:col-start-3 max-[1024px]:row-start-1 max-[767px]:col-start-2`}
                      aria-label={`View ${deliverable.title}`}
                    >
                      <Eye size={16} aria-hidden="true" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              as="section"
              size="lg"
              icon={FileText}
              title="No deliverables shared yet"
              description="When your project team shares a reviewed file, you can open it here and approve it or request a revision."
              className="bg-white/60"
            />
          )}
        </TabsContent>
      </Tabs>

      <Link
        href={`/messages?project=${encodeURIComponent(project.id)}`}
        aria-label="Open project chat"
        className="fixed right-6 bottom-6 z-20 grid size-14 place-items-center rounded-full bg-[#203f8c] text-white shadow-[0_10px_26px_rgb(20_30_50_/_18%)] transition-colors hover:bg-[#172f70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] max-[767px]:right-4 max-[767px]:bottom-4"
      >
        <MessageSquare size={24} strokeWidth={1.8} aria-hidden="true" />
      </Link>

      {briefOpen && (
        <ClientProjectBriefDrawer
          name={project.name}
          description={project.description ?? ""}
          busy={busy}
          onClose={() => setBriefOpen(false)}
          onSave={saveBrief}
        />
      )}
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
