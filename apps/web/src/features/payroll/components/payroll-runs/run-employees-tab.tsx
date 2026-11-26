"use client"

import { ChevronRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import {
  DataTableEmptyRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { SearchField } from "@/components/ui/search-field"
import { SidePanelButton, SidePanelSection } from "@/components/ui/side-panel"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import type { PayrollRunDetailsState } from "../../hooks/use-payroll-run-details"
import { PayrollItemBreakdown } from "./payroll-item-breakdown"
import {
  itemNetColumn,
  itemGrossColumn,
  approvalAmountCell,
  formatMoney,
  itemStatusTone,
  itemStatusLabel,
} from "../../model/payroll-run-view"

/** Employee calculations and the selected employee breakdown. */
export function RunEmployeesTab({
  details,
}: {
  details: PayrollRunDetailsState
}) {
  const {
    selectedItem,
    setSelectedItem,
    breakdownRef,
    summary,
    itemSearch,
    setItemSearch,
    items,
    approvals,
    employeeColumns,
    employeeColumnCount,
    returnToRunRef,
    runBodyRef,
  } = details

  return (
    <>
      {selectedItem && (
        <>
          <div>
            <SidePanelButton
              variant="secondary"
              onClick={() => setSelectedItem(null)}
            >
              Back to employees
            </SidePanelButton>
          </div>
          <div
            ref={breakdownRef}
            tabIndex={-1}
            role="group"
            aria-label={`${selectedItem.employeeName} calculation breakdown`}
          >
            <PayrollItemBreakdown item={selectedItem} />
          </div>
        </>
      )}
      {summary && (
        <SidePanelSection
          title="Employee calculations"
          className={selectedItem ? "hidden" : undefined}
          action={
            <span className="text-[10px] text-[#738096]">
              Revision {summary.revision}
            </span>
          }
        >
          <SearchField
            label="Search employees in this run"
            value={itemSearch}
            maxLength={100}
            onChange={(event) => {
              setItemSearch(event.target.value)
              items.setPage(1)
              setSelectedItem(null)
            }}
            placeholder="Search employee…"
            containerClassName="w-full"
          />
          <ResponsiveDataTable
            label="Employee payroll calculations"
            aria-busy={items.loading}
            className={approvals ? "overflow-x-auto" : undefined}
          >
            <ResponsiveDataTableHeader rowClassName={employeeColumns}>
              <ResponsiveDataTableColumnHeader>
                Employee
              </ResponsiveDataTableColumnHeader>
              {approvals ? (
                <>
                  <ResponsiveDataTableColumnHeader className="text-right">
                    Gross Pay
                  </ResponsiveDataTableColumnHeader>
                  <ResponsiveDataTableColumnHeader className="text-right">
                    Deductions
                  </ResponsiveDataTableColumnHeader>
                  <ResponsiveDataTableColumnHeader className="text-right">
                    Net Pay
                  </ResponsiveDataTableColumnHeader>
                  <ResponsiveDataTableColumnHeader className="text-center">
                    Status
                  </ResponsiveDataTableColumnHeader>
                </>
              ) : (
                <>
                  <ResponsiveDataTableColumnHeader>
                    Result
                  </ResponsiveDataTableColumnHeader>
                  <ResponsiveDataTableColumnHeader
                    className={`text-right ${itemNetColumn}`}
                  >
                    Known net
                  </ResponsiveDataTableColumnHeader>
                  <ResponsiveDataTableColumnHeader
                    className={`text-right ${itemGrossColumn}`}
                  >
                    Gross
                  </ResponsiveDataTableColumnHeader>
                </>
              )}
              <ResponsiveDataTableColumnHeader
                className={approvals ? "text-center" : undefined}
              >
                {approvals ? (
                  "Details"
                ) : (
                  <span className="sr-only">Open calculation</span>
                )}
              </ResponsiveDataTableColumnHeader>
            </ResponsiveDataTableHeader>
            <ResponsiveDataTableBody>
              {items.error ? (
                <ResponsiveDataTableRow>
                  <ResponsiveDataTableCell
                    aria-colspan={employeeColumnCount}
                    className="p-4 text-xs text-[#a02d42]"
                  >
                    <span role="alert">{items.error}</span>
                  </ResponsiveDataTableCell>
                </ResponsiveDataTableRow>
              ) : items.loading ? (
                <DataTableSkeletonRows
                  label="employee results"
                  rows={3}
                  rowClassName={`${employeeColumns} min-h-[48px] py-2`}
                  cellClassNames={
                    approvals
                      ? [
                          "",
                          "text-right",
                          "text-right",
                          "text-right",
                          "text-center",
                          "text-center",
                        ]
                      : ["", "", itemNetColumn, itemGrossColumn, ""]
                  }
                />
              ) : items.rows.length === 0 ? (
                <DataTableEmptyRow colSpan={employeeColumnCount}>
                  No employee results in this calculation revision.
                </DataTableEmptyRow>
              ) : (
                items.rows.map((item) => (
                  <ResponsiveDataTableRow
                    key={item.id}
                    className={`${employeeColumns} min-h-[48px] border-b border-[#eceef1] py-2 text-[11px] last:border-0`}
                  >
                    <ResponsiveDataTableCell className="min-w-0">
                      <span
                        className={
                          approvals
                            ? "block font-semibold [overflow-wrap:anywhere]"
                            : "block truncate font-semibold"
                        }
                      >
                        {item.employeeName}
                      </span>
                      <span
                        className={
                          approvals
                            ? "mt-0.5 block text-[10px] text-[#738096] [overflow-wrap:anywhere]"
                            : "mt-0.5 block text-[10px] text-[#738096]"
                        }
                      >
                        {item.employeeNumber}
                      </span>
                    </ResponsiveDataTableCell>
                    {approvals ? (
                      <>
                        <ResponsiveDataTableCell className={approvalAmountCell}>
                          {formatMoney(item.grossAmount)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className={approvalAmountCell}>
                          {formatMoney(item.deductionsAmount)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className={approvalAmountCell}>
                          {formatMoney(item.netAmount)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className="text-center">
                          <Pill tone={itemStatusTone(item.status)}>
                            {itemStatusLabel(item.status)}
                          </Pill>
                        </ResponsiveDataTableCell>
                      </>
                    ) : (
                      <>
                        <ResponsiveDataTableCell>
                          <Pill tone={itemStatusTone(item.status)}>
                            {itemStatusLabel(item.status)}
                          </Pill>
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell
                          className={`text-right tabular-nums ${itemNetColumn}`}
                        >
                          {formatMoney(item.netAmount)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell
                          className={`text-right tabular-nums ${itemGrossColumn}`}
                        >
                          {formatMoney(item.grossAmount)}
                        </ResponsiveDataTableCell>
                      </>
                    )}
                    <ResponsiveDataTableCell
                      className={approvals ? "flex justify-center" : undefined}
                    >
                      <Button
                        type="button"
                        variant="rowAction"
                        size={null}
                        aria-label={
                          approvals
                            ? `View employee calculation details for ${item.employeeName}`
                            : `View ${item.employeeName} calculation`
                        }
                        onClick={(event) => {
                          returnToRunRef.current = {
                            button: event.currentTarget,
                            scrollTop: runBodyRef.current?.scrollTop ?? 0,
                          }
                          setSelectedItem(item)
                        }}
                      >
                        {approvals ? (
                          <>
                            <Eye size={15} aria-hidden="true" />
                            <HoverTooltip>
                              View employee calculation details
                            </HoverTooltip>
                          </>
                        ) : (
                          <ChevronRight size={15} aria-hidden="true" />
                        )}
                      </Button>
                    </ResponsiveDataTableCell>
                  </ResponsiveDataTableRow>
                ))
              )}
            </ResponsiveDataTableBody>
          </ResponsiveDataTable>
          {items.footer && (
            <TablePaginationFooter
              {...items.footer}
              label="Employee calculation pages"
              itemLabel="employees"
              onPageChange={items.setPage}
            />
          )}
        </SidePanelSection>
      )}
    </>
  )
}
