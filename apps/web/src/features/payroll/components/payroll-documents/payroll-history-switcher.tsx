"use client"

import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { payrollHistoryViews } from "../../model/payroll-documents"

/** Switches between payslips, approved runs and requests; hidden from Staff. */
export function PayrollHistorySwitcher({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const { activeTab, setActiveTab, setRefresh, staff } = documents
  if (staff) return null
  return (
    <ManagementViewToggle
      className="ml-auto max-[560px]:ml-0 max-[560px]:w-full"
      active={activeTab}
      ariaLabel="Payroll history sections"
      views={payrollHistoryViews}
      onChange={(tab) => {
        setActiveTab(tab)
        setRefresh((value) => value + 1)
      }}
    />
  )
}
