import { apiRequest } from "@/features/auth/api/auth-api"

export type Client = {
  id: string
  fullName: string | null
  email: string
  contactNumber: string | null
  isActive: boolean
  createdAt: string
}
export type ClientDetails = Pick<
  Client,
  "id" | "fullName" | "email" | "contactNumber" | "isActive" | "createdAt"
>
export type ClientServiceRequest = {
  id: string
  title: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  createdAt: string
  service: { id: string; name: string }
}
export type ClientProject = {
  id: string
  name: string
  status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
  startDate: string | null
  createdAt: string
}
export type ClientPage<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
}
export type ClientSort = "fullName" | "email" | "isActive" | "createdAt"
export type ClientStatus = "" | "ACTIVE" | "INACTIVE"
export type ClientList = {
  clients: Client[]
  total: number
  page: number
  pageSize: number
}
export type ClientFilters = {
  page: number
  search: string
  status: ClientStatus
  sortBy: ClientSort
  sortOrder: "asc" | "desc"
}

export function listClients(filters: ClientFilters): Promise<ClientList> {
  const params = new URLSearchParams({
    page: String(filters.page),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  if (filters.search) params.set("search", filters.search)
  if (filters.status) params.set("status", filters.status)
  return apiRequest<ClientList>(`/api/clients?${params}`)
}

export async function getClientDetails(id: string): Promise<{
  client: ClientDetails
  serviceRequestCount: number
  projectCount: number
}> {
  return apiRequest(`/api/clients/${encodeURIComponent(id)}`)
}

export async function listClientServiceRequests(
  id: string,
  page: number,
): Promise<ClientPage<ClientServiceRequest>> {
  const result = await apiRequest<{
    serviceRequests: ClientServiceRequest[]
    total: number
    page: number
    pageSize: number
  }>(`/api/clients/${encodeURIComponent(id)}/service-requests?page=${page}`)
  return { ...result, rows: result.serviceRequests }
}

export async function listClientProjects(
  id: string,
  page: number,
): Promise<ClientPage<ClientProject>> {
  const result = await apiRequest<{
    projects: ClientProject[]
    total: number
    page: number
    pageSize: number
  }>(`/api/clients/${encodeURIComponent(id)}/projects?page=${page}`)
  return { ...result, rows: result.projects }
}
