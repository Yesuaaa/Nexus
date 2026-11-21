import { apiRequest } from "@/features/auth/api/auth-api"

export type LeaveType = "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID" | "OTHER"
export type LeaveStatus =
  "SUBMITTED" | "VERIFIED" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVERSED"

export type LeaveDay = {
  id: string
  workDate: string
  timeZone: string
  policyName: string
  baseRequiredMinutes: number
  leaveMinutes: number
}

export type LeaveDecision = {
  id: string
  action: LeaveStatus
  note: string | null
  version: number
  createdAt: string
  actor: { id: string; fullName: string | null }
}

export type LeaveRequest = {
  id: string
  employeeId: string
  requestedById: string
  routeDepartmentId: string | null
  type: LeaveType
  reason: string
  startDate: string
  endDate: string
  status: LeaveStatus
  version: number
  createdAt: string
  updatedAt: string
  verifiedAt: string | null
  employee: {
    id: string
    employeeId: string
    fullName: string
    departmentId: string | null
    department: { id: string; name: string; headId: string | null } | null
  }
  days: LeaveDay[]
  decisions: LeaveDecision[]
  capabilities: {
    cancel: boolean
    verify: boolean
    approve: boolean
    reject: boolean
    reverse: boolean
    fallback: boolean
    requiresReverification: boolean
  }
}

export type LeavePage = {
  requests: LeaveRequest[]
  capabilities: { submit: boolean }
  total: number
  page: number
  pageSize: number
}

export type LeavePreview = {
  days: Omit<LeaveDay, "id">[]
  totalMinutes: number
}

const root = "/api/leave"

export const leaveDetail = (id:string,signal?:AbortSignal)=>apiRequest<{request:LeaveRequest}>(`/api/leave/requests/${encodeURIComponent(id)}`,{signal})

export function leaveRequests(
  scope: "mine" | "team",
  page: number,
  search: string,
  type: string,
  status: string,
  signal?: AbortSignal,
  from = "",
  to = "",
) {
  return apiRequest<LeavePage>(
    `${root}/requests?${new URLSearchParams({
      scope,
      page: String(page),
      search,
      type,
      status,
      ...(from && to ? { from, to } : {}),
    })}`,
    { signal },
  )
}

export function leaveOverview(scope: "mine" | "team", signal?: AbortSignal) {
  return apiRequest<{
    groups: { status: LeaveStatus; type: LeaveType; count: number }[]
  }>(`${root}/overview?${new URLSearchParams({ scope })}`, { signal })
}

export function previewLeave(
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
) {
  return apiRequest<LeavePreview>(`${root}/preview`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate }),
    signal,
  })
}

export function submitLeave(input: {
  requestKey: string
  type: LeaveType
  reason: string
  startDate: string
  endDate: string
}) {
  return apiRequest<{ request: LeaveRequest }>(`${root}/requests`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type LeaveAction = "verify" | "approve" | "reject" | "cancel" | "reverse"

export function actOnLeave(
  id: string,
  action: LeaveAction,
  input: { actionId: string; expectedVersion: number; note: string },
) {
  return apiRequest<{ request: LeaveRequest }>(
    `${root}/requests/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: JSON.stringify(input) },
  )
}
