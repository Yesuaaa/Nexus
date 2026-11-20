import { isDeepStrictEqual } from "node:util"
import type { Prisma } from "../../generated/prisma/client.js"
import { isRecordId } from "../../shared/validation.js"
import type { ComplianceHistoryRow } from "./repository.js"

export const sources = new Set([
  "time-logs",
  "policies",
  "corrections",
  "overtime",
  "leave",
])
export const eventLabels: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  DELETED: "Deleted",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
}

type Value = string | boolean | number | null
type Field = readonly [
  key: string,
  label: string,
  parse?: (value: unknown) => Value,
]

const recordId = (value: unknown) => (isRecordId(value) ? value : null)
const isoDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
    value,
  ) &&
  Number.isFinite(Date.parse(value))
    ? value
    : null
const zone = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9/_+-]{1,100}$/.test(value)
    ? value
    : null
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null
const boolean = (value: unknown) => (typeof value === "boolean" ? value : null)
const statuses = new Set([
  "PENDING",
  "SUBMITTED",
  "VERIFIED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REVERSED",
])
const status = (value: unknown) =>
  typeof value === "string" && statuses.has(value) ? value : null

const sessionFields: Field[] = [
  ["startedAt", "Start time", isoDate],
  ["endedAt", "End time", isoDate],
]
const scheduleFields: Field[] = [
  ["isWorkingDay", "Working day", boolean],
  ["requiredMinutes", "Required minutes", number],
]
const fieldsByEntity: Record<string, Field[]> = {
  AttendanceWorkday: [["workDate", "Work date", isoDate], ...scheduleFields],
  AttendanceWorkSession: sessionFields,
  AttendanceBreak: [...sessionFields, ["isPaid", "Paid break", boolean]],
  AttendancePolicy: [
    ["name", "Policy name"],
    ["timeZone", "Time zone", zone],
    ["archivedAt", "Archived at", isoDate],
    ["unpaidBreaksEnabled", "Unpaid breaks enabled", boolean],
    ["overnightRequiresReview", "Overnight review required", boolean],
  ],
  AttendancePolicyDay: [["weekday", "Weekday", number], ...scheduleFields],
  AttendancePolicyAssignment: [
    ["policyId", "Policy ID", recordId],
    ["effectiveFrom", "Effective from", isoDate],
    ["effectiveUntil", "Effective until", isoDate],
  ],
  AttendanceAdjustment: [
    ["status", "Status", status],
    ["overtimeMinutes", "Overtime minutes", number],
    ["proposedStartedAt", "Proposed start", isoDate],
    ["proposedEndedAt", "Proposed end", isoDate],
  ],
  LeaveRequest: [["status", "Status", status]],
}

const entityLabels: Record<string, string> = {
  AttendanceWorkday: "Attendance workday",
  AttendanceWorkSession: "Attendance session",
  AttendanceBreak: "Break",
  AttendancePolicy: "Attendance policy",
  AttendancePolicyDay: "Policy weekday",
  AttendancePolicyAssignment: "Policy assignment",
  LeaveRequest: "Leave request",
}

function snapshot(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
}

function presentEffect(row: ComplianceHistoryRow) {
  const previous = snapshot(row.before)
  const next = snapshot(row.after)
  const type =
    row.entityType === "AttendanceAdjustment"
      ? row.source === "overtime"
        ? "Overtime request"
        : "Attendance correction"
      : entityLabels[row.entityType]
  const changes = (fieldsByEntity[row.entityType] ?? []).flatMap(
    ([key, field, parse]) => {
      if (isDeepStrictEqual(previous[key], next[key])) return []
      const before = parse?.(previous[key]) ?? null
      const after = parse?.(next[key]) ?? null
      return [before !== after ? { field, before, after } : { field }]
    },
  )
  return {
    id: row.id,
    action: eventLabels[row.event],
    target: { type, id: row.subjectId, label: null },
    changes,
    notes: [
      ...(row.employeeName?.trim()
        ? [{ label: "Current employee name", value: row.employeeName.trim() }]
        : []),
      ...(row.employeeId
        ? [{ label: "Employee ID", value: row.employeeId }]
        : []),
    ],
  }
}

function priority(row: ComplianceHistoryRow) {
  if (row.source === "corrections") return 0
  if (
    row.entityType === "AttendancePolicy" ||
    row.entityType === "AttendanceWorkSession"
  )
    return 1
  if (
    row.entityType === "AttendancePolicyAssignment" &&
    row.event === "CREATED"
  )
    return 2
  if (row.entityType === "AttendanceWorkday") return 4
  return 3
}

export function presentWorkforceComplianceLogs(
  ids: string[],
  rows: ComplianceHistoryRow[],
) {
  const groups = new Map<string, ComplianceHistoryRow[]>()
  for (const row of rows) {
    const group = groups.get(row.groupId)
    if (group) group.push(row)
    else groups.set(row.groupId, [row])
  }
  return ids.flatMap((id) => {
    const group = groups.get(id)
    if (!group?.length) return []
    group.sort((left, right) => priority(left) - priority(right))
    const primary = group[0]
    const effects = group.map(presentEffect)
    const main = effects[0]
    const name = primary.actorName?.trim()
    return [
      {
        id,
        operationId: primary.operationId ?? undefined,
        correlationId: primary.correlationId,
        actorId: primary.actorId,
        actorRole: primary.actorRoleAtTime,
        actor: {
          id: primary.actorId,
          name: name || primary.actorId || "No actor recorded",
          role: primary.actorRoleAtTime,
          attribution: name
            ? "CURRENT"
            : primary.actorId
              ? "UNAVAILABLE"
              : "UNKNOWN",
        },
        source: primary.source,
        event: primary.event,
        action: main.action,
        outcome: "SUCCESS",
        subjectId: primary.subjectId,
        target: { ...main.target, label: primary.employeeName?.trim() || null },
        message: [
          `${main.action} ${main.target.type.toLowerCase()}`,
          primary.employeeName?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        effects,
        changes: [],
        createdAt: primary.createdAt,
        endpoint: null,
        requestId: null,
        status: null,
        failureCode: null,
        failureReason: null,
      },
    ]
  })
}
