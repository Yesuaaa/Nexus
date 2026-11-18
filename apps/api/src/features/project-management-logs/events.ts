const workspace = "Workspace"
const task = "Task"
const deliverable = "Deliverable"
const changeRequest = "Change request"
const cancellationRequest = "Cancellation request"

export const projectLogEvents = {
  WORKSPACE_CREATED: ["workspace", workspace, "Set up the workspace"],
  WORKSPACE_RENAMED: ["workspace", workspace, "Renamed the workspace"],
  WORKSPACE_CANCELLED: ["workspace", workspace, "Cancelled the workspace"],
  WORKSPACE_ON_HOLD: ["workspace", workspace, "Put the workspace on hold"],
  WORKSPACE_RESUMED: ["workspace", workspace, "Resumed the workspace"],
  WORKSPACE_COMPLETED: ["workspace", workspace, "Completed the workspace"],
  TEAM_LEAD_CHANGED: [
    "workspace",
    "Project team member",
    "Changed project team leadership",
  ],
  PLAN_UPDATED: ["planning", "Work plan", "Updated the work plan"],
  TASK_ADDED: ["planning", task, "Added a task"],
  TASK_STATUS_CHANGED: ["planning", task, "Changed task status"],
  MILESTONE_COMPLETION_CHANGED: [
    "planning",
    "Milestone",
    "Changed milestone completion",
  ],
  DELIVERABLE_UPDATED: [
    "deliverables",
    deliverable,
    "Updated deliverable details",
  ],
  ATTACHMENT_ADDED: [
    "deliverables",
    deliverable,
    "Submitted a deliverable attachment",
  ],
  ATTACHMENT_REPLACED: [
    "deliverables",
    deliverable,
    "Replaced a deliverable attachment",
  ],
  ATTACHMENT_REMOVED: [
    "deliverables",
    deliverable,
    "Removed a deliverable attachment",
  ],
  DELIVERABLE_APPROVED: [
    "deliverables",
    deliverable,
    "Approved a deliverable for release",
  ],
  DELIVERABLE_REJECTED: ["deliverables", deliverable, "Rejected a deliverable"],
  DELIVERABLE_SHARED: [
    "deliverables",
    deliverable,
    "Shared a deliverable with the client",
  ],
  DELIVERABLE_CLIENT_REVIEWED: [
    "client",
    deliverable,
    "Recorded the client's deliverable review",
  ],
  CLIENT_BRIEF_UPDATED: [
    "client",
    "Project brief",
    "Updated the project brief",
  ],
  CHANGE_REQUEST_SUBMITTED: [
    "client",
    changeRequest,
    "Submitted a project change request",
  ],
  CHANGE_REQUEST_REVIEWED: [
    "client",
    changeRequest,
    "Decided a project change request",
  ],
  CANCELLATION_REQUEST_SUBMITTED: [
    "client",
    cancellationRequest,
    "Submitted a project cancellation request",
  ],
  CANCELLATION_REQUEST_REVIEWED: [
    "client",
    cancellationRequest,
    "Decided a project cancellation request",
  ],
} as const

export type ProjectLogEvent = keyof typeof projectLogEvents
export function isProjectLogEvent(event: string): event is ProjectLogEvent {
  return Object.hasOwn(projectLogEvents, event)
}

const statuses: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NOT_STARTED: "Not started",
  DONE: "Done",
  NOT_SUBMITTED: "Not submitted",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT_TO_CLIENT: "Sent to client",
  REVISION_REQUESTED: "Revision requested",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  NOT_APPROVED: "Not approved",
}
export function projectAuditStatus(value: string): string {
  if (!Object.hasOwn(statuses, value))
    throw new Error("Unknown project audit status")
  return statuses[value]
}

const changeFields = {
  Name: "label",
  Status: "status",
  "Project status": "status",
  "Client decision": "status",
  "Workspace configured": "boolean",
  "Workspace structure": "structure",
  "Team lead": "boolean",
  "Phase count": "count",
  "Task count": "count",
  "Phases edited": "count",
  "Tasks edited": "count",
  Completed: "boolean",
  "Attachment present": "boolean",
  "Attachment type": "mime",
  "Description edited": "boolean",
  "Expected file type edited": "boolean",
  "Brief edited": "boolean",
  "Pending changes declined": "count",
} as const
type Field = keyof typeof changeFields
type Value = string | number | boolean | null
export type ProjectLogChanges = Partial<Record<Field, readonly [Value, Value]>>

export function auditLabel(value: string | null | undefined, max = 160) {
  return (
    value
      ?.replace(/\p{Cc}/gu, " ")
      .trim()
      .slice(0, max)
      .trimEnd() || null
  )
}

function isChangeValue(field: Field, value: unknown): value is Value {
  if (value === null) return true
  switch (changeFields[field]) {
    case "boolean":
      return typeof value === "boolean"
    case "count":
      return (
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      )
    case "label":
      return typeof value === "string" && auditLabel(value) === value
    case "status":
      return (
        typeof value === "string" && Object.values(statuses).includes(value)
      )
    case "structure":
      return value === "Separate" || value === "Multi-workstream"
    case "mime":
      return (
        typeof value === "string" &&
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/png",
          "image/jpeg",
          "text/plain",
        ].includes(value)
      )
  }
}

export function readProjectLogChanges(input: unknown) {
  if (!Array.isArray(input)) return []
  return input.slice(0, 16).flatMap((change: unknown) => {
    if (
      !change ||
      typeof change !== "object" ||
      !("field" in change) ||
      typeof change.field !== "string" ||
      !Object.hasOwn(changeFields, change.field) ||
      !("before" in change) ||
      !("after" in change)
    )
      return []
    const field = change.field as Field
    const { before, after } = change
    return isChangeValue(field, before) && isChangeValue(field, after)
      ? [{ field, before, after }]
      : []
  })
}

export function encodeProjectLogChanges(changes: ProjectLogChanges) {
  return readProjectLogChanges(
    Object.entries(changes)
      .filter(([, [before, after]]) => before !== after)
      .map(([field, [before, after]]) => ({ field, before, after })),
  )
}
