"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { FormTextarea } from "@/components/ui/form-input"
import { Pill } from "@/components/ui/pill"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import {
  createProjectNote,
  createProjectNoteRevision,
  escalateProjectNoteRevision,
  reviewProjectNoteRevision,
  unpublishProjectNoteRevision,
  type ProjectNoteRevision,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceNote,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"

type NoteDraft = Record<string, string>
type ReviewDraft = Record<string, { feedback: string; clientVisible: boolean }>

function latestRevision(note: ProjectWorkspaceNote) {
  return note.revisions[note.revisions.length - 1]
}

function noteStatusLabel(status: ProjectNoteRevision["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "Awaiting review"
    case "ESCALATED":
      return "Head review"
    case "APPROVED":
      return "Approved"
    case "REVISION_REQUIRED":
      return "Changes requested"
    case "REJECTED":
      return "Rejected"
  }
}

function noteStatusTone(status: ProjectNoteRevision["status"]) {
  if (status === "APPROVED") return "success" as const
  if (status === "REJECTED") return "danger" as const
  if (status === "REVISION_REQUIRED") return "warning" as const
  return "info" as const
}

function canReviewRevision(
  stream: ProjectWorkspaceWorkstream,
  revision: ProjectNoteRevision,
  userId: string,
) {
  if (revision.authorId === userId) return false
  return (
    (stream.isTeamLead && revision.status === "SUBMITTED") ||
    (stream.isDepartmentHead &&
      (revision.status === "ESCALATED" ||
        (!stream.hasTeamLead && revision.status === "SUBMITTED")))
  )
}

export function WorkspaceNotes({
  workspace,
  onUpdated,
}: {
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
}) {
  const account = usePortalAccount()
  const { formatDate } = useDatePreferences()
  const [noteDrafts, setNoteDrafts] = useState<NoteDraft>({})
  const [revisionDrafts, setRevisionDrafts] = useState<NoteDraft>({})
  const [reviewDrafts, setReviewDrafts] = useState<ReviewDraft>({})
  const [busyKey, setBusyKey] = useState("")
  const [error, setError] = useState("")
  const notes = workspace.workstreams.flatMap((stream) =>
    (stream.notes ?? []).map((note) => ({ stream, note })),
  )

  async function save(
    key: string,
    request: Promise<ProjectWorkspaceDetail>,
    message: string,
  ) {
    if (busyKey) return
    setBusyKey(key)
    setError("")
    try {
      onUpdated(await request)
      sileo.success({ title: message })
      return true
    } catch (reason) {
      const message = errorMessage(reason, "Couldn't update the project note.")
      setError(message)
      sileo.error({ title: "Project note update failed", description: message })
      return false
    } finally {
      setBusyKey("")
    }
  }

  async function submitNote(stream: ProjectWorkspaceWorkstream) {
    const content = noteDrafts[stream.id]?.trim() ?? ""
    if (!content || content.length > 4000) return
    if (
      await save(
        `note-${stream.id}`,
        createProjectNote(workspace.id, stream.id, content),
        "Note submitted for review",
      )
    )
      setNoteDrafts((current) => ({ ...current, [stream.id]: "" }))
  }

  async function submitRevision(
    stream: ProjectWorkspaceWorkstream,
    note: ProjectWorkspaceNote,
  ) {
    const content = revisionDrafts[note.id]?.trim() ?? ""
    if (!content || content.length > 4000) return
    if (
      await save(
        `revision-${note.id}`,
        createProjectNoteRevision(workspace.id, stream.id, note.id, content),
        "Note revision submitted",
      )
    )
      setRevisionDrafts((current) => ({ ...current, [note.id]: "" }))
  }

  async function review(
    stream: ProjectWorkspaceWorkstream,
    note: ProjectWorkspaceNote,
    revision: ProjectNoteRevision,
    action: "APPROVE" | "REQUEST_REVISION" | "REJECT",
  ) {
    const draft = reviewDrafts[revision.id] ?? {
      feedback: "",
      clientVisible: false,
    }
    if (action !== "APPROVE" && draft.feedback.trim().length < 3) return
    if (
      await save(
        `review-${revision.id}`,
        reviewProjectNoteRevision(
          workspace.id,
          stream.id,
          note.id,
          revision.id,
          {
            action,
            ...(draft.feedback.trim()
              ? { feedback: draft.feedback.trim() }
              : {}),
            clientVisible: action === "APPROVE" && draft.clientVisible,
          },
        ),
        action === "APPROVE"
          ? "Note approved"
          : action === "REQUEST_REVISION"
            ? "Revision requested"
            : "Note rejected",
      )
    )
      setReviewDrafts((current) => {
        const next = { ...current }
        delete next[revision.id]
        return next
      })
  }

  return (
    <section aria-label="Project notes" className="space-y-5">
      <header>
        <h2 className="m-0 text-sm font-semibold">Project notes</h2>
        <p className="mt-1 mb-0 text-xs text-[#65718a]">
          Notes stay internal unless a reviewer approves them for the client.
        </p>
      </header>
      {error && <Alert variant="banner">{error}</Alert>}
      {workspace.workstreams.map((stream) => (
        <section
          key={stream.id}
          aria-label={`${stream.serviceName} notes`}
          className="space-y-3 rounded-xl border border-[#dfe4ec] bg-white p-4 sm:p-5"
        >
          <div>
            <h3 className="m-0 text-sm font-semibold">{stream.serviceName}</h3>
            {stream.name !== stream.serviceName && (
              <p className="mt-1 mb-0 text-xs text-[#65718a]">{stream.name}</p>
            )}
          </div>
          {(stream.notes ?? []).length ? (
            <div className="space-y-3">
              {(stream.notes ?? []).map((note) => {
                const latest = latestRevision(note)
                const canRevise =
                  note.createdBy.id === account.id &&
                  (latest?.status === "REVISION_REQUIRED" ||
                    latest?.status === "APPROVED")
                return (
                  <article
                    key={note.id}
                    className="rounded-lg border border-[#e6eaf0] bg-[#fbfcfe] p-4"
                  >
                    <ol className="m-0 list-none space-y-4 p-0">
                      {note.revisions.map((revision) => {
                        const canReview = canReviewRevision(
                          stream,
                          revision,
                          account.id,
                        )
                        const reviewDraft = reviewDrafts[revision.id] ?? {
                          feedback: "",
                          clientVisible: false,
                        }
                        return (
                          <li key={revision.id} className="min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Pill tone={noteStatusTone(revision.status)}>
                                  {noteStatusLabel(revision.status)}
                                </Pill>
                                <span className="text-[11px] text-[#738096]">
                                  Revision {revision.revision}
                                </span>
                                {revision.clientVisible && (
                                  <Pill tone="brand">Shared with client</Pill>
                                )}
                                {revision.supersededAt && (
                                  <Pill tone="neutral">Superseded</Pill>
                                )}
                                {revision.unpublishedAt && (
                                  <Pill tone="neutral">Unpublished</Pill>
                                )}
                              </div>
                              <span className="text-[11px] text-[#738096]">
                                {revision.author.fullName || "Project staff"} ·{" "}
                                {formatDate(revision.submittedAt)}
                              </span>
                            </div>
                            <p className="mt-3 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#263247] [overflow-wrap:anywhere]">
                              {revision.content}
                            </p>
                            {revision.feedback && (
                              <div className="mt-3 rounded-md border-l-2 border-[#c8d4e8] bg-white px-3 py-2">
                                <p className="m-0 text-[10px] font-semibold text-[#52627a]">
                                  Feedback from{" "}
                                  {revision.reviewedBy?.fullName || "reviewer"}
                                  {revision.reviewedAt
                                    ? ` · ${formatDate(revision.reviewedAt)}`
                                    : ""}
                                </p>
                                <p className="mt-1 mb-0 whitespace-pre-wrap text-xs leading-5 text-[#52627a]">
                                  {revision.feedback}
                                </p>
                              </div>
                            )}
                            {revision.publishedAt && (
                              <p className="mt-2 mb-0 text-[11px] text-[#738096]">
                                Published by{" "}
                                {revision.publishedBy?.fullName || "reviewer"} ·{" "}
                                {formatDate(revision.publishedAt)}
                              </p>
                            )}
                            {revision.supersededAt && (
                              <p className="mt-2 mb-0 text-[11px] text-[#738096]">
                                Superseded by revision{" "}
                                {revision.supersededByRevision?.revision ??
                                  "unknown"}{" "}
                                · {formatDate(revision.supersededAt)}
                              </p>
                            )}
                            {revision.unpublishedAt && (
                              <p className="mt-2 mb-0 text-[11px] text-[#738096]">
                                Unpublished by{" "}
                                {revision.unpublishedBy?.fullName || "reviewer"}{" "}
                                · {formatDate(revision.unpublishedAt)}
                              </p>
                            )}
                            {revision.clientVisible &&
                              (stream.isDepartmentHead ||
                                (stream.isTeamLead &&
                                  revision.publishedById === account.id)) && (
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="outline"
                                    disabled={Boolean(busyKey)}
                                    onClick={() =>
                                      void save(
                                        `unpublish-${revision.id}`,
                                        unpublishProjectNoteRevision(
                                          workspace.id,
                                          stream.id,
                                          note.id,
                                          revision.id,
                                        ),
                                        "Note removed from the client view",
                                      )
                                    }
                                  >
                                    Remove from client
                                  </Button>
                                </div>
                              )}
                            {canReview && (
                              <div className="mt-3 space-y-3 rounded-lg border border-[#e0e6ef] bg-white p-3">
                                <label className="grid gap-1.5 text-xs font-medium">
                                  Review feedback
                                  <FormTextarea
                                    value={reviewDraft.feedback}
                                    maxLength={2000}
                                    rows={3}
                                    disabled={
                                      busyKey === `review-${revision.id}`
                                    }
                                    onChange={(event) =>
                                      setReviewDrafts((current) => ({
                                        ...current,
                                        [revision.id]: {
                                          ...reviewDraft,
                                          feedback: event.currentTarget.value,
                                        },
                                      }))
                                    }
                                    placeholder="Add feedback when requesting changes or rejecting."
                                  />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-[#52627a]">
                                  <Checkbox
                                    checked={reviewDraft.clientVisible}
                                    disabled={
                                      busyKey === `review-${revision.id}`
                                    }
                                    onChange={(event) =>
                                      setReviewDrafts((current) => ({
                                        ...current,
                                        [revision.id]: {
                                          ...reviewDraft,
                                          clientVisible:
                                            event.currentTarget.checked,
                                        },
                                      }))
                                    }
                                  />
                                  Share with the client after approval
                                </label>
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    disabled={
                                      Boolean(busyKey) ||
                                      reviewDraft.feedback.trim().length < 3
                                    }
                                    onClick={() =>
                                      void review(
                                        stream,
                                        note,
                                        revision,
                                        "REQUEST_REVISION",
                                      )
                                    }
                                  >
                                    Request changes
                                  </Button>
                                  <Button
                                    variant="danger"
                                    disabled={
                                      Boolean(busyKey) ||
                                      reviewDraft.feedback.trim().length < 3
                                    }
                                    onClick={() =>
                                      void review(
                                        stream,
                                        note,
                                        revision,
                                        "REJECT",
                                      )
                                    }
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    variant="brand"
                                    disabled={Boolean(busyKey)}
                                    onClick={() =>
                                      void review(
                                        stream,
                                        note,
                                        revision,
                                        "APPROVE",
                                      )
                                    }
                                  >
                                    Approve
                                  </Button>
                                </div>
                              </div>
                            )}
                            {stream.isTeamLead &&
                              revision.status === "SUBMITTED" && (
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="outline"
                                    disabled={Boolean(busyKey)}
                                    onClick={() =>
                                      void save(
                                        `escalate-${revision.id}`,
                                        escalateProjectNoteRevision(
                                          workspace.id,
                                          stream.id,
                                          note.id,
                                          revision.id,
                                        ),
                                        "Note escalated to the Department Head",
                                      )
                                    }
                                  >
                                    Escalate to Department Head
                                  </Button>
                                </div>
                              )}
                          </li>
                        )
                      })}
                    </ol>
                    {canRevise && (
                      <div className="mt-4 space-y-2 border-t border-[#e6eaf0] pt-4">
                        <label className="grid gap-1.5 text-xs font-medium">
                          Submit a revision
                          <FormTextarea
                            value={revisionDrafts[note.id] ?? ""}
                            maxLength={4000}
                            rows={3}
                            disabled={Boolean(busyKey)}
                            onChange={(event) =>
                              setRevisionDrafts((current) => ({
                                ...current,
                                [note.id]: event.currentTarget.value,
                              }))
                            }
                            placeholder="Update the note based on review feedback."
                          />
                        </label>
                        <div className="flex justify-end">
                          <Button
                            variant="brand"
                            disabled={
                              Boolean(busyKey) ||
                              !(revisionDrafts[note.id] ?? "").trim()
                            }
                            onClick={() => void submitRevision(stream, note)}
                          >
                            Submit revision
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No project notes yet"
              description="Submitted notes and their review history will appear here."
              size="sm"
            />
          )}
          {stream.canUploadDeliverables && (
            <div className="space-y-2 border-t border-[#e6eaf0] pt-4">
              <label className="grid gap-1.5 text-xs font-medium">
                Add a project note
                <FormTextarea
                  value={noteDrafts[stream.id] ?? ""}
                  maxLength={4000}
                  rows={3}
                  disabled={Boolean(busyKey)}
                  onChange={(event) =>
                    setNoteDrafts((current) => ({
                      ...current,
                      [stream.id]: event.currentTarget.value,
                    }))
                  }
                  placeholder="Write an internal project note for review."
                />
              </label>
              <div className="flex justify-end">
                <Button
                  variant="brand"
                  disabled={
                    Boolean(busyKey) || !(noteDrafts[stream.id] ?? "").trim()
                  }
                  onClick={() => void submitNote(stream)}
                >
                  {busyKey === `note-${stream.id}`
                    ? "Submitting…"
                    : "Submit note"}
                </Button>
              </div>
            </div>
          )}
        </section>
      ))}
      {!workspace.workstreams.length && (
        <EmptyState
          icon={FileText}
          title="No project workstreams"
          description="Project notes will appear here once this workspace has a service."
        />
      )}
      {!notes.length &&
        workspace.workstreams.some(
          (stream) => stream.canUploadDeliverables,
        ) && (
          <p className="sr-only" role="status">
            No project notes have been submitted.
          </p>
        )}
    </section>
  )
}
