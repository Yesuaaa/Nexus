import { apiRequest } from "@/features/auth/api/auth-api"
import type { Role } from "@/features/auth/model/roles"

export type AuditLogActor = {
  id: string | null
  name: string
  role: Role | null
  attribution: "RECORDED" | "CURRENT" | "UNAVAILABLE" | "SYSTEM" | "UNKNOWN"
}
export type AuditLogChangeValue = string | number | boolean | null
export type AuditLogChange = {
  field: string
  before: AuditLogChangeValue
  after: AuditLogChangeValue
}
export type AuditLogEffect = {
  id: string
  action: string
  target: {
    id: string
    type: string
    label: string | null
  }
  changes: ({ field: string } | AuditLogChange)[]
  notes: { label: string; value: string }[]
}
export type AuditLog = {
  endpoint: string | null
  id: string
  event: string
  action: string | null
  source: string
  outcome: "SUCCESS" | "FAILURE"
  actorId: string | null
  actorRole: string | null
  actor: AuditLogActor
  message: string
  summaryDetail?: string | null
  target: {
    id: string | null
    type: string | null
    label: string | null
  }
  changes: AuditLogChange[]
  effects?: AuditLogEffect[]
  subjectId: string | null
  requestId: string | null
  projectId?: string | null
  projectName?: string | null
  workspaceId?: string | null
  correlationId: string | null
  operationId?: string
  status: number | null
  failureCode: string | null
  failureReason: string | null
  createdAt: string
}
export type LogFilters = Record<
  | "from"
  | "to"
  | "outcome"
  | "source"
  | "event"
  | "actorId"
  | "subjectId"
  | "requestId"
  | "correlationId"
  | "search",
  string
>
export function getAuditLogs(
  endpoint:
    | "/api/service-operation-logs"
    | "/api/project-management-logs"
    | "/api/people-hr-logs"
    | "/api/workforce-compliance-logs",
  filters: LogFilters,
  page: number,
  signal: AbortSignal,
  timeWindow?: { snapshot?: string; asOf?: string; range?: "24h" | "7d" },
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  )
  query.set("page", String(page))
  if (timeWindow?.snapshot) query.set("snapshot", timeWindow.snapshot)
  if (timeWindow?.asOf) query.set("asOf", timeWindow.asOf)
  if (timeWindow?.range) query.set("range", timeWindow.range)
  return apiRequest<{
    events: AuditLog[]
    total: number
    page: number
    pageSize: number
    snapshot?: string
    asOf: string
    retentionDays: number | null
  }>(`${endpoint}?${query}`, { signal })
}
