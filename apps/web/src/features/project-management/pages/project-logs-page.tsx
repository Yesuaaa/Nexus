import { AuditLogsPage } from "@/features/audit-logs/pages/audit-logs-page"
import { getModuleLogsLabel } from "@/features/workspaces/model/module-registry"

const sources = {
  workspace: "Workspaces",
  planning: "Plans and milestones",
  deliverables: "Deliverables",
  client: "Client activity",
}

export function ProjectLogsPage() {
  return (
    <AuditLogsPage
      title={getModuleLogsLabel("project-management")}
      endpoint="/api/project-management-logs"
      sourceLabels={sources}
      searchPlaceholder="Search project, activity, person or trace"
    />
  )
}
