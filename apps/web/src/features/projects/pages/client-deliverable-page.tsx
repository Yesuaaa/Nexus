"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Download, FileText, RotateCcw } from "lucide-react"
import { sileo } from "sileo"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { pillToneClass, type PillTone } from "@/components/ui/pill"
import { contentClass } from "@/components/layout/styles"
import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs"
import {
  createClientDeliverablePreviewUrl,
  downloadClientDeliverable,
  getProject,
  reviewClientDeliverable,
  type ProjectDeliverable,
  type ProjectWorkspace,
} from "../api/projects-api"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { RequestDeliverableRevisionDialog } from "../components/client-project-forms"
import { errorMessage } from "@/lib/error-message"

function reviewTone(status?: string): PillTone {
  if (status === "APPROVED") return "success"
  if (status === "REVISION_REQUESTED") return "danger"
  return "warning"
}

function reviewLabel(status?: string) {
  if (status === "APPROVED") return "Approved"
  if (status === "REVISION_REQUESTED") return "Revision requested"
  return "Awaiting your review"
}

export function ClientDeliverablePage({
  projectId,
  deliverableId,
}: {
  projectId: string
  deliverableId: string
}) {
  const { formatDate } = useDatePreferences()
  const [project, setProject] = useState<ProjectWorkspace | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const previewRef = useRef<string | null>(null)

  useBreadcrumbLabel(projectId, project?.name)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const result = await getProject(projectId, signal)
      const found = result.deliverables?.find(
        (item) => item.id === deliverableId,
      )
      if (!found) throw new Error("Shared deliverable not found")
      if (
        ["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(
          found.workflowFile.mimeType,
        )
      ) {
        const url = await createClientDeliverablePreviewUrl(
          projectId,
          deliverableId,
        )
        if (signal?.aborted) {
          URL.revokeObjectURL(url)
          return { project: result, previewUrl: null }
        }
        return { project: result, previewUrl: url }
      }
      return { project: result, previewUrl: null }
    },
    [deliverableId, projectId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then(({ project: nextProject, previewUrl: nextPreviewUrl }) => {
        if (controller.signal.aborted) {
          if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl)
          return
        }
        setProject(nextProject)
        setPreviewUrl(nextPreviewUrl)
        previewRef.current = nextPreviewUrl
        setError("")
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(errorMessage(reason, "Couldn't load this deliverable."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
  }, [load])

  const deliverable: ProjectDeliverable | undefined =
    project?.deliverables?.find((item) => item.id === deliverableId)
  const fileName = deliverable?.workflowFile.name
  const fileExtension = fileName?.match(/\.[^.]+$/)?.[0] ?? "No extension"
  useBreadcrumbLabel(deliverableId, deliverable?.title)
  const review = useMemo(
    () =>
      deliverable?.clientReviews.find(
        (item) => item.workflowFileId === deliverable.workflowFile.id,
      ),
    [deliverable],
  )
  const canReview = project?.status !== "CANCELLED" && !review

  async function submitReview(
    decision: "APPROVED" | "REVISION_REQUESTED",
    note = "",
  ) {
    if (busy) return
    setBusy(true)
    try {
      const updated = await reviewClientDeliverable(
        projectId,
        deliverableId,
        decision,
        note,
      )
      setProject(updated)
      setApproveOpen(false)
      setRevisionOpen(false)
      sileo.success({
        title:
          decision === "APPROVED"
            ? "Deliverable approved"
            : "Revision request sent",
      })
    } catch (reason) {
      sileo.error({
        title: "Couldn't save your response",
        description: errorMessage(reason, "Please try again."),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`${contentClass} p-6 max-[767px]:p-4`}>
      {loading ? (
        <p role="status" className="py-12 text-center text-sm text-[#60718c]">
          Loading deliverable…
        </p>
      ) : error || !project || !deliverable ? (
        <>
          <Alert as="div" className="rounded-xl p-5 text-sm">
            {error || "This deliverable could not be found."}
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/projects/${encodeURIComponent(projectId)}`}>
              <ArrowLeft size={16} /> Back to project
            </Link>
          </Button>
        </>
      ) : (
        <>
          <header className="border-b border-[#e5e9ee] px-7 pt-6 pb-5 max-[767px]:px-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <Link
                  href={`/projects/${encodeURIComponent(project.id)}?tab=deliverables`}
                  aria-label={`Back to ${project.name} deliverables`}
                  className="mt-[6px] inline-flex shrink-0 items-center text-[#60718c] no-underline hover:text-[#243f8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/35"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </Link>
                <div className="min-w-0">
                  <h1 className="m-0 break-words text-[24px] leading-tight font-semibold tracking-[-0.025em]">
                    {deliverable.title}
                  </h1>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${pillToneClass(reviewTone(review?.status))}`}
              >
                {reviewLabel(review?.status)}
              </span>
            </div>
          </header>

          <div className="grid gap-5 p-7 xl:grid-cols-[minmax(0,1fr)_300px] max-[767px]:p-4">
            <section className="overflow-hidden rounded-xl border border-[#dce3eb] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf2] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <FileText
                    size={16}
                    className="text-[#31518f]"
                    aria-hidden="true"
                  />
                  File preview
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    void downloadClientDeliverable(projectId, deliverable)
                  }
                >
                  <Download size={15} aria-hidden="true" /> Download
                </Button>
              </div>
              {previewUrl ? (
                <iframe
                  title={`Preview: ${deliverable.workflowFile.name}`}
                  src={previewUrl}
                  className="h-[min(70dvh,800px)] min-h-[420px] w-full border-0 bg-[#f4f6f9]"
                />
              ) : (
                <div className="grid min-h-[420px] place-items-center bg-[#f4f6f9] p-8 text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-[#31518f] shadow-sm">
                      <FileText size={22} aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 mb-0 text-sm font-semibold">
                      Preview unavailable
                    </h2>
                    <p className="mt-2 mb-0 text-xs leading-5 text-[#667894]">
                      Download this file to review it on your device.
                    </p>
                    <Button
                      type="button"
                      variant="brand"
                      className="mt-4"
                      onClick={() =>
                        void downloadClientDeliverable(projectId, deliverable)
                      }
                    >
                      <Download size={15} aria-hidden="true" /> Download file
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <aside className="h-fit rounded-xl border border-[#dce3eb] bg-white p-5">
              <h2 className="m-0 text-sm font-semibold">Deliverable details</h2>
              <dl className="mt-3 divide-y divide-[#e9edf2] text-xs">
                <div className="py-3">
                  <dt className="text-[11px] text-[#71839d]">Project</dt>
                  <dd className="mt-1.5 ml-0 font-medium text-[#1c2a3e]">
                    {project.name}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-[11px] text-[#71839d]">File name</dt>
                  <dd className="mt-1.5 ml-0 break-all text-[#1c2a3e]">
                    {deliverable.workflowFile.name}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-[11px] text-[#71839d]">File extension</dt>
                  <dd className="mt-1.5 ml-0 text-[#1c2a3e]">
                    {fileExtension}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-[11px] text-[#71839d]">Shared</dt>
                  <dd className="mt-1.5 ml-0 text-[#1c2a3e]">
                    {deliverable.sentToClientAt
                      ? formatDate(deliverable.sentToClientAt)
                      : formatDate(deliverable.workflowFile.createdAt)}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-[11px] text-[#71839d]">File type</dt>
                  <dd className="mt-1.5 ml-0 break-all text-[#1c2a3e]">
                    {deliverable.workflowFile.mimeType}
                  </dd>
                </div>
                {deliverable.description && (
                  <div className="py-3">
                    <dt className="text-[11px] text-[#71839d]">Description</dt>
                    <dd className="mt-1.5 ml-0 whitespace-pre-wrap leading-5 text-[#1c2a3e] [overflow-wrap:anywhere]">
                      {deliverable.description}
                    </dd>
                  </div>
                )}
              </dl>
              {review?.note && (
                <div className="mt-2 rounded-lg bg-[#fff5e8] p-3 text-xs leading-5 text-[#75521e]">
                  <span className="font-medium">Your revision note: </span>
                  {review.note}
                </div>
              )}
              {canReview ? (
                <div className="mt-4 grid gap-2 border-t border-[#e9edf2] pt-4">
                  <Button
                    type="button"
                    variant="brand"
                    className="w-full"
                    onClick={() => setApproveOpen(true)}
                  >
                    <Check size={16} aria-hidden="true" /> Approve deliverable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRevisionOpen(true)}
                  >
                    <RotateCcw size={15} aria-hidden="true" /> Request a
                    revision
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2.5 border-t border-[#e9edf2] pt-4 text-xs leading-5 text-[#60718c]">
                  <Check
                    size={15}
                    className="mt-0.5 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  <p className="m-0">
                    {review?.status === "APPROVED"
                      ? "You approved this version."
                      : review?.status === "REVISION_REQUESTED"
                        ? "Your revision request was sent to the project team."
                        : "This project is not accepting deliverable reviews right now."}
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      {deliverable && (
        <>
          <ConfirmationDialog
            open={approveOpen}
            title="Approve this deliverable?"
            description={`This confirms that “${deliverable.title}” meets the agreed expectations.`}
            confirmLabel="Approve deliverable"
            pendingLabel="Saving…"
            cancelLabel="Go back"
            pending={busy}
            destructive={false}
            onClose={() => setApproveOpen(false)}
            onConfirm={() => void submitReview("APPROVED")}
          />
          <RequestDeliverableRevisionDialog
            key={revisionOpen ? "revision-open" : "revision-closed"}
            open={revisionOpen}
            busy={busy}
            onOpenChange={setRevisionOpen}
            onSubmit={(note) => void submitReview("REVISION_REQUESTED", note)}
          />
        </>
      )}
    </main>
  )
}
