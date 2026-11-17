import { apiRequest } from "@/features/auth/api/auth-api"
import type { Role } from "@/features/auth/model/roles"

export type ServiceLogSource = "catalog" | "requests" | "workflow" | "workload"
export type ServiceLogActor = {
  id: string | null
  name: string
  role: Role | null
  attribution: "RECORDED" | "CURRENT" | "UNAVAILABLE" | "SYSTEM"
}
export type ServiceLogChangeValue = string | number | boolean | null
export type ServiceLogChange = {
  field: string
  before: ServiceLogChangeValue
  after: ServiceLogChangeValue
}
export type ServiceLog = {
  endpoint: string | null
  id: string
  event: string
  action: string | null
  source: ServiceLogSource
  outcome: "SUCCESS" | "FAILURE"
  actorId: string | null
  actorRole: string | null
  actor: ServiceLogActor
  message: string
  target: {
    id: string | null
    type: string | null
    label: string | null
  }
  changes: ServiceLogChange[]
  subjectId: string | null
  requestId: string | null
  correlationId: string
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
export function getServiceLogs(
  filters: LogFilters,
  page: number,
  signal: AbortSignal,
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  )
  query.set("page", String(page))
  return apiRequest<{
    events: ServiceLog[]
    total: number
    page: number
    pageSize: number
    asOf: string
    retentionDays: number
  }>(`/api/service-operation-logs?${query}`, { signal })
}
