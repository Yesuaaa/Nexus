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
const scheduleMode = (value: unknown) =>
  value === "FIXED"
    ? "Fixed schedule"
    : value === "FLEXIBLE"
      ? "Flexible"
      : null
const clockTime = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < 1440
    ? `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
    : null
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
  AttendanceWorkday: [
    ["workDate", "Work date", isoDate],
    ...scheduleFields,
    ["scheduledStartAt", "Scheduled start", isoDate],
    ["scheduledEndAt", "Scheduled end", isoDate],
    ["scheduledUnpaidBreakMinutes", "Scheduled unpaid break minutes", number],
  ],
  AttendanceWorkSession: [
    ...sessionFields,
    ["suspendedAt", "Suspension time", isoDate],
  ],
  AttendanceBreak: [...sessionFields, ["isPaid", "Paid break", boolean]],
  AttendancePolicy: [
    ["name", "Policy name"],
    ["timeZone", "Time zone", zone],
    ["scheduleMode", "Schedule type", scheduleMode],
    ["archivedAt", "Archived at", isoDate],
    ["unpaidBreaksEnabled", "Unpaid breaks enabled", boolean],
    ["overnightRequiresReview", "Overnight review required", boolean],
  ],
  AttendancePolicyDay: [
    ["weekday", "Weekday", number],
    ...scheduleFields,
    ["scheduledStartMinute", "Scheduled start", clockTime],
    ["scheduledEndMinute", "Scheduled end", clockTime],
    ["scheduledUnpaidBreakMinutes", "Scheduled unpaid break minutes", number],
  ],
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
  EmployeeDepartmentPlacement: [["departmentId", "Department ID", recordId]],
  LeaveRequest: [["status", "Status", status]],
}

const entityLabels: Record<string, string> = {
  AttendanceWorkday: "Attendance workday",
  AttendanceWorkSession: "Attendance session",
  AttendanceBreak: "Break",
  AttendancePolicy: "Attendance policy",
  AttendancePolicyDay: "Policy weekday",
  AttendancePolicyAssignment: "Policy assignment",
  EmployeeDepartmentPlacement: "Employee department placement",
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
      if (isDeepStrictEqual(previous[key] ?? null, next[key] ?? null)) return []
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
  if (row.entityType === "EmployeeDepartmentPlacement") return -1
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

function describeWorkforceActivity(row: ComplianceHistoryRow, type: string) {
  const previous = snapshot(row.before)
  const next = snapshot(row.after)
  const employee = row.employeeName?.trim()
  const forEmployee = employee ? ` for ${employee}` : ""
  if (row.entityType === "EmployeeDepartmentPlacement")
    return `Changed department placement${forEmployee}.`
  const started = row.event === "CREATED" && next.endedAt === null
  const ended =
    row.event === "UPDATED" &&
    previous.endedAt === null &&
    isoDate(next.endedAt)
  if (row.entityType === "AttendanceWorkSession") {
    if (started)
      return `${row.operationId ? "Recorded clock-in" : "Started an attendance session"}${forEmployee}.`
    if (
      row.event === "UPDATED" &&
      previous.endedAt === null &&
      next.endedAt === null &&
      previous.suspendedAt == null &&
      isoDate(next.suspendedAt)
    )
      return `Suspended an open attendance session${forEmployee}.`
    if (ended) {
      // Correction effects take precedence as the primary row. Both punch paths
      // leave the start and suspension fields unchanged when closing a session.
      if (
        row.actorId &&
        row.operationId &&
        row.correlationId &&
        isoDate(previous.startedAt) &&
        previous.startedAt === next.startedAt &&
        previous.suspendedAt === next.suspendedAt
      ) {
        if (
          isoDate(previous.suspendedAt) &&
          (row.actorRoleAtTime === "ADMIN" ||
            row.actorRoleAtTime === "SUPERADMIN")
        )
          return `Reconciled a suspended attendance session${forEmployee}.`
        if (
          previous.suspendedAt === null &&
          (row.actorRoleAtTime === "STAFF" || row.actorRoleAtTime === "ADMIN")
        )
          return `Recorded clock-out${forEmployee}.`
      }
      return `Ended an attendance session${forEmployee}.`
    }
  }
  if (row.entityType === "AttendanceBreak") {
    if (started) return `Started a break${forEmployee}.`
    if (ended) return `Ended a break${forEmployee}.`
  }
  if (
    row.entityType === "AttendancePolicyAssignment" &&
    row.event === "CREATED"
  )
    return `Assigned an attendance policy${forEmployee}.`

  const article = /^[aeiou]/i.test(type) ? "an" : "a"
  return `${eventLabels[row.event]} ${article} ${type.toLowerCase()}${forEmployee}.`
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
    const overtimeSubmitted =
      primary.source === "time-logs" &&
      group.some(
        ({ source, event }) => source === "overtime" && event === "SUBMITTED",
      )
    const scheduleChanged =
      primary.source === "policies" &&
      primary.event === "UPDATED" &&
      group.some(({ entityType }) => entityType === "AttendancePolicyDay")
    const summaryDetail = overtimeSubmitted
      ? "Overtime request also submitted"
      : scheduleChanged
        ? "Weekly schedule changed"
        : primary.source === "policies" && primary.event === "UPDATED"
          ? main.changes.map(({ field }) => field).join(", ") || null
          : null
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
        message: describeWorkforceActivity(primary, main.target.type),
        summaryDetail,
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
