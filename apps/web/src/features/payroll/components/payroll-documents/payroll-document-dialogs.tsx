"use client"

import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { humanizeEnum } from "@/lib/format"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { IndividualPayslipDetails } from "./individual-payslip-details"
import { PayrollRecordDetail } from "./record-layout"
import { timestamp, money } from "../../model/payroll-documents"
import { PayrollRequestPanel } from "./payroll-request-panel"

/** Confirmations and detail panels for payroll documents. */
export function PayrollDocumentDialogs({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    confirm,
    discardResponseConfirm,
    selected,
    setDiscardResponseConfirm,
    setSelected,
    resetForm,
    busy,
    error,
    setConfirm,
    mutate,
    withdrawal,
    withdrawalError,
    setWithdrawal,
    setWithdrawalError,
    withdrawConcern,
    slip,
    staff,
    setSlip,
    download,
    setRelated,
    setCreate,
  } = documents
  const confirmCalculation = confirm?.run.latestCalculation
  const confirmEmployeeCount =
    confirmCalculation?.payslipEmployeeCount ??
    (confirmCalculation
      ? confirmCalculation.calculatedItemCount +
        confirmCalculation.reviewItemCount +
        confirmCalculation.blockedItemCount
      : 0)
  const confirmGeneratedCount = confirmCalculation?.payslipGeneratedCount ?? 0
  const confirmMissingCount = Math.max(
    confirmEmployeeCount - confirmGeneratedCount,
    0,
  )
  return (
    <>
      {discardResponseConfirm && (
        <ConfirmationDialog
          title="Discard unsaved response?"
          subject={selected ? humanizeEnum(selected.type) : undefined}
          description="Your response changes haven't been saved. Close without saving?"
          confirmLabel="Discard changes"
          pendingLabel="Discarding…"
          pending={false}
          destructive={false}
          onClose={() => setDiscardResponseConfirm(false)}
          onConfirm={() => {
            setDiscardResponseConfirm(false)
            setSelected(null)
            resetForm()
          }}
        />
      )}
      {confirm && (
        <ConfirmationDialog
          title={
            confirm.action === "generate"
              ? "Generate payslips?"
              : "Publish payslips?"
          }
          subject={confirm.run.period.cutoffLabel}
          description={
            confirm.action === "generate"
              ? `Create ${confirmMissingCount} private PDFs from approved revision ${confirmCalculation?.revision ?? "—"}. ${confirmMissingCount} payslips are not generated yet.`
              : `Make ${confirmGeneratedCount} generated payslips available to employees. ${confirmMissingCount} documents are still missing.`
          }
          confirmLabel={confirm.action === "generate" ? "Generate" : "Publish"}
          pendingLabel="Saving…"
          pending={busy}
          destructive={false}
          error={error}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void mutate(
              "/runs/" +
                encodeURIComponent(confirm.run.id) +
                "/" +
                confirm.action +
                "-payslips",
            )
          }
        />
      )}
      {withdrawal && (
        <ConfirmationDialog
          title="Delete concern?"
          subject={humanizeEnum(withdrawal.type)}
          description="Are you sure you want to delete this payroll concern? This action will remove it from your active concerns."
          confirmLabel="Delete concern"
          pendingLabel="Deleting…"
          pending={busy}
          destructive
          error={withdrawalError}
          onClose={() => {
            if (!busy) {
              setWithdrawal(null)
              setWithdrawalError("")
            }
          }}
          onConfirm={() => void withdrawConcern()}
        />
      )}
      {slip && !staff && (
        <IndividualPayslipDetails
          key={slip.id}
          slip={slip}
          onClose={() => setSlip(null)}
          onDownload={() => download(slip)}
        />
      )}
      {slip && staff && (
        <PayrollRecordDetail
          sidePanel={staff}
          title="Payslip details"
          description={slip.reference}
          onClose={() => setSlip(null)}
        >
          <div
            className={staff ? "grid gap-2 text-sm" : "grid gap-2 p-4 text-sm"}
          >
            <p>
              EXP Digital Solutions · {slip.employeeName} ({slip.employeeNumber}
              )
            </p>
            <p>
              {slip.period.cutoffLabel} ·{" "}
              {humanizeEnum(slip.period.configuration.frequency)} · Revision{" "}
              {slip.revision}
            </p>
            <p>
              Generated {timestamp(slip.generatedAt)}
              {!staff && " by " + slip.generatedBy}
            </p>
            <p>
              {slip.publishedAt
                ? "Published " +
                  timestamp(slip.publishedAt) +
                  (!staff ? " by " + slip.publishedBy : "")
                : "Awaiting publication"}
            </p>
            {slip.lines.map((line, index) => (
              <p key={index}>
                {humanizeEnum(line.componentType)} · {line.name} ·{" "}
                {money(slip, line.amount)}
              </p>
            ))}
            <p>
              Gross {money(slip, slip.gross)} · Deductions{" "}
              {money(slip, slip.deductions)} · Net {money(slip, slip.net)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void download(slip)}>
                Download PDF
              </Button>
              {staff && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setRelated(slip.id)
                    setSlip(null)
                    setCreate(true)
                  }}
                >
                  Raise a concern about this payslip
                </Button>
              )}
            </div>
          </div>
        </PayrollRecordDetail>
      )}
      <PayrollRequestPanel documents={documents} />
    </>
  )
}
