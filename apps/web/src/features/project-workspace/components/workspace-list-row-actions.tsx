"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  cancelProjectWorkspace,
  notifyProjectWorkspaceListChanged,
  renameProjectWorkspace,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"

export function WorkspaceListRowActions({
  workspace,
  onChanged,
}: {
  workspace: ProjectWorkspaceSummary
  onChanged: () => void
}) {
  const [dialog, setDialog] = useState<"edit" | "cancel" | null>(null)
  const [name, setName] = useState(workspace.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isArchived = ["COMPLETED", "CANCELLED"].includes(workspace.status)

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await renameProjectWorkspace(workspace.id, name.trim())
      setDialog(null)
      notifyProjectWorkspaceListChanged()
      onChanged()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't rename project.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function cancelWorkspace() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await cancelProjectWorkspace(workspace.id)
      setDialog(null)
      notifyProjectWorkspaceListChanged()
      onChanged()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't cancel project.",
      )
    } finally {
      setBusy(false)
    }
  }

  function openDialog(mode: "edit" | "cancel") {
    setError("")
    if (mode === "edit") setName(workspace.name)
    setDialog(mode)
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/project-workspace/${encodeURIComponent(workspace.id)}`}
          className={rowActionButton}
          aria-label={`View ${workspace.name}`}
        >
          <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
          <HoverTooltip>View project</HoverTooltip>
        </Link>
        {workspace.canManage && !isArchived && (
          <>
            <button
              type="button"
              className={`${rowActionButton} border-transparent! bg-[#203f8c]! text-white! hover:bg-[#172f70]!`}
              aria-label={`Edit ${workspace.name}`}
              onClick={() => openDialog("edit")}
            >
              <Pencil size={15} strokeWidth={1.8} aria-hidden="true" />
              <HoverTooltip>Edit project</HoverTooltip>
            </button>
            <button
              type="button"
              className={`${rowActionButton} text-[#b3343b] hover:enabled:bg-[#ffeaeb] hover:enabled:text-[#b3343b]`}
              aria-label={`Cancel ${workspace.name}`}
              onClick={() => openDialog("cancel")}
            >
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
              <HoverTooltip>Cancel project</HoverTooltip>
            </button>
          </>
        )}
      </div>

      <Dialog
        open={dialog === "edit"}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null)
        }}
      >
        <DialogContent className="max-w-md rounded-[13px] border-[#dfe4ec] p-6">
          <DialogHeader>
            <DialogTitle className="text-left">Edit project</DialogTitle>
            <DialogDescription className="text-left">
              Change the name shown in Project Workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void saveName(event)}
            className="space-y-4"
          >
            <label
              className="block text-xs font-medium"
              htmlFor={`workspace-name-${workspace.id}`}
            >
              Project name
            </label>
            <Input
              id={`workspace-name-${workspace.id}`}
              autoFocus
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 text-sm"
              disabled={busy}
            />
            {error && (
              <p role="alert" className="m-0 text-xs text-[#b3343b]">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={busy || name.trim().length < 2}
                className="bg-[#203f8c] text-white hover:bg-[#172f70]"
              >
                {busy ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "cancel"}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null)
        }}
      >
        <DialogContent className="max-w-md rounded-[13px] border-[#dfe4ec] p-6">
          <DialogHeader>
            <DialogTitle className="text-left">
              Cancel this project?
            </DialogTitle>
            <DialogDescription className="text-left">
              “{workspace.name}” will move to Archive. Its assignments will no
              longer count toward active workload.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="m-0 text-xs text-[#b3343b]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Keep project
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void cancelWorkspace()}
              className="bg-[#b3343b] text-white hover:bg-[#982a31]"
            >
              {busy ? "Cancelling…" : "Cancel project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
