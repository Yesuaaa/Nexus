"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Ban, Eye, Pencil } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Input } from "@/components/ui/input"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import { cn } from "@/lib/utils"
import {
  cancelProjectWorkspace,
  notifyProjectWorkspaceListChanged,
  renameProjectWorkspace,
  type ProjectWorkspaceSummary,
} from "../api/project-workspace-api"
import { errorMessage } from "@/lib/error-message"

type WorkspaceAction = "view" | "edit" | "cancel"

const dangerItem =
  "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]"

export function WorkspaceListRowActions({
  workspace,
  onChanged,
}: {
  workspace: ProjectWorkspaceSummary
  onChanged: () => void
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<"edit" | "cancel" | null>(null)
  const [name, setName] = useState(workspace.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isArchived = ["COMPLETED", "CANCELLED"].includes(workspace.status)
  const href = `/project-workspace/${encodeURIComponent(workspace.id)}`
  const triggerId = `workspace-actions-${workspace.id}`

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
      setError(errorMessage(reason, "Couldn't rename project."))
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
      setError(errorMessage(reason, "Couldn't cancel project."))
    } finally {
      setBusy(false)
    }
  }

  function openDialog(mode: "edit" | "cancel") {
    setError("")
    if (mode === "edit") setName(workspace.name)
    setDialog(mode)
  }

  // Read-only rows keep a single view link; manageable rows use the menu.
  if (!workspace.canManage || isArchived)
    return (
      <Link
        href={href}
        className={cn(rowActionButton, "max-[560px]:size-11")}
        aria-label={`View ${workspace.name}`}
      >
        <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
      </Link>
    )

  const items: RowActionMenuItem<WorkspaceAction>[] = [
    {
      action: "view",
      label: <RowActionLabel icon={Eye}>View project</RowActionLabel>,
    },
    {
      action: "edit",
      label: <RowActionLabel icon={Pencil}>Edit project</RowActionLabel>,
    },
    {
      action: "cancel",
      label: <RowActionLabel icon={Ban}>Cancel project</RowActionLabel>,
      className: dangerItem,
      separatorBefore: true,
    },
  ]

  return (
    <>
      <RowActionsMenu
        triggerId={triggerId}
        triggerLabel={`More actions for ${workspace.name}`}
        menuLabel={`Actions for ${workspace.name}`}
        triggerClassName="max-[560px]:size-11"
        items={items}
        disabled={busy}
        onAction={(action) => {
          if (action === "view") router.push(href)
          else openDialog(action)
        }}
      />

      <Modal
        open={dialog === "edit"}
        size="sm"
        busy={busy}
        onClose={() => setDialog(null)}
        fallbackFocus={() => document.getElementById(triggerId)}
      >
        <ModalHeader
          title="Edit project"
          description="Change the name shown in Project Workspace."
          closeLabel="Close edit project"
          closeDisabled={busy}
        />
        <form onSubmit={(event) => void saveName(event)}>
          <ModalBody className="gap-1.5">
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
              className="text-sm"
              disabled={busy}
            />
            {error && (
              <Alert variant="text" className="mt-2">
                {error}
              </Alert>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="brandOutline"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? "Saving…" : "Save name"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <ConfirmationDialog
        open={dialog === "cancel"}
        title="Cancel this project?"
        subject={workspace.name}
        description="It will move to Archive. Its assignments will no longer count toward active workload."
        confirmLabel="Cancel project"
        pendingLabel="Cancelling…"
        cancelLabel="Keep project"
        pending={busy}
        error={error}
        onClose={() => setDialog(null)}
        onConfirm={() => void cancelWorkspace()}
      />
    </>
  )
}
