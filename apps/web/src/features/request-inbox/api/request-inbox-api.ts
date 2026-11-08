import { apiRequest } from "@/features/auth/api/auth-api"
import type {
  BookedService,
  BookingDetails,
} from "@/features/bookings/api/bookings-api"

export type InboxRequest = BookedService & {
  client: {
    fullName: string | null
    email: string
    contactNumber: string | null
  }
}
export type InboxList = {
  department: { id: string; name: string }
  serviceRequests: InboxRequest[]
  total: number
  page: number
  pageSize: number
}
export type InboxView =
  | "pending"
  | "under-review"
  | "all"
  | "awaiting-information"
  | "ready-for-quotation"
  | "closed"
  | "cancelled"
export type InboxSort =
  "createdAt" | "reference" | "service" | "client" | "status"

export function listInbox(filters: {
  signal?: AbortSignal
  search: string
  view: InboxView
  page: number
  sortBy: InboxSort
  sortDir: "asc" | "desc"
}): Promise<InboxList> {
  const query = new URLSearchParams({
    search: filters.search,
    view: filters.view,
    page: String(filters.page),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  })
  return apiRequest(`/api/request-inbox?${query}`, { signal: filters.signal })
}
export async function getInboxRequest(id: string): Promise<BookingDetails> {
  const result = await apiRequest<{ serviceRequest: BookingDetails }>(
    `/api/request-inbox/${encodeURIComponent(id)}`,
  )
  return result.serviceRequest
}
export async function acceptInboxRequest(id: string): Promise<InboxRequest> {
  const result = await apiRequest<{ serviceRequest: InboxRequest }>(
    `/api/request-inbox/${encodeURIComponent(id)}/accept`,
    { method: "POST" },
  )
  return result.serviceRequest
}
export async function declineInboxRequest(id: string): Promise<InboxRequest> {
  const result = await apiRequest<{ serviceRequest: InboxRequest }>(
    `/api/request-inbox/${encodeURIComponent(id)}/decline`,
    { method: "POST" },
  )
  return result.serviceRequest
}
export async function deleteInboxRequest(id: string): Promise<void> {
  await apiRequest<unknown>(`/api/request-inbox/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
