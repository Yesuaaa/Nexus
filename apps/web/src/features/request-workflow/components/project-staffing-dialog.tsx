"use client"

import { useState } from "react"
import { Check, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow } from "../model/workflow"

export function ProjectStaffingDialog({
  workflow,
  controls,
  mode,
  onClose,
  onReturnFocus,
}: {
  workflow: Workflow
  controls: WorkflowControls
  mode: "activation" | "staffing"
  onClose: () => void
  onReturnFocus: () => void
}) {
  const staff = workflow.internal?.staff ?? []
  const [selection, setSelection] = useState(() =>
    staff
      .filter((person) => person.assigned && person.status === "ACTIVE")
      .map((person) => person.id),
  )
  const [search, setSearch] = useState("")
  const [actionError, setActionError] = useState("")
  const selected = staff.filter(
    (person) => person.status === "ACTIVE" && selection.includes(person.id),
  )
  const assigned = staff.filter((person) => person.assigned)
  const approved =
    selected.length > 0 &&
    selected.length === assigned.length &&
    assigned.every(
      (person) => person.status === "ACTIVE" && selection.includes(person.id),
    )
  const activation = mode === "activation"
  const mutable =
    workflow.permissions.manage &&
    !!workflow.internal &&
    !!workflow.approval &&
    (activation
      ? workflow.state === "READY_FOR_ACTIVATION"
      : [
          "AGREEMENT_PAYMENT_PENDING",
          "READY_FOR_ACTIVATION",
          "ACTIVE_PROJECT",
        ].includes(workflow.state))
  const visible = staff.filter((person) =>
    `${person.fullName} ${person.position ?? ""} ${person.skills.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  )
  async function submit() {
    if (controls.busy || !mutable || !selected.length) return
    setActionError("")
    if (activation && approved) {
      if (await controls.act({ type: "ACTIVATE_PROJECT" })) onClose()
      else setActionError("Couldn't activate the project. Please try again.")
    } else {
      if (
        await controls.act({
          type: "STAFF_PROJECT",
          employeeIds: selected.map((person) => person.id),
        })
      ) {
        if (!activation) onClose()
      } else
        setActionError(
          "Couldn't approve staffing. Your selection is saved here so you can retry.",
        )
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !controls.busy) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onReturnFocus()
        }}
        overlayClassName="bg-[#14213d]/40"
        className="flex max-h-[calc(100dvh-24px)] w-[min(600px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border-[#dedede] bg-background p-0 shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eceef1] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="mt-0 mb-1 text-[10px] font-semibold tracking-wide text-[#738096] uppercase">
              {workflow.request.referenceNumber || workflow.request.id}
            </p>
            <DialogTitle className="m-0 text-xl font-semibold tracking-tight">
              {activation ? "Activate project" : "Manage project staff"}
            </DialogTitle>
            <DialogDescription className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
              {workflow.request.serviceName} ·{" "}
              {workflow.request.department?.name || "Your department"}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            aria-label="Close project staffing"
            onClick={onClose}
            className="size-8 shrink-0 p-0"
          >
            <X size={15} />
          </Button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {activation && (
            <ol
              aria-label="Project activation steps"
              className="mt-0 mb-5 grid list-none grid-cols-2 gap-3 p-0"
            >
              {["Approve staffing", "Activate project"].map((step, index) => (
                <li
                  key={step}
                  aria-current={
                    (approved ? index === 1 : index === 0) ? "step" : undefined
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold",
                    index === 0 || approved
                      ? "border-[#d6dfec] bg-[#edf2fb] text-[#203f8c]"
                      : "border-[#e8ebef] text-[#8791a2]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[10px]",
                      index === 0 || approved
                        ? "bg-[#203f8c] text-white"
                        : "bg-[#e8ebef]",
                    )}
                  >
                    {index === 0 && approved ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-semibold text-[#182235]">
                Select your project team
              </h3>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                Review roles, skills, and current project counts. Choose at
                least one active employee.
              </p>
            </div>
            <span
              className="shrink-0 rounded-full bg-[#eaf0fb] px-2.5 py-1 text-[10px] font-semibold text-[#203f8c]"
              role="status"
            >
              {selected.length} selected
            </span>
          </div>
          {!!staff.length && (
            <SearchField
              label="Search department staff"
              placeholder="Search name, role, or skills…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              containerClassName="mb-3 w-full max-[1050px]:w-full"
            />
          )}
          <fieldset
            disabled={controls.busy || !mutable}
            className="m-0 grid gap-2 border-0 p-0"
          >
            <legend className="sr-only">Department employees</legend>
            {visible.map((person) => {
              const active = person.status === "ACTIVE"
              const checked = active && selection.includes(person.id)
              return (
                <label
                  key={person.id}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-xl border p-3 transition-colors",
                    !active
                      ? "border-[#e8ebef] bg-[#f5f7fa] opacity-65"
                      : checked
                        ? "cursor-pointer border-[#9bb0db] bg-[#edf2fb]"
                        : "cursor-pointer border-[#e1e6ee] bg-white hover:border-[#a7b9df]",
                  )}
                >
                  <input
                    type="checkbox"
                    name="employeeIds"
                    value={person.id}
                    disabled={!active}
                    checked={checked}
                    onChange={(event) => {
                      setSelection((current) =>
                        event.target.checked
                          ? [...current, person.id]
                          : current.filter((id) => id !== person.id),
                      )
                      setActionError("")
                    }}
                    className="mt-1 size-4 shrink-0 accent-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <strong className="text-xs font-semibold text-[#182235]">
                        {person.fullName}
                      </strong>
                      <span className="text-[10px] text-[#52627a]">
                        {person.activeProjectCount} active{" "}
                        {person.activeProjectCount === 1
                          ? "project"
                          : "projects"}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] text-[#738096]">
                      {person.position || "Staff"}
                      {!active &&
                        ` · ${person.status.toLowerCase().replaceAll("_", " ")}`}
                    </span>
                    {!!person.skills.length && (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {person.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-md bg-[#e8eef7] px-1.5 py-0.5 text-[10px] text-[#52627a]"
                          >
                            {skill}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>
          {!visible.length && (
            <div className="rounded-xl border border-dashed border-[#d6dfec] px-4 py-7 text-center">
              <Users
                size={22}
                className="mx-auto mb-2 text-[#8791a2]"
                aria-hidden="true"
              />
              <p className="m-0 text-xs text-[#738096]">
                {staff.length
                  ? "No staff match your search."
                  : "No employees are assigned to this department."}
              </p>
            </div>
          )}
          <p
            className={cn(
              "mt-4 mb-0 rounded-lg px-3 py-2.5 text-xs leading-5",
              approved
                ? "bg-[#ecfdf3] text-[#19703a]"
                : "bg-[#edf2fb] text-[#52627a]",
            )}
            role="status"
          >
            {approved
              ? activation
                ? "Staffing approved. Activate the project to open its workspace."
                : "These employees are currently assigned to the project."
              : activation
                ? "Approve your team before activating. Staffing approval does not activate the project."
                : "Saving updates project access for the selected employees."}
          </p>
          {!mutable && (
            <p role="alert" className="mt-3 mb-0 text-xs text-[#bc3649]">
              Staffing is unavailable at the current booking stage.
            </p>
          )}
          {actionError && (
            <p
              role="alert"
              className="mt-3 mb-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
            >
              {controls.error || actionError}
            </p>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#eceef1] bg-[#f8fafd] px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            onClick={onClose}
            className="h-10 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={
              controls.busy ||
              !mutable ||
              !selected.length ||
              (!activation && approved)
            }
            className="h-10 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
          >
            {controls.busy
              ? activation && approved
                ? "Activating…"
                : "Saving…"
              : activation
                ? approved
                  ? "Activate project"
                  : "Approve staffing"
                : "Save staffing"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
