"use client"

import { Form } from "@/components/ui/form"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow, WorkflowAction } from "../model/workflow"
import {
  WorkflowField,
  workflowButton,
  workflowInput,
} from "./workflow-primitives"
import { WorkflowDraftFrame } from "./workflow-draft-frame"
import { QuotationForm } from "./quotation-form"
import {
  WorkflowDraftFooter,
  draftSecondaryButton,
  draftPrimaryButton,
} from "./workflow-draft-footer"

export type WorkflowDraftAction =
  "request-information" | "quotation" | "approver-assignments" | "internal-note"

type WorkflowActionDraftProps = {
  action: WorkflowDraftAction
  workflow: Workflow
  controls: WorkflowControls
  onClose: () => void
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
    <Form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (await controls.act(action(new FormData(event.currentTarget))))
          onClose()
      }}
    >
      {children}
      <WorkflowDraftFooter>
        <Button
          type="button"
          variant="outline"
          className={draftSecondaryButton}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button className={draftPrimaryButton} disabled={controls.busy}>
          {controls.busy ? "Saving…" : label}
        </Button>
      </WorkflowDraftFooter>
    </Form>
  )
}

export function WorkflowActionDraft({
  action,
  workflow,
  controls,
  onClose,
}: WorkflowActionDraftProps) {
  if (action === "request-information") {
    return (
      <WorkflowDraftFrame
        booking={workflow.request}
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
          <WorkflowField label="Request detail information (required)">
            <textarea
              name="details"
              required
              onChange={(event) =>
                event.currentTarget.setCustomValidity(
                  event.currentTarget.value.trim()
                    ? ""
                    : "Enter request detail information.",
                )
              }
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
      </WorkflowDraftFrame>
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
        !(
          workflow.consultationComplete ??
          workflow.consultations.some(
            (consultation) => consultation.status === "COMPLETED",
          )
        )
      const canPrepare = pendingRequirements === 0 && !consultationIncomplete

      return (
        <WorkflowDraftFrame
          booking={workflow.request}
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
        </WorkflowDraftFrame>
      )
    }

    return (
      <WorkflowDraftFrame
        booking={workflow.request}
        title="Prepare quotation"
        status="Draft · Not sent"
        description="Add scope and pricing details, then review before sending."
        onClose={onClose}
      >
        <QuotationForm
          workflow={workflow}
          controls={controls}
          onComplete={onClose}
          onCancel={onClose}
        />
      </WorkflowDraftFrame>
    )
  }

  if (action === "approver-assignments") {
    const internal = workflow.internal
    if (!internal) return null
    return (
      <WorkflowDraftFrame
        booking={workflow.request}
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
      </WorkflowDraftFrame>
    )
  }

  const mutable = !["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(
    workflow.state,
  )
  return (
    <WorkflowDraftFrame
      booking={workflow.request}
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
    </WorkflowDraftFrame>
  )
}
