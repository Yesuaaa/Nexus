import { Role } from "../../generated/prisma/client.js"
import registry from "../modules/module-registry.json" with { type: "json" }
import {
  assertHistoryObject,
  historyBoolean,
  historyNullableId,
  historyTimestamp,
  historyTransition,
  validateHistoryPayload,
  type HistoryValueCheck,
} from "../../shared/management-history.js"
import { isRecordId } from "../../shared/validation.js"
import { projectSource, projectEventNames } from "./project-audit.catalog.js"
import { serviceEventNames } from "./service-audit.catalog.js"
import {
  attendanceSource,
  attendanceEventNames,
  type AttendanceSubject,
} from "./attendance-audit.catalog.js"

export const sources = [
  "audit.account-management",
  "audit.workforce-management",
  attendanceSource,
  projectSource,
] as const
export type ManagementSource = (typeof sources)[number]
export type ModuleId = keyof typeof registry
export type SubjectType =
  | "account"
  | "employee"
  | "department"
  | "team"
  | "project"
  | "service_request"
  | AttendanceSubject
export type SafeValue = string | boolean | null
export type SafeChange = SafeValue | { before: SafeValue; after: SafeValue }
export type NormalizedEventV1 = {
  schemaVersion: 1
  eventId: string
  source: ManagementSource
  sourceEventId: string
  occurredAt: string
  observedAt: null
  category: "audit"
  area: "module"
  moduleId: ModuleId
  relatedModuleIds: ModuleId[]
  eventName: string
  sourceAction: string
  severity: "info"
  outcome: "succeeded"
  actor: {
    kind: "account" | "unknown"
    accountId: string | null
    roleAtTime: Role | null
    roleEvidence: "recorded" | "not-recorded"
  }
  subject: { type: SubjectType; id: string }
  correlation: {
    operationId: string | null
    httpRequestId: null
    traceId: null
    workflowActionId: null
    businessRequestId: null
    projectId: null
    workdayId: null
    jobRunId: null
  }
  summaryKey: string
  details: {
    kind: "management" | "attendance" | "project" | "service"
    origin: string | null
    changedFields: string[]
    transitions: Record<string, SafeChange>
    sessionsRevoked: boolean | null
  }
}

const member =
  (values: readonly string[]): HistoryValueCheck =>
  (v) =>
    typeof v === "string" && values.includes(v)
const role = member(Object.values(Role))
const active = historyTransition(historyBoolean)
const id = historyTransition(historyNullableId)
const heads = {
  headId: id,
  temporaryHeadOriginalId: id,
  temporaryHeadAssignedId: id,
}
const assignments = { departmentId: id, teamId: id, userId: id }
const status = member(["ACTIVE", "INACTIVE", "ON_LEAVE"])
const employment = member(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"])
const created =
  (check: HistoryValueCheck): HistoryValueCheck =>
  (v) => {
    assertHistoryObject(v, ["before", "after"], ["before", "after"])
    return v.before === null && check(v.after)
  }
const lifecycle =
  (restore: boolean): HistoryValueCheck =>
  (v) => {
    if (!historyTransition(historyTimestamp)(v)) return false
    const t = v as { before: unknown; after: unknown }
    return restore
      ? t.before !== null && t.after === null
      : t.before === null && t.after !== null
  }
const removed: HistoryValueCheck = (v) => {
  if (!id(v)) return false
  const t = v as { before: unknown; after: unknown }
  return t.before !== null && t.after === null
}
type Policy = {
  fields: string[]
  checks: Record<string, HistoryValueCheck>
  required?: string[]
  origins?: string[]
}
// Read-side contracts intentionally independent of writers; shared validation primitives
// enforce their closed JSON shapes without invoking a write or manufacturing an actor.
const accountPolicies: Record<string, Policy> = {
  CREATED: {
    fields: ["role", "isActive", "fullName", "email", "contactNumber"],
    checks: { role: created(role), isActive: created(historyBoolean) },
    required: ["role", "isActive"],
  },
  PROFILE_UPDATED: {
    fields: ["fullName", "email", "contactNumber", "isActive"],
    checks: { isActive: active, sessionsRevoked: historyBoolean },
    origins: ["CLIENT_MANAGEMENT", "ACCOUNT_MANAGEMENT"],
  },
  ROLE_CHANGED: {
    fields: ["role"],
    checks: { role: historyTransition(role) },
    required: ["role"],
    origins: ["ACCOUNT_MANAGEMENT"],
  },
  STATUS_CHANGED: {
    fields: ["isActive"],
    checks: { isActive: active, sessionsRevoked: historyBoolean },
    required: ["sessionsRevoked"],
    origins: ["ACCOUNT_MANAGEMENT", "EMPLOYEE_MANAGEMENT"],
  },
  PASSWORD_RESET: {
    fields: [],
    checks: { sessionsRevoked: (v) => v === true },
    required: ["sessionsRevoked"],
    origins: ["ACCOUNT_MANAGEMENT"],
  },
  ARCHIVED: {
    fields: ["accountDeletedAt", "isActive"],
    checks: {
      accountDeletedAt: lifecycle(false),
      isActive: active,
      sessionsRevoked: historyBoolean,
    },
    required: ["accountDeletedAt", "sessionsRevoked"],
  },
  RESTORED: {
    fields: ["accountDeletedAt"],
    checks: {
      accountDeletedAt: lifecycle(true),
      sessionsRevoked: historyBoolean,
    },
    required: ["accountDeletedAt", "sessionsRevoked"],
    origins: ["ACCOUNT_MANAGEMENT"],
  },
  DELETED: {
    fields: [],
    checks: {},
    origins: ["ACCOUNT_MANAGEMENT", "EMPLOYEE_MANAGEMENT"],
  },
}
const profiles = {
  employee: [
    "employeeId",
    "fullName",
    "email",
    "contactNumber",
    "position",
    "employmentType",
    "startDate",
  ],
  department: ["name", "code", "color", "description"],
  team: ["name", "description"],
}
export const accountActions = Object.keys(accountPolicies)
export const workforceActions = [
  "CREATED",
  "PROFILE_UPDATED",
  "STATUS_CHANGED",
  "ASSIGNMENT_CHANGED",
  "HEAD_CHANGED",
  "TEMPORARY_HEAD_CHANGED",
  "LEAD_CHANGED",
  "TITLE_CLEARED",
  "DELETED",
]
export function eventNames(): string[] {
  return [
    ...attendanceEventNames,
    ...projectEventNames,
    ...serviceEventNames,
    ...accountActions.map((a) => `account.${a.toLowerCase()}`),
    ...(["employee", "department", "team"] as const).flatMap((s) =>
      workforceActions
        .filter((a) => workforcePolicy(s, a) !== null)
        .map((a) => `${s}.${a.toLowerCase()}`),
    ),
  ]
}
function workforcePolicy(
  subject: keyof typeof profiles,
  action: string,
): Policy | null {
  const employee = subject === "employee",
    department = subject === "department"
  switch (action) {
    case "CREATED": {
      const checks: Record<string, HistoryValueCheck> = employee
        ? {
            ...assignments,
            status: historyTransition((v) => v === null || status(v)),
            employmentType: historyTransition(
              (v) => v === null || employment(v),
            ),
          }
        : department
          ? heads
          : { departmentId: id, leadId: id }
      return { fields: [...profiles[subject], ...Object.keys(checks)], checks }
    }
    case "PROFILE_UPDATED":
      return {
        fields: profiles[subject],
        checks: employee
          ? { employmentType: historyTransition(employment) }
          : {},
      }
    case "STATUS_CHANGED":
      return employee
        ? {
            fields: ["status"],
            checks: { status: historyTransition(status) },
            required: ["status"],
          }
        : null
    case "ASSIGNMENT_CHANGED":
      return subject === "team"
        ? null
        : {
            fields: employee
              ? Object.keys(assignments)
              : ["departmentId", "teamId", "position"],
            checks: employee
              ? assignments
              : { departmentId: id, teamId: id, affectedAccountId: isRecordId },
            required: employee ? [] : ["affectedAccountId"],
          }
    case "HEAD_CHANGED":
    case "TEMPORARY_HEAD_CHANGED":
      return department
        ? {
            fields: Object.keys(heads),
            checks: heads,
            required: action === "HEAD_CHANGED" ? ["headId"] : [],
          }
        : null
    case "LEAD_CHANGED":
      return subject === "team"
        ? { fields: ["leadId"], checks: { leadId: id }, required: ["leadId"] }
        : null
    case "TITLE_CLEARED":
      return subject === "team"
        ? null
        : {
            fields: ["position"],
            checks: {
              cause: (v) => v === "FORMER_DEPARTMENT_HEAD",
              ...(department ? { affectedAccountId: isRecordId } : {}),
            },
            required: department ? ["cause", "affectedAccountId"] : ["cause"],
          }
    case "DELETED":
      return employee
        ? null
        : {
            fields: department
              ? Object.keys(heads)
              : ["departmentId", "leadId"],
            checks: department
              ? {
                  headId: removed,
                  temporaryHeadOriginalId: removed,
                  temporaryHeadAssignedId: removed,
                }
              : { departmentId: removed, leadId: removed },
          }
    default:
      return null
  }
}
export function sourceModule(
  source: ManagementSource,
  origin: string,
): ModuleId {
  if (source === attendanceSource) return "attendance-monitoring"
  if (source === projectSource) return "project-management"
  if (origin === "ACCOUNT_MANAGEMENT") return "administration"
  if (source === sources[0] && origin === "CLIENT_MANAGEMENT")
    return "service-operations"
  return "people-hr"
}

/** Safe rejection deliberately returns no input fragments or personal values. */
export function normalizeManagementEvent(
  source: ManagementSource,
  input: unknown,
): NormalizedEventV1 | null {
  try {
    if (source === attendanceSource || source === projectSource) return null
    const account = source === sources[0]
    if (!sources.includes(source)) return null
    const subjectKey = account ? "subjectAccountId" : "subjectId"
    const keys = [
      "id",
      "actorAccountId",
      "actorRoleAtTime",
      "operationId",
      subjectKey,
      "action",
      "origin",
      "changedFields",
      "changes",
      "createdAt",
      ...(!account ? ["subjectType"] : []),
    ]
    assertHistoryObject(input, keys, keys)
    if (
      typeof input.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) ||
      !(input.createdAt instanceof Date) ||
      !Number.isFinite(input.createdAt.getTime()) ||
      !historyTimestamp(input.createdAt.toISOString()) ||
      !isRecordId(input[subjectKey]) ||
      typeof input.operationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.operationId,
      )
    )
      return null
    if (input.actorAccountId !== null && !isRecordId(input.actorAccountId))
      return null
    if (input.actorRoleAtTime !== null && !role(input.actorRoleAtTime))
      return null
    if (input.actorAccountId === null && input.actorRoleAtTime !== null)
      return null
    if (typeof input.action !== "string" || typeof input.origin !== "string")
      return null
    const origins = account
      ? ["ACCOUNT_MANAGEMENT", "CLIENT_MANAGEMENT", "EMPLOYEE_MANAGEMENT"]
      : [
          "ACCOUNT_MANAGEMENT",
          "EMPLOYEE_MANAGEMENT",
          "DEPARTMENT_MANAGEMENT",
          "TEAM_MANAGEMENT",
        ]
    if (!origins.includes(input.origin)) return null
    let subject: SubjectType = "account"
    if (!account) {
      if (
        !["EMPLOYEE", "DEPARTMENT", "TEAM"].includes(String(input.subjectType))
      )
        return null
      subject = String(input.subjectType).toLowerCase() as keyof typeof profiles
    }
    const policy = account
      ? Object.hasOwn(accountPolicies, input.action)
        ? accountPolicies[input.action]
        : null
      : workforcePolicy(subject as keyof typeof profiles, input.action)
    if (!policy || (policy.origins && !policy.origins.includes(input.origin)))
      return null
    const payload = {
      action: input.action,
      origin: input.origin,
      [subjectKey]: input[subjectKey],
      changedFields: input.changedFields,
      changes: input.changes,
      ...(!account ? { subjectType: input.subjectType } : {}),
    }
    const valid = validateHistoryPayload(
      payload,
      subjectKey,
      policy.fields,
      policy.checks,
      policy.required,
    )
    if (
      account &&
      input.action === "STATUS_CHANGED" &&
      !Object.hasOwn(valid.changes, "isActive") &&
      valid.changes.sessionsRevoked !== true
    )
      return null
    if (
      !account &&
      input.action === "TEMPORARY_HEAD_CHANGED" &&
      !Object.hasOwn(valid.changes, "temporaryHeadOriginalId") &&
      !Object.hasOwn(valid.changes, "temporaryHeadAssignedId")
    )
      return null
    const transitions: Record<string, SafeChange> = {}
    for (const [key, value] of Object.entries(valid.changes)) {
      if (key === "sessionsRevoked") continue
      // Closed validators above permit only these scalar/transition shapes.
      transitions[key] = value as SafeChange
    }
    const eventName = `${subject}.${input.action.toLowerCase()}`
    const event: NormalizedEventV1 = {
      schemaVersion: 1,
      eventId: `${source}:${input.id}`,
      source,
      sourceEventId: input.id,
      occurredAt: input.createdAt.toISOString(),
      observedAt: null,
      category: "audit",
      area: "module",
      moduleId: sourceModule(source, input.origin),
      relatedModuleIds:
        !account && input.origin === "ACCOUNT_MANAGEMENT"
          ? ["people-hr"]
          : account && input.origin === "EMPLOYEE_MANAGEMENT"
            ? ["administration"]
            : [],
      eventName,
      sourceAction: input.action,
      severity: "info",
      outcome: "succeeded",
      actor: {
        kind: input.actorAccountId === null ? "unknown" : "account",
        accountId: input.actorAccountId,
        roleAtTime: input.actorRoleAtTime as Role | null,
        roleEvidence:
          input.actorRoleAtTime === null ? "not-recorded" : "recorded",
      },
      subject: { type: subject, id: input[subjectKey] as string },
      correlation: {
        operationId: input.operationId,
        httpRequestId: null,
        traceId: null,
        workflowActionId: null,
        businessRequestId: null,
        projectId: null,
        workdayId: null,
        jobRunId: null,
      },
      summaryKey: eventName,
      details: {
        kind: "management",
        origin: input.origin,
        changedFields: valid.changedFields,
        transitions,
        sessionsRevoked:
          typeof valid.changes.sessionsRevoked === "boolean"
            ? valid.changes.sessionsRevoked
            : null,
      },
    }
    return Buffer.byteLength(JSON.stringify(event)) <= 16384 ? event : null
  } catch {
    return null
  }
}
