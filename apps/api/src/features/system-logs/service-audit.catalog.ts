import { projectActions } from "./project-audit.catalog.js"

/** Event provenance verified in workflow.service.ts; subject is the stored requestId. */
export const serviceActions = [
  "CONSULTATION_SCHEDULED",
  "CONSULTATION_COMPLETED",
  "CONSULTATION_CANCELLED",
  "QUOTATION_SENT",
  "APPROVAL_CONFIRMED",
  "WORKFLOW_CANCELLED",
] as const
export const serviceEventNames = serviceActions.map(
  (type) => `service_request.${type.toLowerCase()}`,
)
/** Keep action/subject/module compatibility paired, never a cross-product. */
export function workflowTypes(filters: {
  moduleId?: string
  subjectType?: string
  action?: string
  eventName?: string
}) {
  return [
    ...projectActions.map((type) => ({
      type,
      moduleId: "project-management",
      subjectType: "project",
    })),
    ...serviceActions.map((type) => ({
      type,
      moduleId: "service-operations",
      subjectType: "service_request",
    })),
  ]
    .filter(
      (row) =>
        (!filters.moduleId || row.moduleId === filters.moduleId) &&
        (!filters.subjectType || row.subjectType === filters.subjectType) &&
        (!filters.action || row.type === filters.action) &&
        (!filters.eventName ||
          `${row.subjectType}.${row.type.toLowerCase()}` === filters.eventName),
    )
    .map((row) => row.type)
}
