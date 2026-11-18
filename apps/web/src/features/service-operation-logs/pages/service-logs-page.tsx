"use client"

import { AuditLogsPage } from "@/features/audit-logs/pages/audit-logs-page"
import { getModuleLogsLabel } from "@/features/workspaces/model/module-registry"

const sources = {
  catalog: "Service catalog",
  requests: "Requests",
  workflow: "Workflow",
  workload: "Workload",
}

export function ServiceLogsPage() {
  return (
    <AuditLogsPage
      title={getModuleLogsLabel("service-operations")}
      endpoint="/api/service-operation-logs"
      sourceLabels={sources}
      searchPlaceholder="Search message, person, request or trace"
      linkToRecord={({ requestId }) =>
        requestId
          ? {
              href: `/module/service-operations?request=${encodeURIComponent(requestId)}`,
              label: "View service request",
            }
          : undefined
      }
    />
  )
}
