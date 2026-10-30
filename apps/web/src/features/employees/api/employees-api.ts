import { apiRequest } from "@/features/auth/api/auth-api"
import type { DepartmentColor } from "@/features/departments/model/department-color"

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN"
export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE"

export type Employee = {
  id: string
  employeeId: string
  accountId?: string
  hasEmployeeRecord?: boolean
  fullName: string
  email: string | null
  contactNumber: string | null
  position: string | null
  employmentType: EmploymentType | null
  status: EmploymentStatus | null
  startDate: string | null
  departmentId: string | null
  teamId: string | null
  department: {
    id: string
    name: string
    code: string | null
    color: DepartmentColor
  } | null
  team: { id: string; name: string } | null
  hasAccount: boolean
  accountIsActive: boolean | null
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
  replacementHeadEmployeeId?: string
  password?: string
}

export type EmployeeStatusOptions = {
  isDepartmentHead: boolean
  replacementCandidates: {
    id: string
    employeeId: string
    fullName: string
    email: string | null
    startDate: string | null
  }[]
  recommendedReplacementEmployeeId: string | null
  willRestoreOriginalHead: boolean
}

export type EmployeeList = {
  employees: Employee[]
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

export async function getEmployeeStatusOptions(
  id: string,
): Promise<EmployeeStatusOptions> {
  return apiRequest<EmployeeStatusOptions>(
    `/api/employees/${encodeURIComponent(id)}/status-options`,
  )
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

export async function deactivateEmployeeLogin(id: string): Promise<void> {
  return setEmployeeLoginStatus(id, false)
}

export async function setEmployeeLoginStatus(
  id: string,
  isActive: boolean,
): Promise<void> {
  await apiRequest(`/api/employees/${encodeURIComponent(id)}/account/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  })
}

export async function createEmployeeLogin(
  id: string,
  password: string,
): Promise<Employee> {
  const result = await apiRequest<{ employee: Employee }>(
    `/api/employees/${encodeURIComponent(id)}/account`,
    { method: "POST", body: JSON.stringify({ password }) },
  )
  return result.employee
}

export async function deleteEmployeeLogin(id: string): Promise<void> {
  await apiRequest(`/api/employees/${encodeURIComponent(id)}/account`, {
    method: "DELETE",
  })
}

export async function createEmployeeProfile(
  accountId: string,
  input: EmployeeInput,
): Promise<Employee> {
  const result = await apiRequest<{ employee: Employee }>(
    `/api/employees/accounts/${encodeURIComponent(accountId)}/profile`,
    { method: "POST", body: JSON.stringify(input) },
  )
  return result.employee
}
