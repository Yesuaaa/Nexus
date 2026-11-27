"use client"

import { useState } from "react"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill, type PillTone } from "@/components/ui/pill"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  reviewProjectCancellationRequest,
  reviewProjectChangeRequest,
  type ProjectChangeRequest,
} from "@/features/projects/api/projects-api"
import { ReviewProjectChangeDialog } from "@/features/projects/components/client-project-forms"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import type {
  ProjectWorkspaceDetail,
  ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"

type ReviewSelection = {
  projectId: string
  request: ProjectChangeRequest
}

function requestStatusTone(status: ProjectChangeRequest["status"]): PillTone {
  if (status === "ACCEPTED") return "success"
  if (status === "NOT_APPROVED") return "danger"
  return "warning"
}

function requestStatusLabel(request: ProjectChangeRequest) {
  if (request.kind === "CANCELLATION" && request.status === "ACCEPTED")
    return "Cancelled"
  if (request.status === "ACCEPTED") return "Accepted"
  if (request.status === "NOT_APPROVED") return "Not approved"
  return "Pending review"
}

function RequestCard({
  stream,
  request,
  formatDate,
  onReview,
}: {
  stream: ProjectWorkspaceWorkstream
  request: ProjectChangeRequest
  formatDate: (value: string) => string
  onReview: (decision: "ACCEPTED" | "NOT_APPROVED") => void
}) {
  const canReview =
    stream.canReviewRequests &&
    request.status === "PENDING" &&
    ["IN_PROGRESS", "ON_HOLD"].includes(stream.status)
  return (
    <article className="rounded-xl border border-[#dfe4ec] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={request.kind === "CANCELLATION" ? "danger" : "brand"}>
            {request.kind === "CANCELLATION" ? "Cancellation" : "Change"}
          </Pill>
          <Pill tone={requestStatusTone(request.status)}>
            {requestStatusLabel(request)}
          </Pill>
        </div>
        <span className="text-[11px] text-[#738096]">
          {request.requestedBy.fullName || "Client"} ·{" "}
          {formatDate(request.createdAt)}
        </span>
      </div>
      <p className="mt-3 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#263247] [overflow-wrap:anywhere]">
        {request.details}
      </p>
      {request.responseNote && (
        <p className="mt-3 mb-0 rounded-lg bg-[#f4f6fa] p-3 text-xs leading-5 text-[#52627a]">
          Response: {request.responseNote}
        </p>
      )}
      {canReview && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onReview("NOT_APPROVED")}>
            Decline
          </Button>
          <Button variant="brand" onClick={() => onReview("ACCEPTED")}>
            Accept
          </Button>
        </div>
      )}
    </article>
  )
}

export function WorkspaceRequests({
  workspace,
  onChanged,
}: {
  workspace: ProjectWorkspaceDetail
  onChanged: () => void
}) {
  const { formatDate } = useDatePreferences()
  const [selection, setSelection] = useState<ReviewSelection | null>(null)
  const [decision, setDecision] = useState<"ACCEPTED" | "NOT_APPROVED">(
    "ACCEPTED",
  )
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const requests = workspace.workstreams.flatMap((stream) =>
    (stream.changeRequests ?? []).map((request) => ({ stream, request })),
  )

  async function submitReview(responseNote: string) {
    if (!selection || busy) return
    setBusy(true)
    try {
      const { projectId, request } = selection
      if (request.kind === "CANCELLATION")
        await reviewProjectCancellationRequest(
          projectId,
          request.id,
          decision,
          responseNote,
        )
      else
        await reviewProjectChangeRequest(
          projectId,
          request.id,
          decision,
          responseNote,
        )
      setOpen(false)
      setSelection(null)
      onChanged()
      sileo.success({
        title:
          decision === "ACCEPTED"
            ? "Project request accepted"
            : "Project request declined",
      })
    } catch (reason) {
      sileo.error({
        title: "Couldn't review the project request",
        description: errorMessage(reason, "Please try again."),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Project requests" className="space-y-4">
      <header>
        <h2 className="m-0 text-sm font-semibold">Project requests</h2>
        <p className="mt-1 mb-0 text-xs text-[#65718a]">
          Client change and cancellation requests for each project workstream.
          Department Heads can decide through the existing review workflow.
        </p>
      </header>
      {requests.length ? (
        workspace.workstreams.map((stream) => {
          const streamRequests = stream.changeRequests ?? []
          if (!streamRequests.length) return null
          return (
            <section key={stream.id} className="space-y-3">
              <h3 className="m-0 text-xs font-semibold text-[#52627a]">
                {stream.serviceName}
              </h3>
              {streamRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  stream={stream}
                  request={request}
                  formatDate={formatDate}
                  onReview={(nextDecision) => {
                    setSelection({ projectId: stream.id, request })
                    setDecision(nextDecision)
                    setOpen(true)
                  }}
                />
              ))}
            </section>
          )
        })
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No project requests"
          description="Client change or cancellation requests will appear here."
          size="md"
        />
      )}
      {selection && (
        <ReviewProjectChangeDialog
          key={`${open}-${decision}-${selection.request.id}`}
          open={open}
          requestKind={selection.request.kind}
          decision={decision}
          requestDetails={selection.request.details}
          busy={busy}
          onOpenChange={setOpen}
          onSubmit={(responseNote) => void submitReview(responseNote)}
        />
      )}
    </section>
  )
}
