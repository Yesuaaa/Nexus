"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Form } from "@/components/ui/form"
import {
  AttachmentPreview,
  attachmentAccept,
} from "@/features/request-workflow/components/attachment-preview"
import { sileo } from "@/lib/toast"
import {
  uploadProjectDeliverable,
  type ProjectDeliverable,
} from "../api/project-workspace-api"

export function ProjectDeliverableSubmissionDialog({
  workspaceId,
  projectId,
  deliverables,
  onClose,
  onSubmitted,
}: {
  workspaceId: string
  projectId: string
  deliverables: Pick<
    ProjectDeliverable,
    "id" | "title" | "description" | "expectedFileType" | "deliveryStatus"
  >[]
  onClose: () => void
  onSubmitted: () => void
}) {
  const id = useId()
  const eligible = deliverables.filter((item) =>
    ["NOT_SUBMITTED", "REJECTED"].includes(item.deliveryStatus),
  )
  const [target, setTarget] = useState(
    eligible.length === 1 ? eligible[0].id : "",
  )
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const pendingId = useRef<string | null>(null)
  const inFlight = useRef(false)
  const selected = eligible.find((item) => item.id === target)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (inFlight.current || !selected || !file) return
    inFlight.current = true
    setBusy(true)
    setError("")
    pendingId.current ??= crypto.randomUUID()
    try {
      await uploadProjectDeliverable(workspaceId, projectId, target, file, {
        uploadId: pendingId.current,
        note: note.trim(),
      })
      sileo.success({ title: "Deliverable submitted for review" })
      onSubmitted()
      onClose()
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't submit this deliverable. Try again."
      setError(message)
      sileo.error({ title: "Submission failed", description: message })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !inFlight.current) onClose()
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        overlayClassName="bg-[#14213d]/35"
        className="max-h-[85dvh] w-[calc(100%-32px)] max-w-lg overflow-y-auto rounded-2xl border-[#dce3ee] bg-white text-[#182235]"
      >
        <DialogTitle className="pr-5 text-base">Submit deliverable</DialogTitle>
        <DialogDescription className="text-xs leading-5 text-[#52627a]">
          Save an attachment to an existing workspace deliverable. It stays
          private to staff until the department head approves and shares it with
          the client.
        </DialogDescription>
        {!eligible.length ? (
          <p className="text-xs text-[#52627a]">
            No deliverables are available for submission. Items awaiting review
            or already approved are locked.
          </p>
        ) : (
          <Form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="space-y-2">
              <label id={`${id}-target-label`} className="text-xs font-medium">
                Deliverable
              </label>
              <Select
                value={target}
                disabled={busy}
                onValueChange={(value) => {
                  setTarget(value)
                  pendingId.current = null
                }}
              >
                <SelectTrigger
                  aria-labelledby={`${id}-target-label`}
                  className="text-xs"
                >
                  <SelectValue placeholder="Choose a deliverable" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs leading-5 text-[#52627a]">
                  {selected.description}
                  {selected.expectedFileType
                    ? ` · Expected: ${selected.expectedFileType}`
                    : ""}
                </p>
              )}
            </div>
            <label className="grid gap-2 text-xs font-medium">
              Deliverable file
              <input
                type="file"
                accept={attachmentAccept}
                disabled={busy}
                className="min-w-0 text-xs"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  pendingId.current = null
                }}
              />
            </label>
            {file && (
              <AttachmentPreview
                file={file}
                disabled={busy}
                onRemove={() => {
                  setFile(null)
                  pendingId.current = null
                }}
              />
            )}
            <label className="grid gap-2 text-xs font-medium">
              Submission note (optional)
              <textarea
                value={note}
                maxLength={2000}
                rows={3}
                disabled={busy}
                onChange={(event) => {
                  setNote(event.target.value)
                  pendingId.current = null
                }}
                className="resize-y rounded-lg border border-[#d7dfe8] px-3 py-2 text-xs leading-5"
              />
            </label>
            <p className="text-[11px] text-[#52627a]">
              PDF, Word, PNG, JPEG or plain text · Up to 5 MB
            </p>
            {error && (
              <p role="alert" className="text-xs text-red-700">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || !selected || !file}
                className="bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
              >
                {busy ? "Submitting…" : "Submit for review"}
              </Button>
            </DialogFooter>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
