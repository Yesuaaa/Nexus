import { apiRequest } from "@/features/auth/api/auth-api"

export type ServiceDepartment = {
  id: string
  name: string
  code: string | null
}

export type Service = {
  id: string
  name: string
  description: string
  isActive: boolean
  departments: ServiceDepartment[]
  createdAt: string
  updatedAt: string
}

export type ServiceInput = {
  name: string
  description: string
  departmentIds: string[]
  isActive: boolean
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
