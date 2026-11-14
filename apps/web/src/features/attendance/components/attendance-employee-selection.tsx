"use client"

import type { ReactNode } from "react"
import { panelMuted } from "@/components/ui/panel-styles"
import { SidePanelSection } from "@/components/ui/side-panel"
import { EmployeeSelection } from "@/features/employees/components/employee-selection"
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendancePolicyEmployees } from "../api/attendance-api"
import { ResourceStatus } from "./attendance-shared"

export function AttendanceEmployeeSelection({
  selectedIds,
  onChange,
  disabled,
  searchAction,
  beforeList,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled: boolean
  searchAction?: ReactNode
  beforeList?: ReactNode
}) {
  const employees = useAsyncResource(attendancePolicyEmployees, [], {
    fallbackError: "Couldn't load employees.",
  })

  if (employees.loading || employees.error)
    return (
      <ResourceStatus
        loading={employees.loading}
        error={employees.error}
        retry={employees.retry}
      />
    )

  return (
    <SidePanelSection
      title="Employee selection"
      action={
        <span className={panelMuted} role="status">
          {selectedIds.length} selected
        </span>
      }
    >
      <EmployeeSelection
        employees={employees.data ?? []}
        selectedIds={selectedIds}
        onChange={onChange}
        title="Employee selection"
        searchLabel="Search attendance employees"
        searchPlaceholder="Search employee name or ID"
        listLabel="Available employees"
        emptyMessage="No employees are available."
        noMatchesMessage="No employees match your search."
        hideHeader
        beforeList={beforeList}
        searchAction={searchAction}
        disabled={disabled}
      />
    </SidePanelSection>
  )
}
