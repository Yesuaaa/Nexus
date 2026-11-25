"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { FormTextarea } from "@/components/ui/form-input"
import type { PayrollRunDetailsState } from "../../hooks/use-payroll-run-details"

/** Approval and recalculation confirmations. */
export function RunDialogs({ details }: { details: PayrollRunDetailsState }) {
  const {
    approvalAction,
    run,
    pending,
    actionError,
    setApprovalAction,
    confirmApproval,
    reason,
    setReason,
    confirmRecalculate,
    setConfirmRecalculate,
    recalculate,
  } = details

  return (
    <>
      {approvalAction && (
        <ConfirmationDialog
          title={
            {
              submit: "Submit payroll for approval?",
              approve: "Approve this payroll revision?",
              reject: "Reject this payroll revision?",
            }[approvalAction]
          }
          subject={run.data?.period.cutoffLabel}
          description={
            approvalAction === "reject"
              ? "The submitted revision and reason will be kept in the approval history."
              : "This decision applies to the selected calculation revision."
          }
          confirmLabel={
            { submit: "Submit", approve: "Approve", reject: "Reject" }[
              approvalAction
            ]
          }
          pendingLabel="Saving…"
          pending={pending}
          destructive={approvalAction === "reject"}
          error={actionError}
          onClose={() => setApprovalAction(null)}
          onConfirm={() => void confirmApproval()}
        >
          {approvalAction === "reject" && (
            <label className="mt-4 grid gap-2 text-sm">
              Rejection reason
              <FormTextarea
                value={reason}
                required
                maxLength={500}
                minLength={5}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
        </ConfirmationDialog>
      )}
      {confirmRecalculate && (
        <ConfirmationDialog
          title="Recalculate this draft run?"
          subject={run.data?.period.cutoffLabel}
          description="This saves a new revision from the current compensation and attendance records. Earlier revisions stay available, and review or blocked employees remain outside the known totals."
          confirmLabel="Recalculate"
          pendingLabel="Recalculating…"
          pending={pending}
          destructive={false}
          error={actionError}
          onClose={() => setConfirmRecalculate(false)}
          onConfirm={() => void recalculate()}
        />
      )}
    </>
  )
}
