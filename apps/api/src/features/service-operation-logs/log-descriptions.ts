import { serviceLogEvents, type ServiceLogEvent } from "./log-writer.js"

const eventDescriptions: Record<
  Exclude<ServiceLogEvent, "WORKFLOW_ACTION_COMPLETED">,
  string
> = {
  SERVICE_CREATED: "Created a service offering.",
  SERVICE_UPDATED: "Updated a service offering.",
  SERVICE_STATUS_CHANGED: "Changed a service offering's availability.",
  SERVICE_DELETED: "Deleted a service offering.",
  PRICING_UPDATED: "Updated service pricing.",
  PRICING_DELETED: "Deleted service pricing.",
  REQUEST_SUBMITTED: "Submitted a service request.",
  REQUEST_ACCEPTED: "Accepted a service request for department review.",
  REQUEST_CANCELLED: "Cancelled a service request.",
  REQUEST_CONCLUDED: "Concluded a completed service request.",
  FILE_UPLOADED: "Uploaded a file to the service-request workflow.",
  CAPACITY_UPDATED: "Updated department workload capacity.",
  STAFF_ALLOCATED: "Allocated a staff member to a service request.",
  STAFF_REMOVED: "Removed a staff allocation from a service request.",
}

export const workflowActionDescriptions = {
  RESPOND_CONSULTATION_RESCHEDULE:
    "Responded to a consultation reschedule request.",
  REQUEST_CONSULTATION_RESCHEDULE: "Requested a new consultation schedule.",
  REQUEST_REQUIREMENT: "Requested an additional service requirement.",
  SUBMIT_REQUIREMENT: "Submitted a requested service requirement.",
  REVIEW_REQUIREMENT: "Reviewed a submitted service requirement.",
  SCHEDULE_CONSULTATION: "Scheduled a service consultation.",
  COMPLETE_CONSULTATION: "Marked a service consultation as completed.",
  CANCEL_CONSULTATION: "Cancelled a service consultation.",
  PREPARE_QUOTATION: "Started preparing a service quotation.",
  FIXED_QUOTATION: "Updated a service quotation after revision.",
  ACTIVATE_PROJECT: "Activated the project for a service request.",
  CREATE_QUOTATION: "Created a service quotation.",
  APPROVE_QUOTATION: "Recorded an internal quotation approval.",
  RESPOND_QUOTATION: "Recorded the client's quotation response.",
  ATTACH_AGREEMENT: "Attached an agreement to the service workflow.",
  SIGN_AGREEMENT: "Recorded an agreement signature.",
  REVIEW_AGREEMENT: "Reviewed the signed agreement.",
  VERIFY_PAYMENT: "Verified a submitted payment.",
  SUBMIT_PAYMENT: "Submitted payment information for verification.",
  COMPLETE_SANDBOX_PAYMENT: "Completed a sandbox payment step.",
  ASSIGN_APPROVERS: "Assigned workflow reviewers.",
  STAFF_PROJECT: "Updated project staffing for the service request.",
  HOLD: "Placed the service workflow on hold.",
  RESUME: "Resumed the service workflow.",
  CANCEL: "Cancelled the service workflow.",
  INTERNAL_NOTE: "Added an internal workflow note.",
} as const

export const workflowActionFailureOperations: Record<
  keyof typeof workflowActionDescriptions,
  string
> = {
  RESPOND_CONSULTATION_RESCHEDULE:
    "responding to a consultation reschedule request",
  REQUEST_CONSULTATION_RESCHEDULE: "requesting a new consultation schedule",
  REQUEST_REQUIREMENT: "requesting an additional service requirement",
  SUBMIT_REQUIREMENT: "submitting a requested service requirement",
  REVIEW_REQUIREMENT: "reviewing a submitted service requirement",
  SCHEDULE_CONSULTATION: "scheduling a service consultation",
  COMPLETE_CONSULTATION: "completing a service consultation",
  CANCEL_CONSULTATION: "cancelling a service consultation",
  PREPARE_QUOTATION: "preparing a service quotation",
  FIXED_QUOTATION: "updating a service quotation after revision",
  ACTIVATE_PROJECT: "activating the project for a service request",
  CREATE_QUOTATION: "creating a service quotation",
  APPROVE_QUOTATION: "recording an internal quotation approval",
  RESPOND_QUOTATION: "recording the client's quotation response",
  ATTACH_AGREEMENT: "attaching an agreement to the service workflow",
  SIGN_AGREEMENT: "recording an agreement signature",
  REVIEW_AGREEMENT: "reviewing the signed agreement",
  VERIFY_PAYMENT: "verifying a submitted payment",
  SUBMIT_PAYMENT: "submitting payment information for verification",
  COMPLETE_SANDBOX_PAYMENT: "completing a sandbox payment step",
  ASSIGN_APPROVERS: "assigning workflow reviewers",
  STAFF_PROJECT: "updating project staffing for the service request",
  HOLD: "placing the service workflow on hold",
  RESUME: "resuming the service workflow",
  CANCEL: "cancelling the service workflow",
  INTERNAL_NOTE: "adding an internal workflow note",
}

export const serviceIncidentOperations: Record<string, string> = {
  "GET /api/services/available": "loading the available service catalog",
  "GET /api/services": "loading the service catalog",
  "GET /api/services/pricing-templates": "loading service pricing templates",
  "PUT /api/services/pricing-templates/:id": "updating a pricing template",
  "DELETE /api/services/pricing-templates/:id": "deleting a pricing template",
  "GET /api/services/:id/specialists/:specialistId":
    "loading a specialist profile",
  "GET /api/services/:id/specialists": "loading service specialists",
  "GET /api/services/:id": "loading a service offering",
  "POST /api/services": "creating a service offering",
  "PUT /api/services/:id": "updating a service offering",
  "PATCH /api/services/:id/status":
    "changing a service offering's availability",
  "DELETE /api/services/:id": "deleting a service offering",
  "GET /api/service-requests": "loading booked service requests",
  "GET /api/service-requests/:id": "loading a booked service request",
  "POST /api/service-requests": "submitting a service request",
  "POST /api/client/service-requests/:id/cancel":
    "cancelling a service request",
  "GET /api/client/services": "loading the client service catalog",
  "GET /api/client/services/:id": "loading a client service offering",
  "GET /api/client/services/:id/specialists":
    "loading client-visible service specialists",
  "POST /api/client/service-requests": "submitting a service request",
  "GET /api/client/service-requests": "loading client service requests",
  "GET /api/request-inbox": "loading the department request inbox",
  "GET /api/request-inbox/:id": "loading a department service request",
  "POST /api/request-inbox/:id/accept": "accepting a service request",
  "GET /api/request-workflows/billing": "loading workflow billing records",
  "GET /api/request-workflows/notifications": "loading workflow notifications",
  "PATCH /api/request-workflows/notifications/read-all":
    "marking workflow notifications as read",
  "PATCH /api/request-workflows/notifications/:id/read":
    "marking a workflow notification as read",
  "GET /api/request-workflows/approvals": "loading workflow approvals",
  "GET /api/request-workflows/:id": "loading a service-request workflow",
  "POST /api/request-workflows/:id/actions":
    "completing a service-request workflow action",
  "POST /api/request-workflows/:id/files": "uploading a workflow file",
  "GET /api/request-workflows/:id/files/:fileId": "downloading a workflow file",
  "GET /api/workload": "loading department workload",
  "PUT /api/workload/capacity": "updating workload capacity",
  "PUT /api/workload/assignment": "allocating staff to a service request",
  "DELETE /api/workload/assignment/:id":
    "removing a staff allocation from a service request",
  "GET /api/administrative-requests":
    "loading organization-wide service requests",
  "GET /api/administrative-requests/:id":
    "loading organization-wide service request details",
  "GET /api/administrative-workload": "loading organization-wide workload",
}

function describeServiceIncident(
  endpoint: string | null,
  action: string | null,
  source: string,
  targetLabel: string | null,
  failureCode: string | null,
): string {
  const workflowOperation = action
    ? workflowActionFailureOperations[
        action as keyof typeof workflowActionFailureOperations
      ]
    : undefined
  const affected = targetLabel ? ` for “${targetLabel}”` : ""
  const reason = failureCode ? failureExplanation(failureCode) : ""
  const because = reason ? ` because ${reason}` : ""
  if (workflowOperation)
    return `Failed while ${workflowOperation}${affected}${because}.`
  const operation = endpoint ? serviceIncidentOperations[endpoint] : undefined
  if (operation) return `Failed while ${operation}${affected}${because}.`
  const area =
    source === "catalog"
      ? "processing a service catalog operation"
      : source === "requests"
        ? "processing a service request operation"
        : source === "workflow"
          ? "processing a service workflow operation"
          : source === "workload"
            ? "processing a workload operation"
            : "processing a Service Operations request"
  return `Failed while ${area}${affected}${because}.`
}

const failureExplanations: Record<string, string> = {
  ACTIVITY_LOG_PERSISTENCE_FAILED:
    "the activity log could not be saved and the requested change was rolled back",
  DATABASE_UNAVAILABLE: "the database was temporarily unavailable",
  DATABASE_TIMEOUT: "the database operation timed out",
  DATABASE_OPERATION_FAILED: "the database could not complete the operation",
  FILE_STORAGE_UNAVAILABLE: "file storage was unavailable",
  DEPENDENCY_UNAVAILABLE: "a required service was temporarily unavailable",
  REQUEST_TIMEOUT: "the server operation timed out",
  UNEXPECTED_SERVER_ERROR: "an unexpected server error occurred",
  LEGACY_UNCLASSIFIED: "no safe cause was captured for this earlier incident",
}

function failureExplanation(code: string) {
  return failureExplanations[code] ?? "an unexpected server error occurred"
}

export function describeServiceLog(
  event: string,
  action: string | null,
  source: string,
  endpoint: string | null = null,
  targetLabel: string | null = null,
  failureCode: string | null = null,
): string {
  if (event === "API_FAILURE")
    return describeServiceIncident(
      endpoint,
      action,
      source,
      targetLabel,
      failureCode,
    )
  if (event === "WORKFLOW_ACTION_COMPLETED" && action)
    return withTarget(
      workflowActionDescriptions[
        action as keyof typeof workflowActionDescriptions
      ] ?? "Completed a service-request workflow action.",
      targetLabel,
    )
  if (
    Object.hasOwn(serviceLogEvents, event) &&
    event !== "WORKFLOW_ACTION_COMPLETED"
  )
    return withTarget(
      eventDescriptions[
        event as Exclude<ServiceLogEvent, "WORKFLOW_ACTION_COMPLETED">
      ],
      targetLabel,
    )
  return "Recorded a Service Operations activity."
}

function withTarget(message: string, targetLabel: string | null) {
  if (!targetLabel) return message
  return `${message.replace(/\.$/, "")} “${targetLabel}”.`
}

export function matchingDescriptionCodes(search: string): {
  events: string[]
  actions: string[]
  endpoints: string[]
} {
  const needle = search.trim().toLocaleLowerCase()
  if (!needle) return { events: [], actions: [], endpoints: [] }
  const events = Object.entries(eventDescriptions)
    .filter(([, description]) =>
      description.toLocaleLowerCase().includes(needle),
    )
    .map(([event]) => event)
  if (
    ["failed", "failure", "server"].some(
      (term) => term.includes(needle) || needle.includes(term),
    )
  )
    events.push("API_FAILURE")
  const actions = Object.entries(workflowActionDescriptions)
    .filter(
      ([action, description]) =>
        description.toLocaleLowerCase().includes(needle) ||
        `Failed while ${workflowActionFailureOperations[action as keyof typeof workflowActionFailureOperations]}.`
          .toLocaleLowerCase()
          .includes(needle),
    )
    .map(([action]) => action)
  const endpoints = Object.entries(serviceIncidentOperations)
    .filter(([, operation]) =>
      `Failed while ${operation}.`.toLocaleLowerCase().includes(needle),
    )
    .map(([endpoint]) => endpoint)
  return { events, actions, endpoints }
}
