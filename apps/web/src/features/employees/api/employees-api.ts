import { apiRequest } from "@/features/auth/api/auth-api"

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN"
export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE"

export type Employee = {
  id: string
  employeeId: string
  fullName: string
  email: string | null
  contactNumber: string | null
  position: string | null
  employmentType: EmploymentType
  status: EmploymentStatus
  startDate: string | null
  departmentId: string | null
  teamId: string | null
  userId: string | null
  department: { id: string; name: string; code: string | null } | null
  team: { id: string; name: string } | null
  user: {
    id: string
    email: string
    fullName: string | null
    role: "SUPERADMIN" | "ADMIN" | "STAFF" | "USER"
    isActive: boolean
  } | null
  createdAt: string
  updatedAt: string
}

export type EmployeeInput = {
  employeeId?: string
  fullName?: string
  email?: string | null
  contactNumber?: string | null
  position?: string | null
  employmentType?: EmploymentType
  status?: EmploymentStatus
  startDate?: string | null
  departmentId?: string | null
  teamId?: string | null
  userId?: string | null
}

export type EmployeeList = {
  employees: Employee[]
  total: number
  page: number
  pageSize: number
}

export type EmployeeAccountOption = {
  id: string
  email: string
  fullName: string | null
  role: "ADMIN" | "STAFF" | "USER"
  isActive: boolean
}

export type EmployeeAccountOptions = {
  users: EmployeeAccountOption[]
  total: number
  page: number
  pageSize: number
}

export async function listEmployees(filters: {
  search?: string
  departmentId?: string
  employmentType?: EmploymentType | ""
  status?: EmploymentStatus | ""
  page: number
}): Promise<EmployeeList> {
  const params = new URLSearchParams({ page: String(filters.page) })
  if (filters.search) params.set("search", filters.search)
  if (filters.departmentId) params.set("departmentId", filters.departmentId)
  if (filters.employmentType)
    params.set("employmentType", filters.employmentType)
  if (filters.status) params.set("status", filters.status)
  return apiRequest<EmployeeList>(`/api/employees?${params}`)
}

export async function getEmployee(id: string): Promise<Employee> {
  const result = await apiRequest<{ employee: Employee }>(
    `/api/employees/${encodeURIComponent(id)}`,
  )
  return result.employee
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const result = await apiRequest<{ employee: Employee }>("/api/employees", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.employee
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<Employee> {
  const result = await apiRequest<{ employee: Employee }>(
    `/api/employees/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(input) },
  )
  return result.employee
}

export function listEmployeeAccountOptions(
  search: string,
  page: number,
  employeeId: string,
): Promise<EmployeeAccountOptions> {
  const params = new URLSearchParams({ page: String(page), employeeId })
  if (search) params.set("search", search)
  return apiRequest<EmployeeAccountOptions>(
    `/api/employees/account-options?${params}`,
  )
}
