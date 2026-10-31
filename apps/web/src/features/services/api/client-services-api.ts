import { apiRequest } from "@/features/auth/api/auth-api"
import type {
  Service,
  ServiceSpecialist,
  ServiceRequestReceipt,
  PricingModel,
  BillingInterval,
  ServiceRequestStatus,
} from "./services-api"
import type { ProjectRequirementsDraft } from "../model/project-requirements"

export type { ServiceRequestStatus } from "./services-api"
export interface ServiceRequestSummary {
  id: string
  referenceNumber: string | null
  title: string
  description: string | null
  status: ServiceRequestStatus
  acceptedDepartmentId?: string | null
  packageName: string | null
  preferredSpecialistName: string | null
  projectGoals: string
  projectRequirements: string
  expectedTimeline: string
  additionalDetails: string | null
  pricingModel: PricingModel | null
  quotedPrice: string | null
  currency: string | null
  billingInterval: BillingInterval | null
  service: { id: string; name: string }
  package: { id: string; name: string } | null
  preferredSpecialist: {
    id: string
    fullName: string
    position: string | null
  } | null
  createdAt: string
  updatedAt: string
}
export interface ClientRequestsResponse {
  requests: ServiceRequestSummary[]
  total: number
  page: number
  pageSize: number
  summary: {
    total: number
    pending: number
    inProgress: number
    completed: number
    cancelled: number
  }
}
export async function listClientServices(): Promise<Service[]> {
  const result = await apiRequest<{ services: Service[] }>(
    "/api/client/services",
  )
  return result.services
}
export async function getClientService(id: string): Promise<Service> {
  const result = await apiRequest<{ service: Service }>(
    `/api/client/services/${encodeURIComponent(id)}`,
  )
  return result.service
}
export async function getClientServiceSpecialists(
  serviceId: string,
): Promise<ServiceSpecialist[]> {
  const result = await apiRequest<{ specialists: ServiceSpecialist[] }>(
    `/api/client/services/${encodeURIComponent(serviceId)}/specialists`,
  )
  return result.specialists
}
export async function submitClientServiceRequest(
  data: ProjectRequirementsDraft & {
    serviceId: string
    packageId: string | null
    preferredSpecialistId: string | null
    submissionKey: string
  },
): Promise<ServiceRequestReceipt> {
  const result = await apiRequest<{ serviceRequest: ServiceRequestReceipt }>(
    "/api/client/service-requests",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )
  return result.serviceRequest
}
export async function listMyServiceRequests(filters: {
  page: number
  search?: string
  status?: ServiceRequestStatus | ""
  sortOrder?: "asc" | "desc"
}): Promise<ClientRequestsResponse> {
  const params = new URLSearchParams({ page: String(filters.page) })
  if (filters.search) params.set("search", filters.search)
  if (filters.status) params.set("status", filters.status)
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder)
  return apiRequest<ClientRequestsResponse>(
    `/api/client/service-requests?${params}`,
  )
}
