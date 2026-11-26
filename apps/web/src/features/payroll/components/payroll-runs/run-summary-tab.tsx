"use client"

import { CircleAlert, RefreshCw } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import type { PayrollRun } from "../../api/payroll-runs-api"
import type { PayrollRunDetailsState } from "../../hooks/use-payroll-run-details"
import {
  calculationStatusLabel,
  formatMoney,
} from "../../model/payroll-run-view"

/** Calculated totals, recalculation and revision history. */
export function RunSummaryTab({
  details,
  data,
}: {
  details: PayrollRunDetailsState
  data: PayrollRun
}) {
  const {
    summary,
    statusTone,
    canRecalculate,
    setConfirmRecalculate,
    actionError,
    recalculate,
    pending,
    setSelectedCalculationId,
    items,
  } = details

  return (
    <>
      {summary ? (
        <>
          <SidePanelSection
            title="Known calculated amounts"
            action={
              <Pill tone={statusTone}>
                {calculationStatusLabel(summary.status)}
              </Pill>
            }
          >
            <Alert className="m-0 border-[#e3e8ef] bg-[#f8fafc] text-[#52627a]">
              Totals include only employees with complete calculations. Review
              and blocked results are excluded.
            </Alert>
            <DetailList>
              <DetailItem label="Known gross">
                {formatMoney(summary.grossTotal)}
              </DetailItem>
              <DetailItem label="Known deductions">
                {formatMoney(summary.deductionsTotal)}
              </DetailItem>
              <DetailItem label="Known net">
                {formatMoney(summary.netTotal)}
              </DetailItem>
              <DetailItem label="Fully calculated">
                {summary.calculatedItemCount}
              </DetailItem>
              <DetailItem label="Needs review">
                {summary.reviewItemCount}
              </DetailItem>
              <DetailItem label="Blocked">
                {summary.blockedItemCount}
              </DetailItem>
            </DetailList>
          </SidePanelSection>
          {canRecalculate && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmRecalculate(true)}
              >
                <RefreshCw size={14} aria-hidden="true" /> Recalculate
              </Button>
              {actionError && <Alert className="w-full">{actionError}</Alert>}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={CircleAlert}
          size="sm"
          title="This run has not been calculated"
          description="Create a draft calculation to inspect employee results and warnings."
          action={
            canRecalculate ? (
              <Button onClick={() => void recalculate()} disabled={pending}>
                {pending ? "Calculating…" : "Calculate draft"}
              </Button>
            ) : undefined
          }
        />
      )}
      {data.calculationHistory.length > 1 && (
        <SidePanelSection title="Calculation history">
          <div className="flex flex-wrap gap-2">
            {data.calculationHistory.map((calculation) => (
              <Button
                key={calculation.id}
                variant={calculation.id === summary?.id ? "brand" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCalculationId(calculation.id)
                  items.setPage(1)
                }}
              >
                Revision {calculation.revision}
              </Button>
            ))}
          </div>
        </SidePanelSection>
      )}
    </>
  )
}
