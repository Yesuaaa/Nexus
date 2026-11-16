/** Project-ID semantics verified at both existing WorkflowEvent writers. */
export const projectSource = "audit.workflow" as const
export const projectActions = [
  "PROJECT_MILESTONE_UPDATED",
  "STAFFING_ALLOCATED",
] as const
export const projectEventNames = projectActions.map(
  (type) => `project.${type.toLowerCase()}`,
)
