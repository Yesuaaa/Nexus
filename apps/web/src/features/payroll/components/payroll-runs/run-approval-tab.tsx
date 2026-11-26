"use client"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { formatPayrollDate } from "../../model/period-format"
import type { PayrollRun } from "../../api/payroll-runs-api"
import type { PayrollRunDetailsState } from "../../hooks/use-payroll-run-details"
import { approvalTimestamp, formatMoney } from "../../model/payroll-run-view"

/** Submission, approval review and approval history. */
export function RunApprovalTab({
  details,
  data,
}: {
  details: PayrollRunDetailsState
  data: PayrollRun
}) {
  const {
    approvals,
    selectedRevision,
    submission,
    canManage,
    eligible,
    reviewIsCurrent,
    pending,
    openApproval,
    selfApproval,
    displayedHistoryEvents,
  } = details

  return (
    <>
      {approvals && selectedRevision && (
        <>
          <SidePanelSection title="Submission">
            <DetailList>
              <DetailItem label="Submitted by">
                {submission?.actorName ?? submission?.actorId ?? "—"}
              </DetailItem>
              <DetailItem label="Submitted at">
                {submission
                  ? approvalTimestamp.format(new Date(submission.createdAt))
                  : "—"}
              </DetailItem>
              <DetailItem label="Submission ID">
                <span className="font-mono text-[10px]">
                  {submission?.id ?? "—"}
                </span>
              </DetailItem>
            </DetailList>
          </SidePanelSection>
          <SidePanelSection title="Financial summary">
            <div className="grid gap-2">
              <div>
                <p className="m-0 text-[10px] font-semibold tracking-[0.08em] text-[#738096] uppercase">
                  Net pay for approval
                </p>
                <p className="m-0 mt-1 text-2xl leading-tight font-semibold tabular-nums">
                  {formatMoney(selectedRevision.netTotal)}
                </p>
              </div>
              <DetailList>
                <DetailItem label="Gross pay">
                  <span className="tabular-nums">
                    {formatMoney(selectedRevision.grossTotal)}
                  </span>
                </DetailItem>
                <DetailItem label="Deductions">
                  <span className="tabular-nums">
                    {formatMoney(selectedRevision.deductionsTotal)}
                  </span>
                </DetailItem>
              </DetailList>
            </div>
          </SidePanelSection>
        </>
      )}
      {selectedRevision && !approvals && (
        <SidePanelSection title="Approval review">
          <DetailList>
            <DetailItem label="Revision">
              {selectedRevision.revision} · {selectedRevision.id}
            </DetailItem>
            <DetailItem label="Prepared by">
              {data.createdBy.fullName ?? data.createdBy.id}
            </DetailItem>
            <DetailItem label="Calculated by">
              {selectedRevision.createdBy?.fullName ??
                selectedRevision.createdBy?.id}
            </DetailItem>
          </DetailList>
          {canManage &&
            data.status === "CALCULATED" &&
            (eligible && reviewIsCurrent ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => openApproval("submit")}
              >
                Submit for Approval
              </Button>
            ) : (
              <Alert>
                {!reviewIsCurrent
                  ? "Select the current revision to submit it."
                  : "Resolve all employee calculation issues before submitting."}
              </Alert>
            ))}
        </SidePanelSection>
      )}
      {approvals &&
        canManage &&
        data.status === "PENDING_APPROVAL" &&
        !reviewIsCurrent && (
          <Alert>Select the submitted revision to make a decision.</Alert>
        )}
      {approvals &&
        canManage &&
        data.status === "PENDING_APPROVAL" &&
        reviewIsCurrent &&
        selfApproval && (
          <Alert>
            The preparer and calculation author cannot approve this revision.
          </Alert>
        )}
      {data.calculationHistory.some(
        (revision) => revision.approvalEvents?.length,
      ) && (
        <SidePanelSection title="Approval history">
          <DetailList>
            {displayedHistoryEvents.map(({ revision, event }) => {
              const action = event.action
                .replace(/^PAYROLL_/, "")
                .replaceAll("_", " ")
                .toLowerCase()
              const actionLabel = approvals
                ? action.replace(/^./, (character) => character.toUpperCase())
                : action
              return (
                <DetailItem
                  key={event.id}
                  label={
                    approvals
                      ? `Revision ${revision.revision} ${actionLabel}`
                      : `Revision ${revision.revision} · ${action}`
                  }
                >
                  <span>
                    {event.actorName ?? event.actorId} ·{" "}
                    {approvals
                      ? approvalTimestamp.format(new Date(event.createdAt))
                      : formatPayrollDate(event.createdAt)}
                  </span>
                  {event.reason && (
                    <p className="m-0 mt-1 text-left text-[11px] font-normal text-[#52627a]">
                      Reason: {event.reason}
                    </p>
                  )}
                </DetailItem>
              )
            })}
          </DetailList>
        </SidePanelSection>
      )}
    </>
  )
}
