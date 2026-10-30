import { apiRequest } from "@/features/auth/api/auth-api"

export type PricingModel =
  "FIXED" | "STARTING" | "CUSTOM_QUOTE" | "RECURRING" | "HOURLY"

export type BillingInterval = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

export type ServiceDepartment = {
  id: string
  name: string
  code: string | null
}

export type PricingTemplate = {
  id: string
  name: string
  pricingModel: PricingModel
  currency: string
  amount: string | null
  billingInterval: BillingInterval | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type ServicePackage = {
  id: string
  name: string
  description: string
  includedFeatures: string[]
  pricingModel: PricingModel
  currency: string
  amount: string | null
  billingInterval: BillingInterval | null
  isPricingPublic: boolean
  isActive: boolean
  displayOrder: number
  isRecommended: boolean
  createdAt: string
  updatedAt: string
}

export type Service = {
  id: string
  name: string
  description: string
  imageUrl: string | null
  imageAltText: string | null
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  isActive: boolean
  pricingTemplateId: string | null
  pricingTemplate: PricingTemplate | null
  packages: ServicePackage[]
  departments: ServiceDepartment[]
  createdAt: string
  updatedAt: string
}

export type PricingConfigurationInput = {
  name: string
  pricingModel: PricingModel
  currency: string
  amount: number | null
  billingInterval: BillingInterval | null
  isPublic: boolean
}

export type ServicePackageInput = {
  id?: string
  name: string
  description: string
  includedFeatures: string[]
  pricingModel: PricingModel
  currency: string
  amount: number | null
  billingInterval: BillingInterval | null
  isPricingPublic: boolean
  isActive: boolean
  displayOrder: number
  isRecommended: boolean
}

export type ServiceInput = {
  name: string
  description: string
  departmentIds: string[]
  isActive: boolean
  imageDataUrl: string | null
  imageAltText: string | null
  removeImage: boolean
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  pricingTemplateId: string | null
  pricingTemplate: PricingConfigurationInput | null
  packages: ServicePackageInput[]
}

export async function listServices(): Promise<Service[]> {
  const result = await apiRequest<{ services: Service[] }>("/api/services")
  return result.services
}

export async function listAvailableServices(): Promise<Service[]> {
  const result = await apiRequest<{ services: Service[] }>(
    "/api/services/available",
  )
  return result.services
}

export async function listPricingTemplates(): Promise<PricingTemplate[]> {
  const result = await apiRequest<{ pricingTemplates: PricingTemplate[] }>(
    "/api/services/pricing-templates",
  )
  return result.pricingTemplates
}

export async function createService(input: ServiceInput): Promise<Service> {
  const result = await apiRequest<{ service: Service }>("/api/services", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.service
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<Service> {
  const result = await apiRequest<{ service: Service }>(
    `/api/services/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(input) },
  )
  return result.service
}

export async function changeServiceStatus(
  id: string,
  isActive: boolean,
): Promise<Service> {
  const result = await apiRequest<{ service: Service }>(
    `/api/services/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: JSON.stringify({ isActive }) },
  )
  return result.service
}

export async function deleteService(id: string): Promise<void> {
  await apiRequest(`/api/services/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
