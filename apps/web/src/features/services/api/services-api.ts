import { apiRequest } from "@/features/auth/api/auth-api"
import type { DepartmentColor } from "@/features/departments/model/department-color"
import type { ProjectRequirementsDraft } from "../model/project-requirements"

export type ServiceRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AWAITING_CLIENT_INFO"
  | "READY_FOR_QUOTATION"
  | "CLOSED"
  | "CANCELLED"

export type ServiceRequestReceipt = {
  id: string
  referenceNumber?: string | null
  status: ServiceRequestStatus
  createdAt: string
}

export async function submitServiceRequest(
  input: ProjectRequirementsDraft & {
    serviceId: string
    packageId: string | null
    preferredSpecialistId: string | null
    submissionKey: string
  },
): Promise<ServiceRequestReceipt> {
  const result = await apiRequest<{ serviceRequest: ServiceRequestReceipt }>(
    "/api/service-requests",
    { method: "POST", body: JSON.stringify(input) },
  )
  return result.serviceRequest
}

export type PricingModel =
  "FIXED" | "STARTING" | "CUSTOM_QUOTE" | "RECURRING" | "HOURLY"

export type BillingInterval = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

export type ServiceIconKey =
  | "social"
  | "advertising"
  | "business"
  | "video"
  | "code"
  | "search"
  | "email"
  | "design"
  | "sparkles"

export type ServiceSpecialist = {
  id: string
  fullName: string
  position: string | null
  department: { id: string; name: string } | null
}

export type SpecialistPortfolioProject = {
  id: string
  title: string
  summary: string
  contribution: string | null
  thumbnailUrl: string | null
  projectUrl: string | null
}

export type SpecialistSocialLink = {
  platform: string
  url: string
}

export type ServiceSpecialistProfile = ServiceSpecialist & {
  bio: string | null
  imageUrl: string | null
  specialties: string[]
  socialLinks: SpecialistSocialLink[]
  projects: SpecialistPortfolioProject[]
}

export async function getServiceSpecialistProfile(
  serviceId: string,
  specialistId: string,
): Promise<ServiceSpecialistProfile> {
  const result = await apiRequest<{ specialist: ServiceSpecialistProfile }>(
    `/api/services/${encodeURIComponent(serviceId)}/specialists/${encodeURIComponent(specialistId)}`,
  )
  return result.specialist
}

export async function listServiceSpecialists(
  serviceId: string,
): Promise<ServiceSpecialist[]> {
  const result = await apiRequest<{ specialists: ServiceSpecialist[] }>(
    `/api/services/${encodeURIComponent(serviceId)}/specialists`,
  )
  return result.specialists
}

export type ServiceDepartment = {
  id: string
  name: string
  code: string | null
  color: DepartmentColor
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

export type ServiceBenefit = {
  id: string
  title: string
  description: string
  displayOrder: number
}

export type Service = {
  id: string
  name: string
  description: string
  iconKey: ServiceIconKey
  imageUrl: string | null
  imageAltText: string | null
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  keyBenefits: ServiceBenefit[]
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

export type ServiceBenefitInput = {
  title: string
  description: string
}

export type ServiceInput = {
  name: string
  description: string
  iconKey: ServiceIconKey
  departmentIds: string[]
  isActive: boolean
  imageDataUrl: string | null
  imageAltText: string | null
  removeImage: boolean
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  keyBenefits: ServiceBenefitInput[]
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
