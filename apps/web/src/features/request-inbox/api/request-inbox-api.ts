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
export type InboxView = "pending" | "under-review"

export function listInbox(filters: {
  search: string
  view: InboxView
  page: number
}): Promise<InboxList> {
  const query = new URLSearchParams({
    search: filters.search,
    view: filters.view,
    page: String(filters.page),
  })
  return apiRequest(`/api/request-inbox?${query}`)
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
