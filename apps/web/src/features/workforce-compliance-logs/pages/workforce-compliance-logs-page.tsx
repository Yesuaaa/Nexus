import { AuditLogsPage } from "@/features/audit-logs/pages/audit-logs-page"
import { getModuleLogsLabel } from "@/features/workspaces/model/module-registry"

const sourceLabels = {
  "time-logs": "Time Logs",
  policies: "Policies",
  corrections: "Corrections",
  overtime: "Overtime",
  leave: "Leave",
}

const actionLabels = {
  CREATED: "Created",
  UPDATED: "Updated",
  DELETED: "Deleted",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
}

export function WorkforceComplianceLogsPage() {
  return (
    <AuditLogsPage
      title={getModuleLogsLabel("attendance-monitoring")}
      description="Review recorded changes to time logs, policies, corrections, overtime, and leave."
      endpoint="/api/workforce-compliance-logs"
      sourceLabels={sourceLabels}
      operationActions={actionLabels}
      searchPlaceholder="Search names and IDs"
    />
  )
}
