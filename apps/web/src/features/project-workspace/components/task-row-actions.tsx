"use client"

import { useState } from "react"
import { TaskDetailsPanel } from "./task-details-panel"
import { Eye, Pencil } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
import {
  saveProjectPlan,
  type ProjectTask,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"
import { errorMessage } from "@/lib/error-message"

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
      setError(errorMessage(reason, "Couldn't update task"))
    } finally {
      setBusy(false)
    }
  }
  function edit() {
    setDraft({ ...task })
    setError("")
    setMode("edit")
  }
  return (
    <>
      <div className="flex justify-center">
        {editOnly ? (
          <button
            type="button"
            className={`${rowActionButton} border-transparent! bg-[#203f8c]! text-white! hover:bg-[#172f70]!`}
            disabled={disabled}
            aria-label={`Edit ${task.title}`}
            onClick={edit}
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
        ) : (
          <RowActionsMenu
            triggerId={`task-actions-${task.id}`}
            triggerLabel={`More actions for ${task.title}`}
            menuLabel={`Actions for ${task.title}`}
            disabled={disabled}
            items={[
              {
                action: "view" as const,
                label: <RowActionLabel icon={Eye}>View task</RowActionLabel>,
              },
              {
                action: "edit" as const,
                label: <RowActionLabel icon={Pencil}>Edit task</RowActionLabel>,
              },
            ]}
            onAction={(action) => {
              if (action === "edit") return edit()
              setError("")
              setMode("view")
            }}
          />
        )}
      </div>
      {mode === "view" && (
        <TaskDetailsPanel
          task={task}
          stream={stream}
          onClose={() => setMode(null)}
          onEdit={edit}
        />
      )}
      <Modal
        open={mode === "edit"}
        onClose={() => setMode(null)}
        busy={busy}
        fallbackFocus={() => document.getElementById(`task-actions-${task.id}`)}
      >
        <ModalHeader
          title="Edit task"
          description={`Update this task in ${stream.serviceName}.`}
          closeLabel="Close task editor"
          closeDisabled={busy}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <ModalBody className="sm:grid-cols-2">
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
            {error && <Alert className="sm:col-span-2">{error}</Alert>}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
