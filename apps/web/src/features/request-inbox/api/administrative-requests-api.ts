import { apiRequest } from "@/features/auth/api/auth-api"
import type { InboxRequest, InboxSort } from "./request-inbox-api"
import type { AdministrativeWorkflow } from "@/features/request-workflow/model/administrative-workflow"

export type AdministrativeRequest = InboxRequest & {
  acceptedBy: { id: string; fullName: string | null } | null
  acceptedDepartment: {
    id: string
    name: string
    head: { id: string; fullName: string | null } | null
  } | null
  service: InboxRequest["service"] & {
    departments: { id: string; name: string }[]
  }
  workflow: { state: string; updatedAt: string } | null
  project: {
    id: string
    name: string
    status: string
    staff: {
      isTeamLead: boolean
      employee: { id: string; fullName: string; position: string | null }
    }[]
  } | null
  capabilities: {
    read: boolean
    accept: false
    reject: false
    staff: false
    approveQuotation: false
    verifyPayment: false
    mutateWorkflow: false
    participate: false
    downloadFiles: false
  }
}
export function listAdministrativeRequests(
  filters: {
    search: string
    status: string
    departmentId: string
    page: number
    sortBy: InboxSort
    sortDir: "asc" | "desc"
  },
  signal: AbortSignal,
) {
  return apiRequest<{
    serviceRequests: AdministrativeRequest[]
    departments: { id: string; name: string }[]
    total: number
    page: number
    pageSize: number
  }>(
    `/api/administrative-requests?${new URLSearchParams({ ...filters, page: String(filters.page) })}`,
    { signal },
  )
}
export function getAdministrativeRequest(id: string, signal: AbortSignal) {
  return apiRequest<{
    serviceRequest: AdministrativeRequest & {
      workflowInspection: AdministrativeWorkflow
    }
  }>(`/api/administrative-requests/${encodeURIComponent(id)}`, { signal })
}
