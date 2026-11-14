import { apiRequest } from "@/features/auth/api/auth-api"

export type AttendanceBreak = {
  id: string
  startedAt: string
  endedAt: string | null
  isPaid: boolean
}
export type AttendanceSession = {
  id: string
  startedAt: string
  endedAt: string | null
  breaks: AttendanceBreak[]
}
export type AttendanceWorkday = {
  employee?: AttendanceEmployee & { department?: { name: string } | null }
  pendingCorrections: number
  id: string | null
  employeeId: string
  workDate: string
  timeZone: string
  isWorkingDay: boolean
  requiredMinutes: number
  workedMilliseconds: number
  workedHours: number
  remainingMinutes: number
  excessMinutes: number
  excessRequiresReview: boolean
  progressPercent: number | null
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "HOURS_MET"
    | "INCOMPLETE"
    | "COMPLETE"
    | "NOT_REQUIRED"
  isComplete: boolean
  activeSessionId: string | null
  activeBreakId: string | null
  sessions: AttendanceSession[]
  policy: {
    id: string
    name: string
    unpaidBreaksEnabled: boolean
    overnightRequiresReview: boolean
  }
  overnightRequiresReview: boolean
}
export type AttendanceState = {
  asOf: string
  employeeId: string
  needsPolicy: boolean
  workday: AttendanceWorkday | null
}
export type Paging = { total: number; page: number; pageSize: number }
export type AttendanceHistory = Paging & {
  asOf: string
  employeeId: string
  workdays: AttendanceWorkday[]
}
export type AttendanceEmployee = {
  id: string
  fullName: string
  employeeId: string
  departmentId: string | null
}
export type AttendanceAdjustment = {
  type: "CORRECTION" | "OVERTIME"
  overtimeMinutes: number
  verifiedById: string | null
  verificationNote: string | null
  id: string
  employeeId: string
  sessionId: string | null
  reason: string
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED"
  proposedStartedAt: string
  proposedEndedAt: string
  createdAt: string
  reviewNote: string | null
  requestedById: string
  employee: AttendanceEmployee
  reviewedBy: { id: string; fullName: string | null } | null
}
export type PolicyDay = {
  weekday: number
  isWorkingDay: boolean
  requiredMinutes: number
}
export type AttendancePolicy = {
  id: string
  archivedAt?: string | null
  name: string
  timeZone: string
  unpaidBreaksEnabled: boolean
  overnightRequiresReview: boolean
  days: PolicyDay[]
  _count?: { assignments: number }
}
export type AttendanceOverview = {
  asOf: string
  scope: "DEPARTMENT" | "ORGANIZATION"
  recordedDays: number
  employees: number
  workedHours: number
  requiredHours: number
  completeDays: number
  activeSessions: number
  excessDays: number
  pendingCorrections: number
  overnightReviews: number
  statusBreakdown: Record<AttendanceWorkday["status"], number>
}
export type AttendanceMutation =
  | { action: "clock-in"; workdayId?: string }
  | { action: "clock-out" | "break-start"; sessionId: string }
  | { action: "break-end"; sessionId: string; breakId: string }
const root = "/api/attendance"
export const currentAttendance = (signal?: AbortSignal) =>
  apiRequest<AttendanceState>(`${root}/me/current`, { signal })
export function mutateAttendance(input: AttendanceMutation) {
  const { action, ...body } = input
  const path =
    action === "break-start"
      ? "breaks/start"
      : action === "break-end"
        ? "breaks/end"
        : action
  return apiRequest<AttendanceState>(`${root}/me/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
export function attendanceHistory(
  from: string,
  to: string,
  page: number,
  signal?: AbortSignal,
  employeeId?: string,
) {
  const path = employeeId
    ? `employees/${encodeURIComponent(employeeId)}/history`
    : "me/history"
  return apiRequest<AttendanceHistory>(
    `${root}/${path}?${new URLSearchParams({ from, to, page: String(page) })}`,
    { signal },
  )
}
export const attendanceEmployees = (
  search: string,
  page: number,
  signal?: AbortSignal,
  departmentId = "",
) =>
  apiRequest<Paging & { employees: AttendanceEmployee[] }>(
    `${root}/employees?${new URLSearchParams({ search, page: String(page), departmentId })}`,
    { signal },
  )

export async function attendancePolicyEmployees(signal?: AbortSignal) {
  const first = await attendanceEmployees("", 1, signal)
  const employees = [...first.employees]
  const pages = Math.ceil(first.total / first.pageSize)
  for (let page = 2; page <= pages; page += 1) {
    const result = await attendanceEmployees("", page, signal)
    employees.push(...result.employees)
  }
  return employees
}

export type AttendanceAuditEvent = {
  id: string
  entityType: string
  action: string
  reason: string
  createdAt: string
  actorId: string | null
  actor: { fullName: string | null } | null
  employee: { fullName: string } | null
  before: unknown
  after: unknown
}
export const attendanceDepartments = (signal?: AbortSignal) =>
  apiRequest<{ departments: { id: string; name: string }[] }>(
    `${root}/departments`,
    { signal },
  )
export function attendanceMonitoring(
  from: string,
  to: string,
  page: number,
  employeeId: string,
  departmentId: string,
  signal?: AbortSignal,
) {
  return apiRequest<Paging & { asOf: string; workdays: AttendanceWorkday[] }>(
    `${root}/records?${new URLSearchParams({ from, to, page: String(page), employeeId, departmentId })}`,
    { signal },
  )
}
export function attendanceAudit(
  from: string,
  to: string,
  page: number,
  employeeId: string,
  departmentId: string,
  signal?: AbortSignal,
) {
  return apiRequest<Paging & { events: AttendanceAuditEvent[] }>(
    `${root}/audit?${new URLSearchParams({ from, to, page: String(page), employeeId, departmentId })}`,
    { signal },
  )
}
export const attendanceOverview = (
  from: string,
  to: string,
  departmentId = "",
  signal?: AbortSignal,
) =>
  apiRequest<AttendanceOverview>(
    `${root}/overview?${new URLSearchParams({ from, to, departmentId })}`,
    { signal },
  )
export const attendancePolicies = (signal?: AbortSignal) =>
  apiRequest<{ policies: AttendancePolicy[] }>(`${root}/policies`, { signal })
export const createAttendancePolicy = (input: AttendancePolicyInput) =>
  apiRequest(`${root}/policies`, {
    method: "POST",
    body: JSON.stringify(input),
  })
export type AttendancePolicyInput = Omit<
  AttendancePolicy,
  "id" | "_count" | "archivedAt"
>
export const updateAttendancePolicy = (
  id: string,
  input: AttendancePolicyInput,
) =>
  apiRequest(`${root}/policies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
export const archiveAttendancePolicy = (id: string, archive: boolean) =>
  apiRequest(
    `${root}/policies/${encodeURIComponent(id)}/${archive ? "archive" : "restore"}`,
    { method: "POST" },
  )
export const deleteAttendancePolicy = (id: string) =>
  apiRequest(`${root}/policies/${encodeURIComponent(id)}`, { method: "DELETE" })
export type AttendancePolicyAssignment = {
  id: string
  employee: AttendanceEmployee & { department: { name: string } | null }
  effectiveFrom: string
  effectiveUntil: string | null
  status: "CURRENT" | "SCHEDULED" | "ENDED"
}
export const attendancePolicyAssignments = (
  id: string,
  page: number,
  signal?: AbortSignal,
) =>
  apiRequest<Paging & { assignments: AttendancePolicyAssignment[] }>(
    `${root}/policies/${encodeURIComponent(id)}/assignments?${new URLSearchParams({ page: String(page) })}`,
    { signal },
  )
export const assignAttendancePolicy = (input: {
  employeeId: string
  policyId: string
  effectiveFrom: string
}) =>
  apiRequest(`${root}/assignments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
export const attendanceAdjustments = (
  scope: "mine" | "team",
  page: number,
  search = "",
  signal?: AbortSignal,
  type = "",
) =>
  apiRequest<Paging & { adjustments: AttendanceAdjustment[] }>(
    `${root}/adjustments?${new URLSearchParams({
      scope,
      page: String(page),
      search,
      type,
    })}`,
    { signal },
  )
export const requestAttendanceAdjustment = (input: {
  type?: "CORRECTION" | "OVERTIME"
  requestKey: string
  sessionId?: string
  startedAt: string
  endedAt: string
  reason: string
}) =>
  apiRequest(`${root}/adjustments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
export const reviewAttendanceAdjustment = (
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
) =>
  apiRequest(`${root}/adjustments/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  })
