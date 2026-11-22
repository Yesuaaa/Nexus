import { AuditLogsPage } from "@/features/audit-logs/pages/audit-logs-page"
import { getModuleLogsLabel } from "@/features/workspaces/model/module-registry"

const sourceLabels = {
  EMPLOYEE_MANAGEMENT: "Employee Management",
  DEPARTMENT_MANAGEMENT: "Department Management",
  TEAM_MANAGEMENT: "Team Management",
}

const actionLabels = {
  CREATED: "Created",
  PROFILE_UPDATED: "Profile updated",
  STATUS_CHANGED: "Status or sessions changed",
  ASSIGNMENT_CHANGED: "Assignment changed",
  HEAD_CHANGED: "Department Head changed",
  TEMPORARY_HEAD_CHANGED: "Temporary Head changed",
  LEAD_CHANGED: "Team Lead changed",
  TITLE_CLEARED: "Former Head title cleared",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
}

export function PeopleHrLogsPage() {
  return (
    <AuditLogsPage
      title={getModuleLogsLabel("people-hr")}
      description="Review recorded changes to employees, Staff logins, departments, and teams."
      endpoint="/api/people-hr-logs"
      sourceLabels={sourceLabels}
      operationActions={actionLabels}
      searchPlaceholder="Search names and IDs"
    />
  )
}
