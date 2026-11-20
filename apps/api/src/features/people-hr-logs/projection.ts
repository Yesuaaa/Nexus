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
    const primary =
      group.find((row) => row.subjectType === primaryType) ?? first
    const ordered = [primary, ...group.filter((row) => row !== primary)]
    const effects = ordered.map(presentEffect)
    const main = effects[0]
    const recordName = main.target.label ?? main.target.id
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
        message: `${main.action} · ${recordName}`,
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
