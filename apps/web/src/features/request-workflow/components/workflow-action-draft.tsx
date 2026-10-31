"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow, WorkflowAction } from "../model/workflow"
import {
  WorkflowField,
  workflowButton,
  workflowInput,
} from "./workflow-primitives"
import { QuotationForm } from "./workflow-context-panel"

export type WorkflowDraftAction =
  | "request-information"
  | "schedule-consultation"
  | "quotation"
  | "approver-assignments"
  | "internal-note"

type WorkflowActionDraftProps = {
  action: WorkflowDraftAction
  workflow: Workflow
  controls: WorkflowControls
  onClose: () => void
}

function DraftFrame({
  title,
  status,
  internal = false,
  description,
  onClose,
  children,
}: {
  title: string
  status?: string
  internal?: boolean
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="mx-5 mb-2 max-h-[min(45dvh,400px)] overflow-y-auto overscroll-contain rounded-xl border border-[#d8e1ef] bg-white px-4 py-3 shadow-[0_2px_8px_rgb(18_36_73_/_4%)] max-[767px]:mx-3"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="m-0 text-sm font-semibold text-[#182235]">
              {title}
            </h2>
            {internal ? (
              <span className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-[9px] font-semibold tracking-wide text-[#9a4f00]">
                INTERNAL · STAFF ONLY
              </span>
            ) : (
              status && (
                <span className="text-[10px] text-[#8791a2]">{status}</span>
              )
            )}
          </div>
          {description && (
            <p className="mt-1 mb-0 text-[11px] leading-5 text-[#52627a]">
              {description}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          aria-label={`Close ${title.toLowerCase()} draft`}
          className="size-8 shrink-0 border-0 bg-transparent p-0 text-[#52627a] hover:bg-[#f1f4fa]"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </header>
      {children}
    </section>
  )
}

function DraftForm({
  controls,
  label,
  onClose,
  action,
  children,
}: {
  controls: WorkflowControls
  label: string
  onClose: () => void
  action: (data: FormData) => WorkflowAction
  children: ReactNode
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (await controls.act(action(new FormData(event.currentTarget))))
          onClose()
      }}
    >
      {children}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ebef] pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-9 min-w-[92px] text-[11px]"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          className={`${workflowButton} min-w-[130px] bg-[#203f8c] text-white hover:bg-[#172f70]`}
          disabled={controls.busy}
        >
          {controls.busy ? "Saving…" : label}
        </Button>
      </div>
    </form>
  )
}

function localDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

export function WorkflowActionDraft({
  action,
  workflow,
  controls,
  onClose,
}: WorkflowActionDraftProps) {
  if (action === "request-information") {
    return (
      <DraftFrame
        title="Request information"
        status="Draft · Not sent"
        description="What information do you need from the client?"
        onClose={onClose}
      >
        <DraftForm
          controls={controls}
          label="Send request"
          onClose={onClose}
          action={(data) => ({
            type: "REQUEST_REQUIREMENT",
            title: String(data.get("title")),
            details: String(data.get("details") || ""),
            mandatory: data.get("mandatory") === "on",
          })}
        >
          <WorkflowField label="Requirement title">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="e.g. Site access details"
              className={workflowInput}
            />
          </WorkflowField>
          <WorkflowField label="Instructions for the client">
            <textarea
              name="details"
              rows={3}
              maxLength={4000}
              placeholder="e.g. Please provide site address, access instructions, and any induction requirements."
              className={workflowInput}
            />
          </WorkflowField>
          <label className="flex min-h-8 items-center gap-2 text-[11px] font-medium text-[#203047]">
            <input
              name="mandatory"
              type="checkbox"
              defaultChecked
              className="size-4 accent-[#203f8c]"
            />
            Required before activation
          </label>
        </DraftForm>
      </DraftFrame>
    )
  }

  if (action === "schedule-consultation") {
    const today = localDateInputValue(new Date())
    return (
      <DraftFrame
        title="Schedule consultation"
        status="Draft · Not sent"
        onClose={onClose}
      >
        <DraftForm
          controls={controls}
          label="Send invitation"
          onClose={onClose}
          action={(data) => {
            const startsAt = new Date(
              `${String(data.get("date"))}T${String(data.get("time"))}`,
            )
            const endsAt = new Date(
              startsAt.getTime() + Number(data.get("duration")) * 60_000,
            )
            return {
              type: "SCHEDULE_CONSULTATION",
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              location: String(data.get("location")),
              notes: String(data.get("topic") || ""),
            }
          }}
        >
          <WorkflowField label="Consultation topic">
            <input
              name="topic"
              maxLength={500}
              placeholder="e.g. Project overview or technical discussion"
              className={workflowInput}
            />
          </WorkflowField>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <WorkflowField label="Preferred date">
              <input
                name="date"
                type="date"
                min={today}
                required
                className={workflowInput}
              />
            </WorkflowField>
            <WorkflowField label="Preferred time">
              <input
                name="time"
                type="time"
                required
                className={workflowInput}
              />
            </WorkflowField>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <WorkflowField label="Duration">
              <select
                name="duration"
                defaultValue="30"
                className={workflowInput}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1 hour 30 minutes</option>
                <option value="120">2 hours</option>
              </select>
            </WorkflowField>
            <WorkflowField label="Meeting link or location">
              <input
                name="location"
                required
                maxLength={1000}
                placeholder="Teams link or office address"
                className={workflowInput}
              />
            </WorkflowField>
          </div>
        </DraftForm>
      </DraftFrame>
    )
  }

  if (action === "quotation") {
    if (workflow.state === "CONSULTATION") {
      const pendingRequirements = workflow.requirements.filter(
        (requirement) =>
          requirement.mandatory && requirement.status !== "COMPLETED",
      ).length
      const consultationIncomplete =
        workflow.consultationRequired &&
        !workflow.consultations.some(
          (consultation) => consultation.status === "COMPLETED",
        )
      const canPrepare = pendingRequirements === 0 && !consultationIncomplete

      return (
        <DraftFrame
          title="Prepare quotation"
          status="Draft · Not sent"
          description="Review the request requirements before moving to quotation."
          onClose={onClose}
        >
          <div className="space-y-3">
            {!canPrepare && (
              <p className="m-0 rounded-lg bg-[#f6f8fc] px-3 py-2 text-[11px] leading-5 text-[#52627a]">
                {pendingRequirements > 0 &&
                  `${pendingRequirements} required ${pendingRequirements === 1 ? "item is" : "items are"} still incomplete. `}
                {consultationIncomplete &&
                  "Complete the required consultation before preparing a quotation."}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ebef] pt-3">
              <Button
                type="button"
                variant="outline"
                className="h-9 min-w-[92px] text-[11px]"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={`${workflowButton} min-w-[150px] bg-[#203f8c] text-white hover:bg-[#172f70]`}
                disabled={controls.busy || !canPrepare}
                onClick={async () => {
                  await controls.act({ type: "PREPARE_QUOTATION" })
                }}
              >
                {controls.busy ? "Checking…" : "Continue to quotation"}
              </Button>
            </div>
          </div>
        </DraftFrame>
      )
    }

    return (
      <DraftFrame
        title="Prepare quotation"
        status="Draft · Not sent"
        description="Add scope and pricing details for the client’s review."
        onClose={onClose}
      >
        <QuotationForm
          workflow={workflow}
          controls={controls}
          inline
          onComplete={onClose}
          onCancel={onClose}
        />
      </DraftFrame>
    )
  }

  if (action === "approver-assignments") {
    const internal = workflow.internal
    if (!internal) return null
    return (
      <DraftFrame
        title="Approver assignments"
        internal
        description="Assign staff to review the financial steps for this request."
        onClose={onClose}
      >
        <DraftForm
          controls={controls}
          label="Save assignments"
          onClose={onClose}
          action={(data) => ({
            type: "ASSIGN_APPROVERS",
            quotationApproverId:
              String(data.get("quotationApproverId") || "") || null,
            paymentVerifierId:
              String(data.get("paymentVerifierId") || "") || null,
          })}
        >
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <WorkflowField label="Quotation approver">
              <select
                name="quotationApproverId"
                defaultValue={internal.quotationApproverId || ""}
                className={workflowInput}
              >
                <option value="">Select an authorized approver</option>
                {internal.approvers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.id}
                  </option>
                ))}
              </select>
            </WorkflowField>
            <WorkflowField label="Payment verifier">
              <select
                name="paymentVerifierId"
                defaultValue={internal.paymentVerifierId || ""}
                className={workflowInput}
              >
                <option value="">Select an authorized verifier</option>
                {internal.approvers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.id}
                  </option>
                ))}
              </select>
            </WorkflowField>
          </div>
          <p className="m-0 text-[10px] leading-5 text-[#52627a]">
            Assigned staff can access only the approval records relevant to
            their role.
          </p>
        </DraftForm>
      </DraftFrame>
    )
  }

  const mutable = !["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(
    workflow.state,
  )
  return (
    <DraftFrame
      title="Internal note"
      internal
      description="Add a private note for your team about this request."
      onClose={onClose}
    >
      {mutable ? (
        <DraftForm
          controls={controls}
          label="Save note"
          onClose={onClose}
          action={(data) => ({
            type: "INTERNAL_NOTE",
            note: String(data.get("note")),
          })}
        >
          <WorkflowField label="Note for your team">
            <textarea
              name="note"
              required
              rows={4}
              maxLength={2000}
              placeholder="Add context for staff working on this request…"
              className={workflowInput}
            />
          </WorkflowField>
          <p className="m-0 text-[10px] leading-5 text-[#52627a]">
            Visible to staff only. The client will not see this note.
          </p>
        </DraftForm>
      ) : (
        <p className="m-0 rounded-lg bg-[#f6f8fc] px-3 py-2 text-[11px] text-[#52627a]">
          Notes can’t be added after this request is closed.
        </p>
      )}
    </DraftFrame>
  )
}
