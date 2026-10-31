import { apiRequest } from "@/features/auth/api/auth-api"
import type { ServiceRequestStatus } from "@/features/services/api/services-api"

export type BookedService = {
  id: string
  referenceNumber?: string | null
  title: string
  status: ServiceRequestStatus
  acceptedDepartmentId?: string | null
  packageName: string | null
  expectedTimeline: string
  preferredSpecialistName: string | null
  createdAt: string
  updatedAt: string
  service: { id: string; name: string }
}

export type BookingDetails = BookedService & {
  projectGoals: string
  projectRequirements: string
  additionalDetails: string | null
}

export type BookingList = {
  serviceRequests: BookedService[]
  total: number
  page: number
  pageSize: number
}

export function listBookedServices(filters: {
  search: string
  status: string
  page: number
}): Promise<BookingList> {
  const query = new URLSearchParams({
    search: filters.search,
    status: filters.status,
    page: String(filters.page),
  })
  return apiRequest(`/api/service-requests?${query}`)
}

export async function getBooking(id: string): Promise<BookingDetails> {
  const result = await apiRequest<{ serviceRequest: BookingDetails }>(
    `/api/service-requests/${encodeURIComponent(id)}`,
  )
  return result.serviceRequest
}
