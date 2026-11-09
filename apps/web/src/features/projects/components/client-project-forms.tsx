"use client"

import { useState } from "react"
import { X } from "lucide-react"
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProjectChangeRequestKind } from "../api/projects-api"

export function ClientProjectBriefDrawer({
  open,
  name,
  description,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean
  name: string
  description: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (brief: { name: string; description: string }) => void
}) {
  const [draftName, setDraftName] = useState(name)
  const [draftDescription, setDraftDescription] = useState(description)
  const [error, setError] = useState("")

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay bg-[rgb(13_28_57_/_40%)]"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(560px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div>
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Edit project brief
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-[#52627a]">
              Keep the project name and goals up to date.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close brief editor"
              disabled={busy}
              className={cn(rowActionButton, "max-[560px]:size-11")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </SheetClose>
        </header>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
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
            onSave({ name: nextName, description: draftDescription })
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 max-[560px]:px-5">
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
            {error && (
              <p role="alert" className="m-0 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>
          <footer className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
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
              disabled={busy}
              className="bg-[#243f8f] hover:bg-[#1d367d]"
            >
              {busy ? "Saving…" : "Save brief"}
            </Button>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
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
              disabled={busy || details.trim().length < 10}
              className={
                isCancellation
                  ? "bg-[#b53244] hover:bg-[#982a3a]"
                  : "bg-[#243f8f] hover:bg-[#1d367d]"
              }
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

export function ApproveDeliverableDialog({
  open,
  title,
  busy,
  onOpenChange,
  onApprove,
}: {
  open: boolean
  title: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onApprove: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] max-w-[480px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Approve this deliverable?</DialogTitle>
          <DialogDescription>
            This confirms that “{title}” meets the agreed expectations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-3 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Go back
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="bg-[#243f8f] hover:bg-[#1d367d]"
            onClick={onApprove}
          >
            {busy ? "Saving…" : "Approve deliverable"}
          </Button>
        </DialogFooter>
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
              disabled={busy || note.trim().length < 3}
              className="bg-[#243f8f] hover:bg-[#1d367d]"
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
              disabled={busy || !canSubmit}
              className={
                decision === "ACCEPTED" && requestKind !== "CANCELLATION"
                  ? "bg-[#243f8f] hover:bg-[#1d367d]"
                  : "bg-[#b53244] hover:bg-[#982a3a]"
              }
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
