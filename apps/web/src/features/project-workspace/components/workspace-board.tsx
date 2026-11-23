"use client"

import { useState, type ReactNode } from "react"
import { MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFooter,
  SidePanelButton,
} from "@/components/ui/side-panel"
import { Form } from "@/components/ui/form"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Alert } from "@/components/ui/alert"
import { Pill } from "@/components/ui/pill"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { errorMessage } from "@/lib/error-message"
import {
  addProjectTask,
  mutateKanbanColumn,
  updateProjectTask,
  type ProjectWorkspaceDetail,
  type ProjectTaskStatus,
} from "../api/project-workspace-api"
import { taskStatusLabels } from "../model/task-status"
import { TaskRowActions } from "./task-row-actions"

const statuses: ProjectTaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE"]
const statusDots: Record<ProjectTaskStatus, string> = {
  NOT_STARTED: "bg-[#94a3b8]",
  IN_PROGRESS: "bg-[#3153a5]",
  DONE: "bg-[#29906b]",
}

export function WorkspaceBoard({
  viewSwitcher,
  workspace,
  onUpdated,
}: {
  viewSwitcher: ReactNode
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
}) {
  const [columnEdit, setColumnEdit] = useState<{
    id: string | null
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [placement, setPlacement] = useState("END")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dragged, setDragged] = useState<{
    projectId: string
    taskId: string
    status: ProjectTaskStatus
  } | null>(null)
  const [hovered, setHovered] = useState<ProjectTaskStatus | null>(null)
  const [adding, setAdding] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [phaseId, setPhaseId] = useState("")
  const [title, setTitle] = useState("")
  const available = workspace.workstreams.filter(
    (stream) =>
      !["COMPLETED", "CANCELLED"].includes(stream.status) &&
      (stream.plan?.phases.length ?? 0) > 0,
  )
  const selected = available.find((stream) => stream.id === projectId)
  const rows = workspace.workstreams.flatMap((stream) =>
    (stream.plan?.phases ?? []).flatMap((phase) =>
      phase.tasks.map((task) => ({ stream, phase, task })),
    ),
  )
  async function changeStatus(
    projectId: string,
    taskId: string,
    status: ProjectTaskStatus,
    columnId: string | null = null,
  ) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      onUpdated(
        await updateProjectTask(
          workspace.id,
          projectId,
          taskId,
          status,
          columnId,
        ),
      )
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't update task status"))
    } finally {
      setBusy(false)
    }
  }
  async function saveColumn(
    action: "create" | "rename" | "delete",
    id: string | null,
    name = "",
  ) {
    if (busy) return
    if (
      action !== "delete" &&
      (!name.trim() ||
        (workspace.kanbanColumns ?? []).some(
          (column) =>
            column.id !== id &&
            column.name.trim().toLocaleLowerCase() ===
              name.trim().toLocaleLowerCase(),
        ))
    ) {
      setError(
        name.trim()
          ? "A column with this name already exists."
          : "Enter a column name.",
      )
      return
    }
    setBusy(true)
    setError("")
    try {
      onUpdated(
        await mutateKanbanColumn(
          workspace.id,
          action,
          id,
          name.trim(),
          action === "create" && placement !== "END" ? placement : undefined,
        ),
      )
      setColumnEdit(null)
      setDeleting(null)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't update column"))
    } finally {
      setBusy(false)
    }
  }
  const columns = [
    {
      id: "NOT_STARTED",
      name: taskStatusLabels.NOT_STARTED,
      status: "NOT_STARTED" as const,
    },
    {
      id: "IN_PROGRESS",
      name: taskStatusLabels.IN_PROGRESS,
      status: "IN_PROGRESS" as const,
    },
    ...(workspace.kanbanColumns ?? []).map((column) => ({
      ...column,
      status: "IN_PROGRESS" as const,
    })),
    { id: "DONE", name: taskStatusLabels.DONE, status: "DONE" as const },
  ]
  async function createTask() {
    if (busy || !selected || !phaseId || title.trim().length < 2) return
    setBusy(true)
    setError("")
    try {
      onUpdated(
        await addProjectTask(workspace.id, selected.id, {
          phaseId,
          title: title.trim(),
        }),
      )
      setAdding(false)
      setTitle("")
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't add task"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <SidePanel
        open={!!columnEdit}
        onOpenChange={(open) => {
          if (!open) {
            setColumnEdit(null)
            setError("")
          }
        }}
        busy={busy}
      >
        <SidePanelHeader
          title={columnEdit?.id ? "Rename column" : "Add column"}
          description={
            columnEdit?.id
              ? "Update this workflow column's name."
              : "Create a custom workflow column for this workspace."
          }
          wrapDescription
          closeDisabled={busy}
        />
        <Form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (columnEdit)
              void saveColumn(
                columnEdit.id ? "rename" : "create",
                columnEdit.id,
                columnEdit.name,
              )
          }}
        >
          <SidePanelBody>
            {error && <Alert>{error}</Alert>}
            <label className="grid gap-2 text-xs font-medium">
              Column name
              <FormInput
                required
                maxLength={120}
                value={columnEdit?.name ?? ""}
                disabled={busy}
                onChange={(event) =>
                  setColumnEdit(
                    (current) =>
                      current && { ...current, name: event.target.value },
                  )
                }
              />
            </label>
            {!columnEdit?.id && (
              <div className="grid gap-2">
                <span
                  id="column-placement-label"
                  className="text-xs font-medium"
                >
                  Placement
                </span>
                <Select
                  value={placement}
                  onValueChange={setPlacement}
                  disabled={busy}
                >
                  <SelectTrigger aria-labelledby="column-placement-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_PROGRESS">
                      After In Progress
                    </SelectItem>
                    {(workspace.kanbanColumns ?? []).map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        After {column.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="END">Before Complete</SelectItem>
                  </SelectContent>
                </Select>
                <p className="m-0 text-xs leading-5 text-[#738096]">
                  Tasks placed in custom columns remain In Progress for project
                  progress calculations.
                </p>
              </div>
            )}
          </SidePanelBody>
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setColumnEdit(null)
                setError("")
              }}
            >
              Cancel
            </SidePanelButton>
            <SidePanelButton type="submit" disabled={busy}>
              {busy ? "Saving…" : columnEdit?.id ? "Save" : "Add column"}
            </SidePanelButton>
          </SidePanelFooter>
        </Form>
      </SidePanel>
      <ConfirmationDialog
        open={!!deleting}
        title={deleting ? `Delete “${deleting.name}”?` : "Delete column"}
        error={error}
        description="Tasks currently in this column will move back to In Progress. No tasks will be deleted."
        confirmLabel="Delete column"
        pendingLabel="Deleting…"
        pending={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void saveColumn("delete", deleting.id)
        }}
      />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {viewSwitcher}
        {workspace.canManage && (
          <Button
            variant="brandOutline"
            disabled={busy || !workspace.canManage || !available.length}
            onClick={() => {
              setError("")
              setPlacement("END")
              setColumnEdit({ id: null, name: "" })
            }}
          >
            <Plus size={14} aria-hidden="true" />
            Add column
          </Button>
        )}
      </div>
      <SidePanel
        open={adding}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setError("")
          }
        }}
        busy={busy}
      >
        <SidePanelHeader
          title="Add task"
          description="Add a task to an existing project phase."
          closeDisabled={busy}
        />
        <Form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void createTask()
          }}
        >
          <SidePanelBody>
            {error && <Alert>{error}</Alert>}
            <label className="grid gap-2 text-xs font-medium">
              Task name
              <FormInput
                required
                minLength={2}
                maxLength={180}
                value={title}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <div className="grid gap-2">
              <span className="text-xs font-medium" id="board-project-label">
                Workstream
              </span>
              <Select
                value={projectId}
                disabled={busy}
                onValueChange={(value) => {
                  setProjectId(value)
                  setPhaseId(
                    available.find((stream) => stream.id === value)?.plan
                      ?.phases[0]?.id ?? "",
                  )
                }}
              >
                <SelectTrigger aria-labelledby="board-project-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      {stream.serviceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="text-xs font-medium" id="board-phase-label">
                Phase
              </span>
              <Select
                value={phaseId}
                disabled={busy}
                onValueChange={setPhaseId}
              >
                <SelectTrigger aria-labelledby="board-phase-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selected?.plan?.phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SidePanelBody>
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setAdding(false)
                setError("")
              }}
            >
              Cancel
            </SidePanelButton>
            <SidePanelButton type="submit" disabled={busy || !phaseId}>
              {busy ? "Adding…" : "Add task"}
            </SidePanelButton>
          </SidePanelFooter>
        </Form>
      </SidePanel>
      {!adding && !columnEdit && !deleting && error && <Alert>{error}</Alert>}
      {busy && <p role="status">Saving task status…</p>}
      <div
        aria-label="Task board"
        role="region"
        tabIndex={0}
        className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#294a9b]"
      >
        <div className="flex w-max min-w-full items-stretch gap-3 pb-3">
          {columns.map((column) => {
            const status = column.status
            const custom = !statuses.includes(column.id as ProjectTaskStatus)
            const items = rows.filter((row) => {
              const assignment = (workspace.kanbanAssignments ?? []).find(
                (item) =>
                  item.projectId === row.stream.id &&
                  item.taskId === row.task.id,
              )
              return custom
                ? assignment?.columnId === column.id
                : row.task.status === status && !assignment
            })
            return (
              <section
                key={column.id}
                aria-label={column.name}
                className={`min-h-[180px] w-80 shrink-0 rounded-md border px-2 pb-3 ${hovered === status ? "border-[#3153a5] bg-[#edf3ff]" : "border-[#e1e4ea] bg-[#fafbfc]"}`}
                onDragOver={(event) => {
                  if (
                    !custom &&
                    dragged &&
                    !busy &&
                    dragged.status !== status
                  ) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    setHovered(status)
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setHovered(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setHovered(null)
                  if (!custom && dragged && !busy && dragged.status !== status)
                    void changeStatus(dragged.projectId, dragged.taskId, status)
                  setDragged(null)
                }}
              >
                <h2 className="m-0 flex min-h-11 items-center gap-2 px-1 text-xs font-semibold">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${statusDots[status]}`}
                  />
                  {column.name} <Pill tone="neutral">{items.length}</Pill>
                  {custom && workspace.canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="boardAction"
                          className="ml-auto"
                          aria-label={`Manage ${column.name}`}
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={() =>
                            setColumnEdit({ id: column.id, name: column.name })
                          }
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setDeleting({ id: column.id, name: column.name })
                          }
                        >
                          Delete column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </h2>
                {items.length === 0 && (
                  <p className="px-1 text-xs text-[#65718a]">No tasks</p>
                )}
                <div className="space-y-2">
                  {items.map(({ stream, phase, task }) => {
                    const terminal = ["COMPLETED", "CANCELLED"].includes(
                      stream.status,
                    )
                    const assignee = stream.staff?.find(
                      (person) => person.id === task.employeeId,
                    )
                    return (
                      <article
                        key={`${stream.id}:${phase.id}:${task.id}`}
                        draggable={!busy && !terminal}
                        onDragStart={(event) => {
                          if (busy || terminal) {
                            event.preventDefault()
                            return
                          }
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData("text/plain", task.id)
                          setDragged({
                            projectId: stream.id,
                            taskId: task.id,
                            status: task.status,
                          })
                        }}
                        onDragEnd={() => {
                          setDragged(null)
                          setHovered(null)
                        }}
                        className="relative overflow-hidden rounded-md border border-[#dfe5ec] bg-white"
                      >
                        <TaskRowActions
                          card
                          workspaceId={workspace.id}
                          stream={stream}
                          task={task}
                          onUpdated={onUpdated}
                          disabled={busy || terminal}
                          cardContent={
                            <>
                              <span className="line-clamp-3 w-full break-words font-semibold text-[#142037]">
                                {task.title}
                              </span>
                              <span className="w-full break-words font-normal text-[#65718a]">
                                {stream.serviceName} · {phase.title}
                              </span>
                              {(task.employeeId || task.dueDate) && (
                                <span className="w-full break-words font-normal text-[#65718a]">
                                  {assignee?.fullName ||
                                    (task.employeeId
                                      ? "No longer assigned to project"
                                      : "")}
                                  {task.employeeId && task.dueDate ? " · " : ""}
                                  {task.dueDate
                                    ? new Date(
                                        `${task.dueDate}T00:00:00`,
                                      ).toLocaleDateString()
                                    : ""}
                                </span>
                              )}
                            </>
                          }
                        />
                        <div className="absolute top-1 right-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="boardAction"
                                disabled={busy || terminal}
                                aria-label={`Change status for ${task.title}`}
                              >
                                <MoreHorizontal size={16} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              aria-label={`Change status for ${task.title}`}
                            >
                              {columns.map((next) => (
                                <DropdownMenuItem
                                  key={next.id}
                                  variant="compact"
                                  onSelect={() =>
                                    void changeStatus(
                                      stream.id,
                                      task.id,
                                      next.status,
                                      statuses.includes(
                                        next.id as ProjectTaskStatus,
                                      )
                                        ? null
                                        : next.id,
                                    )
                                  }
                                >
                                  {next.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </article>
                    )
                  })}
                </div>
                {status === "NOT_STARTED" && (
                  <div className="mt-2 flex justify-center">
                    <Button
                      size="touch"
                      variant="ghost"
                      disabled={busy || !available.length}
                      onClick={() => {
                        const first = available[0]
                        setProjectId(first?.id ?? "")
                        setPhaseId(first?.plan?.phases[0]?.id ?? "")
                        setError("")
                        setAdding(true)
                      }}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Add task
                    </Button>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
