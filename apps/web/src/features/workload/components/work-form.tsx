"use client"

import { useEffect, useState, type FormEvent } from "react"
import { sileo } from "sileo"
import { WorkloadButton as Button } from "./workload-button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  saveWork,
  workloadOptions,
  configureProject,
  createProjectTask,
  type EmployeeWorkload,
  type Options,
} from "../api/workload-api"
import {
  Field,
  fieldClass,
  labelText,
  manilaISO,
  splitSkills,
} from "./workload-ui"

export function WorkForm({
  employees,
  crossDepartment,
  initialEmployeeId,
  onClose,
  onSaved,
}: {
  employees: EmployeeWorkload[]
  crossDepartment: boolean
  initialEmployeeId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [options, setOptions] = useState<Options | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState("")
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "")
  const [requirements, setRequirements] = useState("")
  const [unallocatedProject, setUnallocatedProject] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  useEffect(() => {
    let active = true
    workloadOptions()
      .then((data) => {
        if (active) setOptions(data)
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load assignment options",
          )
      })
    return () => {
      active = false
    }
  }, [])
  const choices = options
    ? [
        ...options.serviceRequests.map((r) => ({
          value: `serviceRequestId:${r.id}`,
          label: `Request · ${r.title}`,
          preferred: r.preferredSpecialistName,
        })),
        ...options.projects.flatMap((p) => [
          {
            value: `projectId:${p.id}`,
            label: `Project · ${p.name}`,
            preferred: null,
          },
          ...p.tasks.map((t) => ({
            value: `taskId:${t.id}`,
            label: `${p.name} · ${t.title}`,
            preferred: null,
          })),
        ]),
      ]
    : []
  const preferred = choices.find((c) => c.value === target)?.preferred
  const selected = employees.find((e) => e.id === employeeId)
  const missing = selected
    ? splitSkills(requirements).filter(
        (skill) =>
          !selected.skills.some((s) => s.toLowerCase() === skill.toLowerCase()),
      )
    : []
  async function setupProject(createTask: boolean) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      let nextTarget: string
      if (createTask) {
        const task = await createProjectTask(target.split(":")[1], taskTitle)
        nextTarget = `taskId:${task.id}`
      } else {
        await configureProject(unallocatedProject)
        nextTarget = `projectId:${unallocatedProject}`
      }
      setOptions(await workloadOptions())
      setTarget(nextTarget)
      setUnallocatedProject("")
      setTaskTitle("")
      sileo.success({
        title: createTask
          ? "Project task created"
          : "Responsible department set",
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not configure project",
      )
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget),
      [targetKey, targetId] = target.split(":")
    setBusy(true)
    setError("")
    try {
      await saveWork(
        {
          [targetKey]: targetId,
          title: data.get("title"),
          startsAt: manilaISO(data.get("startsAt")),
          endsAt: manilaISO(data.get("endsAt")),
          estimatedHours: Number(data.get("estimatedHours")),
          deadline: data.get("deadline")
            ? manilaISO(data.get("deadline"))
            : null,
          priority: data.get("priority"),
          requiredSkills: splitSkills(requirements),
          ...(crossDepartment
            ? { recipientDepartmentId: data.get("recipientDepartmentId") }
            : { employeeId }),
        },
        crossDepartment,
      )
      sileo.success({
        title: crossDepartment
          ? "Staffing request sent"
          : "Assignment confirmed",
      })
      onSaved()
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the assignment",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="max-h-[calc(100dvh-28px)] w-[calc(100vw-28px)] overflow-y-auto rounded-[13px] border-[#dedede] p-5 shadow-[0_22px_75px_rgb(18_36_73_/_22%)] sm:max-w-2xl sm:p-6"
      >
        <header className="-mx-5 border-b border-[#eceef1] px-5 pb-5 pr-10 sm:-mx-6 sm:px-6 sm:pr-10">
          <DialogTitle className="text-[20px] leading-tight font-[650] tracking-[-0.03em]">
            {crossDepartment
              ? "Request cross-department staffing"
              : "Assign personnel"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-[#738096]">
            {crossDepartment
              ? "The receiving department manager chooses an employee and approves the assignment. Pending requests do not reserve employee capacity."
              : "Review skills, availability and workload before confirming. Times use Asia/Manila. Each assignment reserves one continuous working block."}
          </DialogDescription>
        </header>
        <form onSubmit={submit} className="grid gap-4">
          {!!options?.unallocatedProjects.length && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Field label="Establish project responsibility (Admin)">
                <select
                  className={fieldClass}
                  value={unallocatedProject}
                  onChange={(e) => setUnallocatedProject(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Choose an unallocated project</option>
                  {options.unallocatedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Set your department as responsible before staffing this project.
                Existing department responsibilities cannot be replaced here.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !unallocatedProject}
                onClick={() => void setupProject(false)}
              >
                Set responsible department
              </Button>
            </div>
          )}
          <Field label="Service request, project or task">
            <select
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={fieldClass}
              disabled={!options || busy}
            >
              <option value="">Choose work</option>
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {options && choices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No open work belongs to your department. Requests use the
              service’s departments; projects must have participating
              departments configured.
            </p>
          )}
          {preferred && (
            <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              Client preference: {preferred}. The department manager makes the
              final selection.
            </p>
          )}
          {target.startsWith("projectId:") && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Field label="New project task (optional)">
                <input
                  className={fieldClass}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  maxLength={160}
                  disabled={busy}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={busy || taskTitle.trim().length === 0}
                onClick={() => void setupProject(true)}
              >
                Create and select task
              </Button>
            </div>
          )}
          <Field label="Assignment title">
            <input
              name="title"
              required
              maxLength={160}
              className={fieldClass}
            />
          </Field>
          {crossDepartment ? (
            <Field label="Receiving department">
              <select
                name="recipientDepartmentId"
                required
                className={fieldClass}
                disabled={!options || busy}
              >
                <option value="">Choose a department</option>
                {options?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Employee">
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Choose an employee</option>
                {employees.map((e) => (
                  <option
                    key={e.id}
                    value={e.id}
                    disabled={
                      e.employeeStatus !== "ACTIVE" || !e.scheduleConfigured
                    }
                  >
                    {e.fullName} · {labelText(e.status)} · {e.remainingHours}h
                    remaining in view
                    {!e.scheduleConfigured ? " · Schedule required" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {selected && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p>
                Recorded skills: {selected.skills.join(", ") || "None recorded"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {selected.allocatedHours}h allocated / {selected.capacityHours}h
                capacity in the selected period. The scheduled block is checked
                again when you confirm.
              </p>
            </div>
          )}
          <Field label="Required skills (comma separated)">
            <input
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className={fieldClass}
              maxLength={2000}
              placeholder="e.g. design, typescript"
            />
          </Field>
          {missing.length > 0 && (
            <p role="alert" className="text-sm text-red-700">
              Missing recorded skills: {missing.join(", ")}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start (Manila)">
              <input
                type="datetime-local"
                name="startsAt"
                required
                className={fieldClass}
              />
            </Field>
            <Field label="End (Manila)">
              <input
                type="datetime-local"
                name="endsAt"
                required
                className={fieldClass}
              />
            </Field>
            <Field label="Estimated allocated hours">
              <input
                name="estimatedHours"
                type="number"
                min="0.01"
                step="0.01"
                required
                className={fieldClass}
              />
            </Field>
            <Field label="Priority">
              <select
                name="priority"
                defaultValue="NORMAL"
                className={fieldClass}
              >
                {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p}>
                    {labelText(p)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Deadline (optional, Manila)">
            <input
              type="datetime-local"
              name="deadline"
              className={fieldClass}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !options || !target || missing.length > 0}
            >
              {busy
                ? "Saving…"
                : crossDepartment
                  ? "Send staffing request"
                  : "Confirm assignment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
