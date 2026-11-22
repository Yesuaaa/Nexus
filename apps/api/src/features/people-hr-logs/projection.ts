import {
  EmployeeStatus,
  EmploymentType,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import {
  historyBoolean,
  historyNullableId,
  historyTimestamp,
  type HistoryValueCheck,
} from "../../shared/management-history.js"
import { isRecordId } from "../../shared/validation.js"
import type { HistoryRow } from "./repository.js"

export const recordTypeLabels = {
  ACCOUNT: "Staff login",
  EMPLOYEE: "Employee",
  DEPARTMENT: "Department",
  TEAM: "Team",
} as const

const fieldLabels: Record<string, string> = {
  employeeId: "Employee code",
  fullName: "Full name",
  email: "Email",
  contactNumber: "Contact number",
  position: "Position",
  startDate: "Start date",
  name: "Name",
  code: "Code",
  color: "Color",
  description: "Description",
  employmentType: "Employment type",
  status: "HR status",
  departmentId: "Department ID",
  teamId: "Team ID",
  userId: "Linked account ID",
  headId: "Head ID",
  temporaryHeadOriginalId: "Original Head ID",
  temporaryHeadAssignedId: "Temporary Head ID",
  leadId: "Team Lead ID",
  role: "Account role",
  isActive: "Login enabled",
  accountDeletedAt: "Archived at",
}

const actions: Record<string, string> = {
  CREATED: "Created",
  PROFILE_UPDATED: "Updated profile",
  STATUS_CHANGED: "Changed status",
  ASSIGNMENT_CHANGED: "Changed assignment",
  HEAD_CHANGED: "Changed Department Head",
  TEMPORARY_HEAD_CHANGED: "Changed temporary Head",
  LEAD_CHANGED: "Changed Team Lead",
  TITLE_CLEARED: "Cleared former Head title",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  ROLE_CHANGED: "Changed account role",
}

type ChangeValue = string | boolean | null

const allowNull =
  (check: HistoryValueCheck) =>
  (value: unknown): value is ChangeValue =>
    value === null || check(value)

const id = allowNull(historyNullableId)
const transitionChecks: Record<
  string,
  (value: unknown) => value is ChangeValue
> = {
  departmentId: id,
  teamId: id,
  userId: id,
  headId: id,
  temporaryHeadOriginalId: id,
  temporaryHeadAssignedId: id,
  leadId: id,
  status: allowNull((value) =>
    Object.values(EmployeeStatus).some((status) => status === value),
  ),
  employmentType: allowNull((value) =>
    Object.values(EmploymentType).some((type) => type === value),
  ),
  role: allowNull((value) =>
    Object.values(Role).some((role) => role === value),
  ),
  isActive: allowNull(historyBoolean),
  accountDeletedAt: allowNull(historyTimestamp),
}

function asObject(value: Prisma.JsonValue | undefined) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
}

function presentEffect(row: HistoryRow) {
  const details = asObject(row.changes)
  const changes = row.changedFields.flatMap((key) => {
    if (!Object.hasOwn(fieldLabels, key)) return []
    const field = fieldLabels[key]
    if (Object.hasOwn(transitionChecks, key)) {
      const { before, after } = asObject(details[key])
      const check = transitionChecks[key]
      if (check(before) && check(after)) return [{ field, before, after }]
    }
    return [{ field }]
  })
  const sessionsRevoked =
    row.subjectType === "ACCOUNT" && details.sessionsRevoked === true
  const notes = []
  if (isRecordId(details.affectedAccountId))
    notes.push({
      label: "Affected account ID",
      value: details.affectedAccountId,
    })
  if (sessionsRevoked) notes.push({ label: "Login sessions", value: "Revoked" })

  return {
    id: row.id,
    action:
      row.action === "STATUS_CHANGED" && sessionsRevoked && !changes.length
        ? "Revoked login sessions"
        : (actions[row.action] ?? "Recorded change"),
    target: {
      id: row.subjectId,
      type: recordTypeLabels[row.subjectType],
      label: row.subjectName?.trim() || null,
    },
    changes,
    notes,
  }
}

const employeeStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
}

function describePeopleHrOperation(
  primary: HistoryRow,
  effects: ReturnType<typeof presentEffect>[],
) {
  const main = effects[0]
  const { type, label } = main.target
  const name = label ? `“${label}”` : null
  const record = name
    ? `${type.toLowerCase()} ${name}`
    : `the ${type.toLowerCase()}`
  const forName = name ? ` for ${name}` : ""
  const transition = (field: string) => {
    const change = main.changes.find((change) => change.field === field)
    return change && "before" in change && "after" in change
      ? change
      : undefined
  }
  switch (primary.action) {
    case "CREATED":
      if (
        primary.subjectType === "ACCOUNT" &&
        effects.some(
          (effect) =>
            effect.target.type === "Employee" && effect.action === "Created",
        )
      )
        return `Created an employee record and Staff login${forName}.`
      return `Created ${record}.`
    case "PROFILE_UPDATED":
      return primary.subjectType === "EMPLOYEE"
        ? `Updated the employee profile${forName}.`
        : `Updated details for ${record}.`
    case "STATUS_CHANGED": {
      if (main.action === "Revoked login sessions")
        return `Revoked Staff login sessions${forName}.`
      const enabled = transition("Login enabled")?.after
      if (typeof enabled === "boolean")
        return `${enabled ? "Enabled" : "Disabled"} Staff login${forName}.`
      const status = transition("HR status")?.after
      if (
        typeof status === "string" &&
        Object.hasOwn(employeeStatusLabels, status)
      )
        return `Changed the HR status${forName} to ${employeeStatusLabels[status]}.`
      return `Changed the status of ${record}.`
    }
    case "ASSIGNMENT_CHANGED":
      return `Changed membership assignments for ${record}.`
    case "HEAD_CHANGED":
    case "LEAD_CHANGED": {
      const head = primary.action === "HEAD_CHANGED"
      const role = head ? "Department Head" : "Team Lead"
      const assignment = transition(head ? "Head ID" : "Team Lead ID")
      if (assignment?.after === null) return `Removed the ${role}${forName}.`
      if (assignment?.before === null) return `Appointed a ${role}${forName}.`
      return `${assignment ? "Replaced" : "Changed"} the ${role}${forName}.`
    }
    case "TEMPORARY_HEAD_CHANGED":
      return `Changed the temporary Department Head assignment${forName}.`
    case "TITLE_CLEARED":
      return `Cleared the former Department Head title${forName}.`
    case "ARCHIVED":
      return `Archived ${record}.`
    case "DELETED":
      return `Deleted ${record}.`
    default:
      return `${main.action} for ${record}.`
  }
}

const primaryTypes: Record<string, HistoryRow["subjectType"]> = {
  DEPARTMENT_MANAGEMENT: "DEPARTMENT",
  TEAM_MANAGEMENT: "TEAM",
}

export function presentPeopleHrOperations(ids: string[], rows: HistoryRow[]) {
  const groups = new Map<string, HistoryRow[]>()
  for (const row of rows) {
    const group = groups.get(row.operationId)
    if (group) group.push(row)
    else groups.set(row.operationId, [row])
  }
  return ids.flatMap((operationId) => {
    const group = groups.get(operationId)
    if (!group?.length) return []
    const first = group[0]
    const primaryType =
      primaryTypes[first.origin] ??
      (group.some((row) => row.subjectType === "ACCOUNT")
        ? "ACCOUNT"
        : "EMPLOYEE")
    const preferred =
      group.find((row) => row.subjectType === primaryType) ?? first
    const primary =
      preferred.subjectType === "ACCOUNT" &&
      preferred.action === "PROFILE_UPDATED"
        ? (group.find(
            (row) =>
              row.subjectType === "EMPLOYEE" &&
              row.action === "PROFILE_UPDATED",
          ) ?? preferred)
        : preferred
    const ordered = [primary, ...group.filter((row) => row !== primary)]
    const effects = ordered.map(presentEffect)
    const main = effects[0]
    const fields = [...new Set(main.changes.map(({ field }) => field))]
    const summaryDetail =
      primary.action === "PROFILE_UPDATED" ||
      primary.action === "ASSIGNMENT_CHANGED"
        ? fields.join(", ") || null
        : null
    return [
      {
        id: operationId,
        operationId,
        source: primary.origin,
        event: primary.action,
        action: main.action,
        outcome: "SUCCESS",
        actorId: first.actorAccountId,
        actorRole: first.actorRoleAtTime,
        actor: {
          id: first.actorAccountId,
          role: first.actorRoleAtTime,
          name: first.actorName?.trim() || first.actorAccountId,
          attribution: first.actorName?.trim() ? "CURRENT" : "UNAVAILABLE",
        },
        target: main.target,
        subjectId: primary.subjectId,
        message: describePeopleHrOperation(primary, effects),
        summaryDetail,
        effects,
        changes: [],
        correlationId: null,
        endpoint: null,
        requestId: null,
        status: null,
        failureCode: null,
        failureReason: null,
        createdAt: first.createdAt,
      },
    ]
  })
}
