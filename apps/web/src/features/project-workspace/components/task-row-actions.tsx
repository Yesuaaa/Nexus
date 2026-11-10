"use client"

import { useState } from "react"
import { TaskDetailsPanel } from "./task-details-panel"
import { Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CloseIcon } from "@/components/layout/icons"
import { DateInput } from "@/components/ui/date-input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  saveProjectPlan,
  type ProjectTask,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"

export function TaskRowActions({
  workspaceId,
  stream,
  task,
  onUpdated,
  disabled,
  editOnly = false,
}: {
  workspaceId: string
  stream: ProjectWorkspaceWorkstream
  task: ProjectTask
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  disabled: boolean
  editOnly?: boolean
}) {
  const [mode, setMode] = useState<"view" | "edit" | null>(null)
  const [draft, setDraft] = useState(task)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inputClass =
    "mt-2 h-9 w-full rounded-md border border-[#dfe4ec] bg-background px-3 text-xs"
  async function save() {
    if (!stream.plan || busy) return
    setBusy(true)
    setError("")
    try {
      const plan = {
        phases: stream.plan.phases.map((phase) => ({
          ...phase,
          tasks: phase.tasks.map((item) =>
            item.id === task.id
              ? { ...draft, title: draft.title.trim(), role: draft.role.trim() }
              : item,
          ),
        })),
      }
      onUpdated(
        await saveProjectPlan(workspaceId, stream.id, plan, stream.updatedAt),
      )
      setMode(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't update task",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="flex justify-center gap-2">
        {!editOnly && (
          <button
            className={rowActionButton}
            disabled={disabled}
            aria-label={`View ${task.title}`}
            onClick={() => {
              setMode("view")
              setError("")
            }}
          >
            <Eye size={16} />
          </button>
        )}
        <button
          className={`${rowActionButton} border-transparent! bg-[#203f8c]! text-white! hover:bg-[#172f70]!`}
          disabled={disabled}
          aria-label={`Edit ${task.title}`}
          onClick={() => {
            setDraft({ ...task })
            setError("")
            setMode("edit")
          }}
        >
          <Pencil size={15} />
        </button>
      </div>
      {mode === "view" && (
        <TaskDetailsPanel
          task={task}
          stream={stream}
          onClose={() => setMode(null)}
          onEdit={() => {
            setDraft({ ...task })
            setError("")
            setMode("edit")
          }}
        />
      )}
      <Dialog
        open={mode === "edit"}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[rgb(13_28_57_/_48%)]"
          className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] max-w-none gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                Edit task
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                Update this task in {stream.serviceName}.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              type="button"
              className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
              aria-label="Close task editor"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
            className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
          >
            <fieldset
              disabled={busy}
              className="m-0 grid gap-4 border-0 p-0 sm:col-span-2 sm:grid-cols-2"
            >
              <label className="block text-xs font-medium sm:col-span-2">
                Task name
                <input
                  required
                  maxLength={180}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-medium">
                Project role
                <input
                  maxLength={80}
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-medium">
                Due date
                <DateInput
                  value={draft.dueDate ?? ""}
                  min="0001-01-01"
                  max="9999-12-31"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      dueDate: event.currentTarget.value || null,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  id={`assignee-${task.id}`}
                >
                  Assigned staff
                </label>
                <Select
                  disabled={!stream.canAssign}
                  value={draft.employeeId || "unassigned"}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      employeeId: value === "unassigned" ? null : value,
                    })
                  }
                >
                  <SelectTrigger aria-labelledby={`assignee-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {stream.staff?.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!stream.canAssign && (
                  <p className="mt-1 text-[11px] text-[#738096]">
                    Only the department head can change assignments.
                  </p>
                )}
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  id={`status-${task.id}`}
                >
                  Task status
                </label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => {
                    if (
                      value === "DONE" ||
                      value === "IN_PROGRESS" ||
                      value === "NOT_STARTED"
                    )
                      setDraft({ ...draft, status: value })
                  }}
                >
                  <SelectTrigger aria-labelledby={`status-${task.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">Not started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="DONE">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649] sm:col-span-2"
              >
                {error}
              </p>
            )}
            <footer className="-mx-5 -mb-5 flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:col-span-2 sm:-mx-6 sm:-mb-6 sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-[#203f8c] text-white hover:bg-[#172f70]"
              >
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
