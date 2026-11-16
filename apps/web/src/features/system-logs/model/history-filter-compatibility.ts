import {
  attendanceSubjectTypes,
  historyActions,
  historyModuleCoverage,
  projectActions,
  serviceActions,
  type HistoryFilters,
} from "./management-history.ts"

// Advisory counterpart of parseManagementQuery's source/event compatibility.
// It never authorizes a read or replaces the server's query validation.
const accountActions = historyActions.filter((action) =>
  [
    "CREATED",
    "PROFILE_UPDATED",
    "ROLE_CHANGED",
    "STATUS_CHANGED",
    "PASSWORD_RESET",
    "ARCHIVED",
    "RESTORED",
    "DELETED",
  ].includes(action),
)
const workforceActions = historyActions.filter((action) =>
  [
    "CREATED",
    "PROFILE_UPDATED",
    "STATUS_CHANGED",
    "ASSIGNMENT_CHANGED",
    "HEAD_CHANGED",
    "TEMPORARY_HEAD_CHANGED",
    "LEAD_CHANGED",
    "TITLE_CLEARED",
    "DELETED",
  ].includes(action),
)
const sources = [
  {
    source: "audit.account-management",
    modules: ["administration", "people-hr", "service-operations"],
    subjects: ["account"],
    actions: accountActions,
    operation: true,
  },
  {
    source: "audit.workforce-management",
    modules: ["administration", "people-hr"],
    subjects: ["employee", "department", "team"],
    actions: workforceActions,
    operation: true,
  },
  {
    source: "audit.attendance",
    modules: ["attendance-monitoring"],
    subjects: attendanceSubjectTypes,
    actions: ["INSERT", "UPDATE", "DELETE"],
    operation: false,
  },
  {
    source: "audit.workflow",
    modules: ["project-management"],
    subjects: ["project"],
    actions: projectActions,
    operation: false,
  },
  {
    source: "audit.workflow",
    modules: ["service-operations"],
    subjects: ["service_request"],
    actions: serviceActions,
    operation: false,
  },
]
function supported(subject: string, action: string) {
  switch (subject) {
    case "employee":
      return ![
        "HEAD_CHANGED",
        "TEMPORARY_HEAD_CHANGED",
        "LEAD_CHANGED",
        "DELETED",
      ].includes(action)
    case "department":
      return !["STATUS_CHANGED", "LEAD_CHANGED"].includes(action)
    case "team":
      return ["CREATED", "PROFILE_UPDATED", "LEAD_CHANGED", "DELETED"].includes(
        action,
      )
    case "attendance_workday":
      return action !== "DELETE"
    default:
      return true
  }
}
function compatible(filters: HistoryFilters) {
  return sources.some(
    (source) =>
      (!filters.source.trim() || filters.source.trim() === source.source) &&
      (!filters.moduleId || source.modules.includes(filters.moduleId)) &&
      (!filters.operationId.trim() || source.operation) &&
      source.subjects.some(
        (subject) =>
          (!filters.subjectType.trim() ||
            filters.subjectType.trim() === subject) &&
          source.actions.some(
            (action) =>
              supported(subject, action) &&
              (!filters.action.trim() || filters.action.trim() === action) &&
              (!filters.eventName.trim() ||
                filters.eventName.trim() ===
                  `${subject}.${action.toLowerCase()}`),
          ),
      ),
  )
}

export const compatibilityFilterLabels = {
  source: "Source",
  action: "Action",
  subjectType: "Subject type",
  operationId: "Operation ID",
  eventName: "Event search",
} as const
export type CompatibilityFilter = keyof typeof compatibilityFilterLabels

/** Smallest explicit correction; ties preserve the more specific event search.
 * Dates and opaque actor/subject identifiers never participate in scope conflicts.
 */
export function incompatibleHistoryFilters(
  filters: HistoryFilters,
): CompatibilityFilter[] {
  if (!historyModuleCoverage(filters.moduleId).readable || compatible(filters))
    return []
  const fields = (
    Object.keys(compatibilityFilterLabels) as CompatibilityFilter[]
  ).filter((field) => filters[field].trim())
  let correction = fields
  for (let mask = 1; mask < 2 ** fields.length; mask++) {
    const removed = fields.filter((_, index) => mask & (1 << index))
    if (removed.length >= correction.length) continue
    if (compatible(clearIncompatibleHistoryFilters(filters, removed)))
      correction = removed
  }
  return correction
}

export function clearIncompatibleHistoryFilters(
  filters: HistoryFilters,
  fields: CompatibilityFilter[],
): HistoryFilters {
  const next = { ...filters }
  for (const field of fields) next[field] = ""
  return next
}
