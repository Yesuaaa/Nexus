import { apiRequest } from "@/features/auth/api/auth-api"
import type { Role } from "@/features/auth/model/roles"
import type { DepartmentColor } from "../model/department-color"

export const COMPANY_DEPARTMENT_PRESETS = [
  {
    name: "Executive",
    code: "EXEC",
    description: "Executive leadership & strategic management",
  },
  {
    name: "Administration",
    code: "ADMIN",
    description: "Internal operations, facilities, and administration",
  },
  {
    name: "Advertising",
    code: "ADV",
    description: "Paid media, campaigns, and ad operations",
  },
  {
    name: "Marketing",
    code: "MKT",
    description: "Brand strategy, growth, and communications",
  },
  {
    name: "Customer Success",
    code: "CS",
    description: "Client relationship management and client support",
  },
  {
    name: "SEO",
    code: "SEO",
    description: "Search engine optimization and content performance",
  },
  {
    name: "Information Technology",
    code: "IT",
    description: "Technical infrastructure, software, and systems",
  },
] as const

export type DepartmentHead = {
  id: string
  email: string
  fullName: string | null
  role: Role
  position?: string | null
}

export type Department = {
  id: string
  name: string
  color: DepartmentColor
  code: string | null
  description: string | null
  headId: string | null
  head: DepartmentHead | null
  memberCount: number
  teamCount?: number
  serviceCount?: number
  createdAt: string
  updatedAt: string
}

export type DepartmentMember = {
  id: string
  userId: string | null
  fullName: string
  email: string | null
  contactNumber: string | null
  position: string | null
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE"
  departmentId?: string | null
  teamId: string | null
  team: { id: string; name: string } | null
  createdAt: string
  user: {
    id: string
    email: string
    fullName: string | null
    role: Role
    isActive: boolean
    accountDeletedAt: string | null
  } | null
}

export type DepartmentStaffOption = {
  id: string
  fullName: string
  email: string
  contactNumber: string | null
  position: string | null
  departmentId: string | null
  user: {
    id: string
    email: string
    fullName: string | null
    role: "STAFF"
    isActive: true
  }
}

export type DepartmentTeam = {
  id: string
  name: string
  description: string | null
  departmentId: string
  leadId: string | null
  lead: DepartmentHead | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type DepartmentDetail = Department & {
  members: DepartmentMember[]
  teams: DepartmentTeam[]
}

export type EligibleHead = {
  id: string
  fullName: string | null
  email: string
  role: Role
  headOf: { id: string; name: string } | null
}

export async function listDepartments(
  signal?: AbortSignal,
): Promise<Department[]> {
  const result = await apiRequest<{ departments: Department[] }>(
    "/api/departments",
    { signal },
  )
  return result.departments
}

export async function getDepartment(
  id: string,
  signal?: AbortSignal,
): Promise<DepartmentDetail> {
  const result = await apiRequest<{ department: DepartmentDetail }>(
    `/api/departments/${encodeURIComponent(id)}`,
    { signal },
  )
  return result.department
}

export async function listAssignableStaff(
  search: string,
  page: number,
): Promise<{
  employees: DepartmentStaffOption[]
  total: number
  page: number
  pageSize: number
}> {
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim()) params.set("search", search.trim())
  return apiRequest<{
    employees: DepartmentStaffOption[]
    total: number
    page: number
    pageSize: number
  }>(`/api/departments/employee-options?${params}`)
}

/**
 * Staff who may head a department. Pass the department's id when editing
 * (eligible staff plus its current head) or null when creating (unassigned
 * eligible staff only).
 */
export async function listEligibleHeads(
  departmentId: string | null,
  signal?: AbortSignal,
): Promise<EligibleHead[]> {
  const query = new URLSearchParams(
    departmentId === null ? { new: "true" } : { departmentId },
  )
  const result = await apiRequest<{ users: EligibleHead[] }>(
    `/api/departments/eligible-heads?${query}`,
    { signal },
  )
  return result.users
}

export async function createDepartment(input: {
  name: string
  color: DepartmentColor
  code?: string
  description?: string
  headId?: string | null
}): Promise<Department> {
  const result = await apiRequest<{ department: Department }>(
    "/api/departments",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
  return result.department
}

export async function updateDepartment(
  id: string,
  input: {
    name?: string
    color?: DepartmentColor
    code?: string | null
    description?: string | null
    headId?: string | null
  },
): Promise<Department> {
  const result = await apiRequest<{ department: Department }>(
    `/api/departments/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  )
  return result.department
}

export async function assignDepartmentMembers(
  id: string,
  userIds: string[],
): Promise<void> {
  await apiRequest(`/api/departments/${encodeURIComponent(id)}/members`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  })
}

export async function removeDepartmentMember(
  id: string,
  employeeId: string,
): Promise<void> {
  await apiRequest(
    `/api/departments/${encodeURIComponent(id)}/members/${encodeURIComponent(employeeId)}`,
    {
      method: "DELETE",
    },
  )
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiRequest(`/api/departments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export async function createTeam(
  departmentId: string,
  input: {
    name: string
    description?: string
    leadId?: string | null
    memberIds?: string[]
  },
): Promise<DepartmentTeam> {
  const result = await apiRequest<{ team: DepartmentTeam }>(
    `/api/departments/${encodeURIComponent(departmentId)}/teams`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
  return result.team
}

export async function updateTeam(
  departmentId: string,
  teamId: string,
  input: {
    name?: string
    description?: string | null
    leadId?: string | null
  },
): Promise<DepartmentTeam> {
  const result = await apiRequest<{ team: DepartmentTeam }>(
    `/api/departments/${encodeURIComponent(departmentId)}/teams/${encodeURIComponent(teamId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  )
  return result.team
}

export async function deleteTeam(
  departmentId: string,
  teamId: string,
): Promise<void> {
  await apiRequest(
    `/api/departments/${encodeURIComponent(departmentId)}/teams/${encodeURIComponent(teamId)}`,
    {
      method: "DELETE",
    },
  )
}

export async function updateDepartmentMember(
  departmentId: string,
  employeeId: string,
  input: {
    position?: string | null
    teamId?: string | null
  },
): Promise<void> {
  await apiRequest(
    `/api/departments/${encodeURIComponent(departmentId)}/members/${encodeURIComponent(employeeId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )
}
