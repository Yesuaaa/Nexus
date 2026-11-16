import type { Account } from "../../auth/model/types.ts"
import {
  moduleRegistry,
  type WorkspaceModuleId,
} from "../../workspaces/model/module-registry.ts"

export function historyModuleCoverage(moduleId: string) {
  if (!moduleId)
    return {
      status: "partial",
      label: "All Modules — limited coverage",
      readable: true,
      explanation:
        "All Modules includes integrated Account, Workforce, metadata-only Attendance and selected Project/Service workflow audit histories. It is not complete application-wide coverage.",
    }
  switch (moduleId) {
    case "project-management":
      return {
        status: "partial",
        label: "Partial — milestone and staffing events",
        readable: true,
        explanation:
          "Only non-internal recorded project milestone updates and staffing allocations are integrated. Service-request lifecycle, internal events, content, deliverables and other project actions are excluded; this is not complete project auditing.",
      }
    case "attendance-monitoring":
      return {
        status: "partial",
        label: "Partial — attendance record changes",
        readable: true,
        explanation:
          "Only recorded INSERT/UPDATE/DELETE metadata for Attendance policies, rules, assignments, workdays, sessions, breaks and adjustments is integrated. No work times, reasons, snapshots, approval details or complete compliance coverage is provided.",
      }
    case "administration":
      return {
        status: "supported",
        label: "Supported — scoped management",
        readable: true,
        explanation:
          "Account management history is supported. Authentication, security and operational diagnostics are not integrated.",
      }
    case "people-hr":
      return {
        status: "supported",
        label: "Supported — scoped management",
        readable: true,
        explanation:
          "Employee, Department and Team management history is supported. This does not imply all workforce or self-service mutations are audited.",
      }
    case "service-operations":
      return {
        status: "partial",
        label: "Partial — client accounts and request events",
        readable: true,
        explanation:
          "Client Management account history plus selected non-internal consultation, quotation-sent, client-acceptance and workflow-cancellation metadata is integrated. Booking/request creation, confidential content, internal approvals, payments and other service activity are excluded.",
      }
    default:
      return {
        status: "not-integrated",
        label: "Not yet integrated",
        readable: false,
        explanation:
          "This module has no source integrated into System Logs. Existing domain histories, where present, are not available here. Select All Modules or an integrated module to investigate recorded management changes.",
      }
  }
}
export function historyModuleOptions() {
  return [
    { value: "", label: "All Modules — limited coverage" },
    ...Object.entries(moduleRegistry).map(([id, module]) => ({
      value: id,
      label: `${module.title} — ${historyModuleCoverage(id).label}`,
    })),
  ]
}
export function initialHistoryFilters(
  origin: WorkspaceModuleId | null,
  now = new Date(),
): HistoryFilters {
  return { ...defaultHistoryFilters(now), moduleId: origin ?? "" }
}
export function investigateHistoryOperation(
  filters: HistoryFilters,
  operationId: string,
): HistoryFilters {
  return { ...filters, operationId }
}

export const historySources = [
  "audit.account-management",
  "audit.workforce-management",
  "audit.attendance",
  "audit.workflow",
] as const
export const projectActions = [
  "PROJECT_MILESTONE_UPDATED",
  "STAFFING_ALLOCATED",
]
export const serviceActions = [
  "CONSULTATION_SCHEDULED",
  "CONSULTATION_COMPLETED",
  "CONSULTATION_CANCELLED",
  "QUOTATION_SENT",
  "APPROVAL_CONFIRMED",
  "WORKFLOW_CANCELLED",
]
export const attendanceSubjectTypes = [
  "attendance_policy",
  "attendance_policy_day",
  "attendance_policy_assignment",
  "attendance_workday",
  "attendance_work_session",
  "attendance_break",
  "attendance_adjustment",
]
export const historyActions = [
  "CREATED",
  "PROFILE_UPDATED",
  "ROLE_CHANGED",
  "STATUS_CHANGED",
  "PASSWORD_RESET",
  "ARCHIVED",
  "RESTORED",
  "DELETED",
  "ASSIGNMENT_CHANGED",
  "HEAD_CHANGED",
  "TEMPORARY_HEAD_CHANGED",
  "LEAD_CHANGED",
  "TITLE_CLEARED",
  "INSERT",
  "UPDATE",
  "DELETE",
  ...projectActions,
  ...serviceActions,
]
export const canReadSystemLogs = (account: Account) =>
  account.role === "SUPERADMIN" && account.isActive && !account.accountDeletedAt
export type HistoryFilters = {
  moduleId: string
  source: string
  eventName: string
  action: string
  actorId: string
  subjectId: string
  subjectType: string
  operationId: string
  from: string
  to: string
}
export function defaultHistoryFilters(now = new Date()): HistoryFilters {
  return {
    moduleId: "",
    source: "",
    eventName: "",
    action: "",
    actorId: "",
    subjectId: "",
    subjectType: "",
    operationId: "",
    from: new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  }
}
export function historyQuery(
  filters: HistoryFilters,
  cursor: string | null = null,
): string {
  const from = new Date(`${filters.from}T00:00:00.000Z`),
    to = new Date(`${filters.to}T23:59:59.999Z`)
  if (
    !/^\d{4}-\d\d-\d\d$/.test(filters.from) ||
    !/^\d{4}-\d\d-\d\d$/.test(filters.to) ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from.toISOString().slice(0, 10) !== filters.from ||
    to.toISOString().slice(0, 10) !== filters.to ||
    to < from ||
    to.getTime() - from.getTime() > 31 * 86400000
  )
    throw new Error("Choose an ordered UTC date range of at most 31 days.")
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    pageSize: "50",
  })
  for (const key of [
    "moduleId",
    "source",
    "eventName",
    "action",
    "actorId",
    "subjectId",
    "subjectType",
    "operationId",
  ] as const)
    if (filters[key].trim()) query.set(key, filters[key].trim())
  if (cursor) query.set("cursor", cursor)
  return query.toString()
}
export type HistoryEvent = {
  eventId: string
  source: string
  sourceEventId: string
  occurredAt: string
  moduleId: string
  eventName: string
  actorId: string | null
  roleAtTime: string | null
  subjectType: string
  subjectId: string
  operationId: string | null
  kind: "management" | "attendance" | "project" | "service"
  changedFields: string[]
  transitions: { field: string; before: string; after: string }[]
  sessionsRevoked: boolean | null
}
export type HistoryPage = {
  events: HistoryEvent[]
  nextCursor: string | null
  complete: boolean
  snapshotBoundary: string
  sources: {
    source: string
    status: string
    omittedCount: number | null
    reasonCode: string | null
  }[]
  eventCount: number
  operationCount: number
  ungroupedEventCount: number
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v)
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)
const roles = ["SUPERADMIN", "ADMIN", "STAFF", "USER"]
const fields = [
  "role",
  "isActive",
  "accountDeletedAt",
  "fullName",
  "email",
  "contactNumber",
  "employeeId",
  "position",
  "employmentType",
  "startDate",
  "status",
  "departmentId",
  "teamId",
  "userId",
  "name",
  "code",
  "color",
  "description",
  "headId",
  "temporaryHeadOriginalId",
  "temporaryHeadAssignedId",
  "leadId",
]
function scalar(field: string, value: unknown): boolean {
  if (value === null) return true
  if (["isActive"].includes(field)) return typeof value === "boolean"
  if (field === "role")
    return typeof value === "string" && roles.includes(value)
  if (field === "status")
    return ["ACTIVE", "INACTIVE", "ON_LEAVE"].includes(String(value))
  if (field === "employmentType")
    return ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].includes(
      String(value),
    )
  if (field === "accountDeletedAt")
    return (
      typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
      Number.isFinite(Date.parse(value))
    )
  return (
    [
      "departmentId",
      "teamId",
      "userId",
      "headId",
      "temporaryHeadOriginalId",
      "temporaryHeadAssignedId",
      "leadId",
    ].includes(field) && id(value)
  )
}
const display = (v: unknown) =>
  v === null ? "None" : v === true ? "Yes" : v === false ? "No" : String(v)
/** Projection only: never render raw summaries, JSON, live personal identities or
 * arbitrary transitions even if a malformed response reaches the browser. */
export function parseHistoryEvent(raw: unknown): HistoryEvent {
  const invalid = () => {
    throw new Error("History response could not be verified.")
  }
  if (
    !object(raw) ||
    !object(raw.actor) ||
    !object(raw.subject) ||
    !object(raw.correlation) ||
    !object(raw.details)
  )
    return invalid()
  const { actor, subject, correlation, details } = raw
  const attendance = raw.source === "audit.attendance"
  const workflow = raw.source === "audit.workflow"
  const project = workflow && projectActions.includes(String(raw.sourceAction))
  const service = workflow && serviceActions.includes(String(raw.sourceAction))
  if (
    attendance !== (raw.moduleId === "attendance-monitoring") ||
    project !== (raw.moduleId === "project-management") ||
    (workflow && !project && !service) ||
    (service && raw.moduleId !== "service-operations") ||
    (!service && serviceActions.includes(String(raw.sourceAction))) ||
    (!project && projectActions.includes(String(raw.sourceAction))) ||
    (!attendance &&
      ["INSERT", "UPDATE", "DELETE"].includes(String(raw.sourceAction))) ||
    (attendance &&
      subject.type === "attendance_workday" &&
      raw.sourceAction === "DELETE")
  )
    return invalid()
  if (
    raw.schemaVersion !== 1 ||
    raw.category !== "audit" ||
    raw.area !== "module" ||
    raw.severity !== "info" ||
    raw.outcome !== "succeeded" ||
    !historySources.includes(raw.source as (typeof historySources)[number]) ||
    !id(raw.sourceEventId) ||
    raw.eventId !== `${raw.source}:${raw.sourceEventId}` ||
    ![
      "administration",
      "people-hr",
      "service-operations",
      "attendance-monitoring",
      "project-management",
    ].includes(String(raw.moduleId)) ||
    !(
      project
        ? ["project"]
        : service
          ? ["service_request"]
          : attendance
            ? attendanceSubjectTypes
            : ["account", "employee", "department", "team"]
    ).includes(String(subject.type)) ||
    !(attendance
      ? typeof subject.id === "string" &&
        /^[A-Za-z0-9_:-]{1,100}$/.test(subject.id)
      : id(subject.id)) ||
    !(attendance || workflow
      ? correlation.operationId === null
      : uuid(correlation.operationId)) ||
    typeof raw.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(raw.occurredAt)) ||
    !historyActions.includes(String(raw.sourceAction)) ||
    raw.eventName !==
      `${subject.type}.${String(raw.sourceAction).toLowerCase()}`
  )
    return invalid()
  if (
    (attendance || workflow) &&
    (!(
      project
        ? projectActions
        : service
          ? serviceActions
          : ["INSERT", "UPDATE", "DELETE"]
    ).includes(String(raw.sourceAction)) ||
      actor.roleAtTime !== null ||
      details.origin !== null ||
      !Array.isArray(details.changedFields) ||
      details.changedFields.length !== 0 ||
      !object(details.transitions) ||
      Object.keys(details.transitions).length !== 0 ||
      details.sessionsRevoked !== null)
  )
    return invalid()
  if (
    (actor.accountId !== null && !id(actor.accountId)) ||
    (actor.roleAtTime !== null && !roles.includes(String(actor.roleAtTime))) ||
    actor.roleEvidence !==
      (actor.roleAtTime === null ? "not-recorded" : "recorded")
  )
    return invalid()
  if (
    details.kind !==
      (project
        ? "project"
        : service
          ? "service"
          : attendance
            ? "attendance"
            : "management") ||
    !Array.isArray(details.changedFields) ||
    details.changedFields.length > 24 ||
    !details.changedFields.every(
      (f) => typeof f === "string" && fields.includes(f),
    ) ||
    !object(details.transitions) ||
    (details.sessionsRevoked !== null &&
      typeof details.sessionsRevoked !== "boolean")
  )
    return invalid()
  const transitions: HistoryEvent["transitions"] = []
  for (const [field, value] of Object.entries(details.transitions)) {
    if (field === "cause" && value === "FORMER_DEPARTMENT_HEAD") {
      transitions.push({
        field: "Cleanup cause",
        before: "—",
        after: "Former Department Head",
      })
      continue
    }
    if (field === "affectedAccountId" && id(value)) {
      transitions.push({
        field: "Affected account ID",
        before: "—",
        after: value,
      })
      continue
    }
    if (
      !details.changedFields.includes(field) ||
      !object(value) ||
      Object.keys(value).sort().join(",") !== "after,before" ||
      !scalar(field, value.before) ||
      !scalar(field, value.after)
    )
      return invalid()
    transitions.push({
      field,
      before: display(value.before),
      after: display(value.after),
    })
  }
  return {
    eventId: String(raw.eventId),
    source: String(raw.source),
    sourceEventId: raw.sourceEventId,
    occurredAt: raw.occurredAt,
    moduleId: String(raw.moduleId),
    eventName: String(raw.eventName),
    actorId: actor.accountId as string | null,
    roleAtTime: actor.roleAtTime as string | null,
    subjectType: String(subject.type),
    subjectId: subject.id as string,
    operationId: correlation.operationId as string | null,
    kind: project
      ? "project"
      : service
        ? "service"
        : attendance
          ? "attendance"
          : "management",
    changedFields: details.changedFields as string[],
    transitions,
    sessionsRevoked: details.sessionsRevoked as boolean | null,
  }
}
export function parseHistoryPage(raw: unknown): HistoryPage {
  const invalid = () => {
    throw new Error("History response could not be verified.")
  }
  if (
    !object(raw) ||
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.events) ||
    raw.events.length > 100 ||
    !Array.isArray(raw.sources) ||
    !object(raw.grouping) ||
    raw.grouping.scope !== "page" ||
    typeof raw.complete !== "boolean" ||
    typeof raw.snapshotBoundary !== "string" ||
    !Number.isFinite(Date.parse(raw.snapshotBoundary)) ||
    (raw.nextCursor !== null &&
      (typeof raw.nextCursor !== "string" || raw.nextCursor.length > 4096))
  )
    return invalid()
  const events = raw.events.map(parseHistoryEvent)
  if (new Set(events.map((e) => e.eventId)).size !== events.length)
    return invalid()
  const sources = raw.sources.map((s) => {
    if (
      !object(s) ||
      !historySources.includes(s.source as (typeof historySources)[number]) ||
      !["available", "unavailable"].includes(String(s.status)) ||
      (s.omittedCount !== null &&
        (!Number.isInteger(s.omittedCount) || Number(s.omittedCount) < 0)) ||
      (s.reasonCode !== null &&
        !["INVALID_RECORD", "SCAN_CAP", "SOURCE_UNAVAILABLE"].includes(
          String(s.reasonCode),
        ))
    )
      return invalid()
    return {
      source: String(s.source),
      status: String(s.status),
      omittedCount: s.omittedCount as number | null,
      reasonCode: s.reasonCode as string | null,
    }
  })
  if (
    !sources.length ||
    sources.length > 4 ||
    new Set(sources.map((s) => s.source)).size !== sources.length ||
    (raw.complete &&
      sources.some((s) => s.status !== "available" || s.reasonCode !== null)) ||
    (sources.some((s) => s.status === "unavailable") && raw.nextCursor !== null)
  )
    return invalid()
  const operationCount = new Set(
    events.map((e) => e.operationId).filter((id) => id !== null),
  ).size
  const ungroupedEventCount = events.filter(
    (e) => e.operationId === null,
  ).length
  if (
    raw.grouping.eventCount !== events.length ||
    raw.grouping.operationCount !== operationCount ||
    (raw.grouping.ungroupedEventCount ?? 0) !== ungroupedEventCount
  )
    return invalid()
  return {
    events,
    nextCursor: raw.nextCursor as string | null,
    complete: raw.complete,
    snapshotBoundary: raw.snapshotBoundary,
    sources,
    eventCount: events.length,
    operationCount,
    ungroupedEventCount,
  }
}
export function canAdvanceHistory(page: HistoryPage): boolean {
  return (
    !!page.nextCursor && page.sources.every((s) => s.status === "available")
  )
}
