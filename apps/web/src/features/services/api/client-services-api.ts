import { apiRequest } from "@/features/auth/api/auth-api"

export interface DepartmentSummary {
  id: string
  name: string
  code: string | null
  color: string
}

export interface ClientServicePackage {
  id: string
  name: string
  description: string
  includedFeatures: string[]
  pricingModel: string
  currency: string
  amount: string | number | null
  billingInterval: string | null
  isPricingPublic: boolean
  isActive: boolean
  displayOrder: number
  isRecommended: boolean
}

export interface ClientPricingTemplate {
  id: string
  name: string
  pricingModel: string
  currency: string
  amount: string | number | null
  billingInterval: string | null
}

export interface ClientService {
  id: string
  name: string
  description: string
  imagePath: string | null
  imageAltText: string | null
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  departments: DepartmentSummary[]
  pricingTemplate: ClientPricingTemplate | null
  packages: ClientServicePackage[]
}

export interface Specialist {
  id: string
  fullName: string
  position: string | null
  department: DepartmentSummary | null
}

export interface CreateServiceRequestInput {
  serviceId: string
  packageId?: string | null
  preferredSpecialistId?: string | null
  title: string
  description?: string | null
  requirementsPayload?: Record<string, unknown> | null
}

export interface ServiceRequestSummary {
  id: string
  referenceNumber: string
  title: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  packageName?: string | null
  service: { id: string; name: string }
  package?: { id: string; name: string } | null
  preferredSpecialist?: {
    id: string
    fullName: string
    position: string | null
  } | null
  createdAt: string
}

export interface ClientRequestsResponse {
  requests: ServiceRequestSummary[]
  total: number
  page: number
  pageSize: number
}

export async function listClientServices(): Promise<ClientService[]> {
  const result = await apiRequest<{ services: ClientService[] }>(
    "/api/client/services",
  )
  return result.services
}

export async function getClientService(id: string): Promise<ClientService> {
  const result = await apiRequest<{ service: ClientService }>(
    `/api/client/services/${encodeURIComponent(id)}`,
  )
  return result.service
}

export async function getClientServiceSpecialists(
  serviceId: string,
): Promise<Specialist[]> {
  const result = await apiRequest<{ specialists: Specialist[] }>(
    `/api/client/services/${encodeURIComponent(serviceId)}/specialists`,
  )
  return result.specialists
}

export async function submitClientServiceRequest(
  data: CreateServiceRequestInput,
): Promise<{ serviceRequest: ServiceRequestSummary }> {
  return apiRequest<{ serviceRequest: ServiceRequestSummary }>(
    "/api/client/service-requests",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )
}

export async function listMyServiceRequests(
  page = 1,
): Promise<ClientRequestsResponse> {
  return apiRequest<ClientRequestsResponse>(
    `/api/client/service-requests?page=${encodeURIComponent(page)}`,
  )
}
