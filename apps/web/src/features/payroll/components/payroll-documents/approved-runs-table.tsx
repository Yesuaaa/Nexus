"use client"

import { Eye } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { filterBarClass } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { SearchField } from "@/components/ui/search-field"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatPayrollMoney } from "../../model/money"
import { formatPayrollDate } from "../../model/period-format"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { PayrollHistorySwitcher } from "./payroll-history-switcher"
import { RecordTable, Pages } from "./record-layout"
import {
  payslipStatusTone,
  payslipStatusLabel,
} from "../../model/payroll-documents"

/** Approved payroll runs and their payslip status. */
export function ApprovedRunsTable({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    runSearch,
    setRunSearch,
    setRunPage,
    runs,
    runSearchPending,
    setSelectedRunId,
    setConfirm,
  } = documents

  return (
    <section aria-label="Approved runs" className="min-w-0">
      <div className={`${filterBarClass} pb-4`}>
        <SearchField
          label="Search approved runs"
          value={runSearch}
          onChange={(value) => {
            setRunSearch(value.target.value)
            setRunPage(1)
          }}
          placeholder="Search payroll period…"
        />
        <PayrollHistorySwitcher documents={documents} />
      </div>
      {runs.error && <Alert className="mb-3">{runs.error}</Alert>}
      <RecordTable
        headings={[
          "Payroll Period",
          "Revision",
          "Employees",
          "Net Pay",
          "Payslip Status",
          "Details",
        ]}
        alignments={{
          Revision: "center",
          Employees: "center",
          "Net Pay": "center",
          Details: "center",
        }}
        columnClassNames={{
          "Payroll Period": "w-[24%]",
          Revision: "w-[12%]",
          Employees: "w-[13%]",
          "Net Pay": "w-[21%]",
          "Payslip Status": "w-[20%]",
          Details: "w-[10%]",
        }}
        tableClassName="min-w-[720px] table-fixed [&_th]:px-3 [&_tbody_td]:px-3"
        loading={runs.loading || runSearchPending}
        empty={!runs.error && !runs.data?.rows.length}
      >
        {runs.data?.rows.map((run) => {
          const approvedCalculation = run.calculationHistory.find(
            (calculation) =>
              calculation.approvalEvents?.some(
                (event) => event.action === "PAYROLL_APPROVED",
              ),
          )
          const netPay = formatPayrollMoney(approvedCalculation?.netTotal)
          return (
            <TableRow key={run.id}>
              <TableCell className="min-w-0 align-middle [overflow-wrap:anywhere]">
                <span className="block font-medium">
                  {run.period.cutoffLabel}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[#738096]">
                  {formatPayrollDate(run.period.startDate)} –{" "}
                  {formatPayrollDate(run.period.endDate)}
                </span>
              </TableCell>
              <TableCell className="min-w-0 text-center tabular-nums align-middle">
                {approvedCalculation?.revision ?? "Unavailable"}
              </TableCell>
              <TableCell className="min-w-0 text-center tabular-nums align-middle">
                {run.latestCalculation?.payslipEmployeeCount ??
                  (run.latestCalculation
                    ? run.latestCalculation.calculatedItemCount +
                      run.latestCalculation.reviewItemCount +
                      run.latestCalculation.blockedItemCount
                    : 0)}
              </TableCell>
              <TableCell className="min-w-0 whitespace-nowrap text-center tabular-nums align-middle">
                {netPay === "—" ? "Unavailable" : netPay}
              </TableCell>
              <TableCell className="min-w-0 align-middle">
                {(() => {
                  const status =
                    run.latestCalculation?.payslipStatus ?? "NOT_GENERATED"
                  return (
                    <Pill tone={payslipStatusTone(status)}>
                      {payslipStatusLabel(status)}
                    </Pill>
                  )
                })()}
              </TableCell>
              <TableCell className="min-w-0 text-center align-middle">
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="rowAction"
                    size={null}
                    aria-label={`View approved run details for ${run.period.cutoffLabel}`}
                    onClick={() => {
                      setSelectedRunId(run.id)
                      setConfirm(null)
                    }}
                  >
                    <Eye size={14} aria-hidden="true" />
                    <HoverTooltip>View approved run details</HoverTooltip>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </RecordTable>
      <Pages
        result={
          runs.loading || runSearchPending || runs.error ? null : runs.data
        }
        label="Approved run pages"
        onPageChange={setRunPage}
      />
    </section>
  )
}
