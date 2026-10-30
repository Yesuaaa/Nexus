import type { Schedule } from "./calculation.js"
export class WorkloadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export function check(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new WorkloadError(status, message)
}
export function object(value: unknown): Record<string, unknown> {
  check(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected an object",
  )
  return value as Record<string, unknown>
}
export function text(value: unknown, max = 160) {
  check(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `Provide text between 1 and ${max} characters`,
  )
  return value.trim()
}
export function id(value: unknown) {
  check(
    typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value),
    "Invalid identifier",
  )
  return value
}
export function skills(value: unknown) {
  check(Array.isArray(value) && value.length <= 30, "Provide up to 30 skills")
  return [...new Set(value.map((v) => text(v, 80).toLowerCase()))]
}
export function date(value: unknown) {
  check(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ),
    "Provide an ISO date and time with timezone",
  )
  const result = new Date(value)
  check(Number.isFinite(+result), "Invalid date")
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  check(
    Number.isFinite(+calendarDate) &&
      calendarDate.toISOString().slice(0, 10) === value.slice(0, 10),
    "Invalid calendar date",
  )
  return result
}
export function period(value: Record<string, unknown>) {
  const startsAt = date(value.startsAt),
    endsAt = date(value.endsAt)
  check(
    startsAt < endsAt && +endsAt - +startsAt <= 31 * 86_400_000,
    "The period must be positive and no longer than 31 days",
  )
  return { startsAt, endsAt }
}
export function reportingRange(value: Record<string, unknown>) {
  const start =
    value.start ??
    new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  check(
    typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start),
    "Invalid start date",
  )
  const startsAt = new Date(`${start}T00:00:00+08:00`)
  check(
    Number.isFinite(+startsAt) &&
      new Date(+startsAt + 8 * 3_600_000).toISOString().slice(0, 10) === start,
    "Invalid start date",
  )
  const days = value.days === undefined ? 7 : Number(value.days)
  check(
    value.days === undefined ||
      (typeof value.days === "string" &&
        ["7", "28", "29", "30", "31"].includes(value.days)),
    "Choose a week or a month (28–31 days)",
  )
  return { startsAt, endsAt: new Date(+startsAt + days * 86_400_000) }
}
export function scheduleInput(value: unknown): Schedule[] {
  check(
    Array.isArray(value) && value.length <= 28,
    "Provide up to 28 working shifts",
  )
  const rows = value
    .map((v) => {
      const row = object(v)
      check(
        Number.isInteger(row.weekday) &&
          Number(row.weekday) >= 0 &&
          Number(row.weekday) <= 6 &&
          Number.isInteger(row.startMinute) &&
          Number.isInteger(row.endMinute) &&
          Number(row.startMinute) >= 0 &&
          Number(row.endMinute) <= 1440 &&
          Number(row.startMinute) < Number(row.endMinute),
        "Invalid working shift",
      )
      return {
        weekday: Number(row.weekday),
        startMinute: Number(row.startMinute),
        endMinute: Number(row.endMinute),
      }
    })
    .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
  check(
    !rows.some(
      (row, i) =>
        i > 0 &&
        row.weekday === rows[i - 1].weekday &&
        row.startMinute < rows[i - 1].endMinute,
    ),
    "Working shifts must not overlap",
  )
  return rows
}
export function workInput(value: unknown) {
  const input = object(value),
    range = period(input)
  const estimatedHours = input.estimatedHours
  check(
    typeof estimatedHours === "number" &&
      Number.isFinite(estimatedHours) &&
      estimatedHours > 0 &&
      estimatedHours <= (+range.endsAt - +range.startsAt) / 3_600_000,
    "Estimated hours must fit inside the scheduled block",
  )
  check(
    [input.serviceRequestId, input.projectId, input.taskId].filter(
      (v) => v !== undefined && v !== null && v !== "",
    ).length === 1,
    "Choose exactly one service request, project or task",
  )
  const priority = input.priority ?? "NORMAL"
  check(
    priority === "LOW" ||
      priority === "NORMAL" ||
      priority === "HIGH" ||
      priority === "URGENT",
    "Invalid priority",
  )
  const deadline = input.deadline ? date(input.deadline) : null
  check(
    !deadline || deadline >= range.endsAt,
    "The deadline cannot precede the scheduled block",
  )
  return {
    ...range,
    estimatedHours,
    title: text(input.title),
    requiredSkills: skills(input.requiredSkills ?? []),
    priority: priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
    deadline,
    serviceRequestId: input.serviceRequestId
      ? id(input.serviceRequestId)
      : null,
    projectId: input.projectId ? id(input.projectId) : null,
    taskId: input.taskId ? id(input.taskId) : null,
  }
}
