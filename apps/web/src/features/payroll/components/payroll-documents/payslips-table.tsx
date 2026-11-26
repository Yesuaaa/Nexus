"use client"

import { Eye } from "lucide-react"
import {
  ResponsiveDataTableCell,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { SearchField } from "@/components/ui/search-field"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatPayrollMoney } from "../../model/money"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { PayrollPageSection, RecordTable, Pages } from "./record-layout"
import { PayrollHistorySwitcher } from "./payroll-history-switcher"
import {
  staffPayslipGrid,
  staffTableRow,
  money,
  timestamp,
} from "../../model/payroll-documents"

/** Payslips, for payroll managers or the signed-in Staff member. */
export function PayslipsTable({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    staff,
    search,
    setSearch,
    setSlipPage,
    publication,
    setPublication,
    slips,
    payslipSearchPending,
    setSlip,
    download,
  } = documents
  const RecordRow = staff ? ResponsiveDataTableRow : TableRow
  const RecordCell = staff ? ResponsiveDataTableCell : TableCell
  return (
    <PayrollPageSection
      title={staff ? "My payslips" : "Payslips"}
      staff={staff}
    >
      <div className={staff ? "grid min-w-0 gap-2" : "min-w-0"}>
        {!staff && (
          <div className={`${filterBarClass} pb-4`}>
            <SearchField
              label="Search payslips"
              value={search}
              onChange={(value) => {
                setSearch(value.target.value)
                setSlipPage(1)
              }}
              placeholder="Search employee, period or reference…"
            />
            <FilterSelect
              fitOptions
              label="Publication status"
              triggerClassName="w-[160px]"
              value={publication}
              onChange={(value) => {
                setPublication(value)
                setSlipPage(1)
              }}
              options={[
                { value: "", label: "All payslips" },
                { value: "generated", label: "Unpublished" },
                { value: "published", label: "Published" },
              ]}
            />
            <PayrollHistorySwitcher documents={documents} />
          </div>
        )}
        {!staff && slips.error && <Alert className="mb-3">{slips.error}</Alert>}
        <RecordTable
          headings={[
            "Payroll period",
            ...(!staff ? ["Employee", "Revision"] : []),
            "Reference",
            "Net pay",
            "Publication",
            staff ? "Actions" : "Details",
          ]}
          alignments={{
            Revision: "right",
            "Net pay": "right",
            Actions: "center",
            Details: "center",
          }}
          columnClassNames={
            staff
              ? undefined
              : {
                  "Payroll period": "w-[15%]",
                  Employee: "w-[21%]",
                  Revision: "w-[9%]",
                  Reference: "w-[18%]",
                  "Net pay": "w-[13%]",
                  Publication: "w-[16%]",
                  Details: "w-20",
                }
          }
          tableClassName={staff ? undefined : "table-fixed min-w-[680px]"}
          responsive={
            staff
              ? {
                  label: "My payslips",
                  grid: staffPayslipGrid,
                  emptyMessage: "No payslips available.",
                  error: slips.error,
                  retry: slips.retry,
                }
              : undefined
          }
          emptyMessage={"No payslips available."}
          loading={slips.loading || payslipSearchPending}
          empty={!slips.error && !slips.data?.rows.length}
        >
          {slips.data?.rows.map((row) => (
            <RecordRow
              key={row.id}
              className={
                staff ? staffPayslipGrid + " " + staffTableRow : undefined
              }
            >
              <RecordCell>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Payroll period
                  </span>
                )}
                {row.period.cutoffLabel}
              </RecordCell>
              {!staff && (
                <>
                  <RecordCell>
                    <span
                      className="block truncate font-medium"
                      title={row.employeeName}
                    >
                      {row.employeeName}
                    </span>
                    <span
                      className="block truncate text-muted-foreground"
                      title={row.employeeNumber}
                    >
                      {row.employeeNumber}
                    </span>
                  </RecordCell>
                  <RecordCell className="text-right tabular-nums">
                    {row.revision}
                  </RecordCell>
                </>
              )}
              <RecordCell className={staff ? "break-all" : undefined}>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Reference
                  </span>
                )}
                {staff ? (
                  row.reference
                ) : (
                  <span className="block truncate" title={row.reference}>
                    {row.reference}
                  </span>
                )}
              </RecordCell>
              <RecordCell
                className={staff ? undefined : "text-right tabular-nums"}
              >
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Net pay
                  </span>
                )}
                {staff ? money(row, row.net) : formatPayrollMoney(row.net)}
              </RecordCell>
              <RecordCell>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Publication
                  </span>
                )}
                {!staff ? (
                  <div className="grid justify-items-start gap-1">
                    <Pill tone={row.publishedAt ? "success" : "info"}>
                      {row.publishedAt ? "Published" : "Generated"}
                    </Pill>
                    {row.publishedAt && (
                      <span className="text-muted-foreground">
                        {timestamp(row.publishedAt)}
                      </span>
                    )}
                  </div>
                ) : row.publishedAt ? (
                  timestamp(row.publishedAt)
                ) : (
                  <Pill tone="neutral">Generated</Pill>
                )}
              </RecordCell>
              <RecordCell
                className={
                  staff ? "flex flex-wrap items-center gap-2" : "text-center"
                }
              >
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Actions
                  </span>
                )}
                {staff ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSlip(row)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void download(row)}
                    >
                      Download PDF
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="rowAction"
                      size={null}
                      aria-label={`View payslip for ${row.employeeName}, ${row.period.cutoffLabel}, revision ${row.revision}`}
                      onClick={() => setSlip(row)}
                    >
                      <Eye size={14} aria-hidden="true" />
                      <HoverTooltip>View payslip details</HoverTooltip>
                    </Button>
                  </div>
                )}
              </RecordCell>
            </RecordRow>
          ))}
        </RecordTable>
        <Pages
          result={
            slips.loading ||
            payslipSearchPending ||
            slips.error ||
            (staff && !slips.data?.total)
              ? null
              : slips.data
          }
          label="Payslip pages"
          onPageChange={setSlipPage}
        />
      </div>
    </PayrollPageSection>
  )
}
