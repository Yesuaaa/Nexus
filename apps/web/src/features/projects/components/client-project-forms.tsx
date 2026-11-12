"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProjectChangeRequestKind } from "../api/projects-api"

/** Mount while open; closes itself once `onSave` resolves true. */
export function ClientProjectBriefDrawer({
  name,
  description,
  busy,
  onClose,
  onSave,
}: {
  name: string
  description: string
  busy: boolean
  onClose: () => void
  /** Resolves true when the brief was saved. */
  onSave: (brief: { name: string; description: string }) => Promise<boolean>
}) {
  const panel = useSidePanel(onClose)
  const [draftName, setDraftName] = useState(name)
  const [draftDescription, setDraftDescription] = useState(description)
  const [error, setError] = useState("")

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={busy}
    >
      <SidePanelHeader
        title="Edit project brief"
        description="Keep the project name and goals up to date."
        closeLabel="Close brief editor"
        closeDisabled={busy}
      />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          const nextName = draftName.trim()
          if (nextName.length < 2 || nextName.length > 160) {
            setError("Use a project name between 2 and 160 characters.")
            return
          }
          if (draftDescription.length > 6000) {
            setError("Keep the brief under 6,000 characters.")
            return
          }
          setError("")
          void onSave({ name: nextName, description: draftDescription }).then(
            (saved) => {
              if (saved) panel.close()
            },
          )
        }}
      >
        <SidePanelBody>
          <label className="grid gap-2 text-xs font-medium">
            Project name
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={160}
              required
              className="h-10 rounded-lg border border-[#d7dfe8] bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/25"
            />
          </label>
          <label className="grid gap-2 text-xs font-medium">
            Project brief
            <textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              maxLength={6000}
              rows={8}
              placeholder="Describe the goals, scope, or context for this project."
              className="resize-y rounded-lg border border-[#d7dfe8] bg-background px-3 py-2.5 text-sm leading-6 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/25"
            />
            <span className="text-right text-[11px] font-normal text-[#71839d]">
              {draftDescription.length}/6,000
            </span>
          </label>
          {error && <Alert variant="text">{error}</Alert>}
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            disabled={busy}
            onClick={() => panel.close()}
          >
            Cancel
          </SidePanelButton>
          <SidePanelButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save brief"}
          </SidePanelButton>
        </SidePanelFooter>
      </form>
    </SidePanel>
  )
}

export function RequestProjectDialog({
  open,
  busy,
  changeAvailable,
  cancellationAvailable,
  cancellationDisabledReason,
  defaultKind,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  changeAvailable: boolean
  cancellationAvailable: boolean
  cancellationDisabledReason: string | null
  defaultKind: ProjectChangeRequestKind
  onOpenChange: (open: boolean) => void
  onSubmit: (kind: ProjectChangeRequestKind, details: string) => void
}) {
  const [kind, setKind] = useState<ProjectChangeRequestKind>(defaultKind)
  const [details, setDetails] = useState("")
  const maxLength = kind === "CANCELLATION" ? 2000 : 4000
  const isCancellation = kind === "CANCELLATION"

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] max-w-[560px] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>
            {isCancellation
              ? "Request project cancellation"
              : "Request a project change"}
          </DialogTitle>
          <DialogDescription>
            {isCancellation
              ? "Tell the Department Head why you want to cancel this project. It stays active while they review your request."
              : "Tell the Department Head what should change. They’ll review it and respond here."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-3 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(kind, details.trim())
          }}
        >
          <label className="grid gap-2 text-xs font-medium">
            Request type
            <Select
              value={kind}
              onValueChange={(value) => {
                setKind(value as ProjectChangeRequestKind)
                setDetails("")
              }}
            >
              <SelectTrigger
                aria-label="Project request type"
                className="h-10 border-[#d7dfe8] text-sm font-normal"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHANGE" disabled={!changeAvailable}>
                  {changeAvailable ? "Request a change" : "Change under review"}
                </SelectItem>
                <SelectItem
                  value="CANCELLATION"
                  disabled={!cancellationAvailable}
                >
                  Request cancellation
                </SelectItem>
              </SelectContent>
            </Select>
            {!cancellationAvailable && cancellationDisabledReason && (
              <span className="text-[11px] font-normal leading-5 text-[#71839d]">
                {cancellationDisabledReason}
              </span>
            )}
          </label>
          <label className="grid gap-2 text-xs font-medium">
            {isCancellation
              ? "Why are you requesting cancellation?"
              : "What needs to change?"}
            <textarea
              autoFocus
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              minLength={10}
              maxLength={maxLength}
              rows={5}
              required
              placeholder={
                isCancellation
                  ? "Share the reason for your request."
                  : "Describe the requested change and why it is needed."
              }
              className="resize-y rounded-lg border border-[#d7dfe8] bg-background px-3 py-2.5 text-sm leading-6 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/25"
            />
            <span className="text-right text-[11px] font-normal text-[#71839d]">
              {details.length}/{maxLength.toLocaleString()}
            </span>
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Keep project
            </Button>
            <Button
              type="submit"
              variant={isCancellation ? "danger" : "brand"}
              disabled={busy || details.trim().length < 10}
            >
              {busy
                ? "Sending…"
                : isCancellation
                  ? "Send cancellation request"
                  : "Send change request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RequestDeliverableRevisionDialog({
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState("")
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] max-w-[560px] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Request a revision</DialogTitle>
          <DialogDescription>
            Share what needs to be adjusted so the team can prepare an updated
            version.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-3 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(note.trim())
          }}
        >
          <label className="grid gap-2 text-xs font-medium">
            What should be revised?
            <textarea
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              minLength={3}
              maxLength={2000}
              rows={5}
              required
              placeholder="Describe the change you need."
              className="resize-y rounded-lg border border-[#d7dfe8] bg-background px-3 py-2.5 text-sm leading-6 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/25"
            />
            <span className="text-right text-[11px] font-normal text-[#71839d]">
              {note.length}/2,000
            </span>
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={busy || note.trim().length < 3}
            >
              {busy ? "Sending…" : "Send revision request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReviewProjectChangeDialog({
  open,
  requestKind,
  decision,
  requestDetails,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  requestKind: "CHANGE" | "CANCELLATION"
  decision: "ACCEPTED" | "NOT_APPROVED"
  requestDetails: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (responseNote: string) => void
}) {
  const [responseNote, setResponseNote] = useState("")
  const canSubmit = decision === "ACCEPTED" || responseNote.trim().length >= 3

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] max-w-[560px] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>
            {requestKind === "CANCELLATION"
              ? decision === "ACCEPTED"
                ? "Approve project cancellation?"
                : "Decline cancellation request?"
              : decision === "ACCEPTED"
                ? "Accept change request"
                : "Decline change request"}
          </DialogTitle>
          <DialogDescription>
            {requestKind === "CANCELLATION"
              ? decision === "ACCEPTED"
                ? "Approving will mark the project as cancelled and notify the client."
                : "Add a reason so the client understands why the project will continue."
              : decision === "ACCEPTED"
                ? "Confirm the next step for this requested scope change."
                : "Add a reason so the client understands the decision."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 rounded-lg bg-[#f5f7fa] p-3 text-xs leading-5 text-[#50627e]">
          {requestDetails}
        </div>
        <form
          className="mt-3 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(responseNote.trim())
          }}
        >
          <label className="grid gap-2 text-xs font-medium">
            Response to client
            {decision === "NOT_APPROVED" ? " (required)" : " (optional)"}
            <textarea
              autoFocus
              value={responseNote}
              onChange={(event) => setResponseNote(event.target.value)}
              maxLength={2000}
              minLength={decision === "NOT_APPROVED" ? 3 : undefined}
              required={decision === "NOT_APPROVED"}
              rows={4}
              placeholder={
                decision === "ACCEPTED"
                  ? requestKind === "CANCELLATION"
                    ? "Add an optional note for the client."
                    : "Add a note about how the team will proceed."
                  : requestKind === "CANCELLATION"
                    ? "Explain why the project will continue."
                    : "Explain why this change cannot be approved."
              }
              className="resize-y rounded-lg border border-[#d7dfe8] bg-background px-3 py-2.5 text-sm leading-6 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#28468f]/25"
            />
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={
                decision === "ACCEPTED" && requestKind !== "CANCELLATION"
                  ? "brand"
                  : "danger"
              }
              disabled={busy || !canSubmit}
            >
              {busy
                ? "Saving…"
                : requestKind === "CANCELLATION"
                  ? decision === "ACCEPTED"
                    ? "Approve cancellation"
                    : "Decline request"
                  : decision === "ACCEPTED"
                    ? "Accept request"
                    : "Not approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
