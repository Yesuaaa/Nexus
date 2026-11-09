"use client"

import { useState } from "react"
import { Users } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { MemberIdentity } from "@/components/ui/member-identity"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DialogStepProgress } from "@/components/ui/dialog-step-progress"
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
  const [projectName, setProjectName] = useState(
    workflow.project?.name || workflow.request.title,
  )
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
    `${person.fullName} ${person.position ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  )
  async function submit() {
    if (controls.busy || !mutable || !selected.length) return
    setActionError("")
    if (activation && approved) {
      const name = projectName.trim()
      if (name.length < 2 || name.length > 120) {
        setActionError("Enter a project name between 2 and 120 characters.")
        return
      }
      if (await controls.act({ type: "ACTIVATE_PROJECT", projectName: name }))
        onClose()
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
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="flex max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-4 border-b border-[#eceef1] p-5 text-left sm:px-6 sm:pt-6 sm:pb-5">
          <div className="min-w-0">
            <p className="mt-0 mb-1 text-[10px] font-semibold tracking-wide text-[#738096] uppercase">
              {workflow.request.referenceNumber || workflow.request.id}
            </p>
            <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
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
            className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
          >
            <CloseIcon width="16" height="16" />
          </Button>
        </DialogHeader>
        {activation && (
          <DialogStepProgress
            steps={[
              { label: "Approve staffing" },
              { label: "Activate project" },
            ]}
            currentStep={approved ? 1 : 0}
            label="Project activation steps"
          />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {activation && (
            <div className="mb-5 grid gap-1.5">
              <label
                className="text-xs font-semibold text-foreground"
                htmlFor="project-activation-name"
              >
                Project name
              </label>
              <FormInput
                id="project-activation-name"
                value={projectName}
                maxLength={120}
                aria-describedby="project-activation-name-help"
                disabled={controls.busy || !mutable}
                onChange={(event) => {
                  setProjectName(event.target.value)
                  setActionError("")
                }}
              />
              <p
                id="project-activation-name-help"
                className="m-0 text-[11px] leading-5 text-[#738096]"
              >
                This name appears in the client project portal and workspace.
              </p>
            </div>
          )}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-semibold text-[#182235]">
                Select your project team
              </h3>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                Review job titles. Choose at least one active employee.
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
              placeholder="Search name or job title…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              containerClassName="mb-3 w-full max-[1050px]:w-full"
            />
          )}
          <fieldset
            disabled={controls.busy || !mutable}
            className="m-0 border-0 p-0"
          >
            <legend className="sr-only">Department employees</legend>
            <ul
              className="m-0 grid max-h-64 list-none gap-2 overflow-y-auto p-0"
              aria-label="Department employees"
            >
              {visible.map((person) => {
                const active = person.status === "ACTIVE"
                const checked = active && selection.includes(person.id)
                return (
                  <li
                    key={person.id}
                    className={cn(
                      "flex min-w-0 items-center gap-3 rounded-lg border border-[#e1e6ee] p-2.5 transition-colors",
                      !active
                        ? "bg-[#f5f7fa] opacity-65"
                        : checked
                          ? "border-[#9bb0db] bg-[#edf2fb]"
                          : "bg-[#f8fafd] hover:border-[#a7b9df]",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="employeeIds"
                      value={person.id}
                      aria-label={person.fullName}
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
                      className="size-4 shrink-0 accent-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"
                    />
                    <div className="min-w-0 flex-1">
                      <MemberIdentity
                        member={{
                          fullName: person.fullName,
                          email: null,
                          user: null,
                        }}
                        secondaryText={
                          [
                            person.position?.trim() || null,
                            !active
                              ? person.status.toLowerCase().replaceAll("_", " ")
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || null
                        }
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
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
        <DialogFooter className="flex !flex-row shrink-0 items-center justify-end gap-2 border-t border-[#eceef1] bg-background px-5 py-4 sm:px-6 sm:space-x-0">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
