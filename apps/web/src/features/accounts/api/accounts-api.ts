import { apiRequest } from "@/features/auth/api/auth-api"
import type { Account } from "@/features/auth/model/types"

export type AccountList = {
  users: Account[]
  total: number
  page: number
  pageSize: number
}

export type AccountRole = Account["role"]
export type AccountSortKey =
  "member" | "role" | "status" | "department" | "createdAt" | "deletedAt"
export type AccountSortDirection = "asc" | "desc"

export type NewAccount = {
  email: string
  fullName: string
  contactNumber?: string
  position?: string
  password: string
  role: AccountRole
  departmentId?: string
  teamId?: string
}

export function listAccounts({
  search = "",
  role = "",
  page = 1,
  sort = "createdAt",
  direction = "desc",
  deleted = false,
  signal,
}: {
  search?: string
  /** An `AccountRole`, or "" for every role. */
  role?: string
  page?: number
  sort?: AccountSortKey
  direction?: AccountSortDirection
  /** List accounts in Trash instead of active ones. */
  deleted?: boolean
  signal?: AbortSignal
} = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set("search", search)
  if (role) params.set("role", role)
  if (sort !== "createdAt") params.set("sort", sort)
  if (direction !== "desc") params.set("direction", direction)
  if (deleted) params.set("deleted", "true")
  return apiRequest<AccountList>(`/api/users?${params}`, { signal })
}

export function createAccount(data: NewAccount) {
  return apiRequest<{ user: Account }>("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function changeAccountRole(id: string, role: AccountRole) {
  return apiRequest<{ user: Account }>(
    `/api/users/${encodeURIComponent(id)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  )
}

export function changeAccountStatus(id: string, isActive: boolean) {
  return apiRequest<{ user: Account }>(
    `/api/users/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  )
}

export function changeAccountPassword(id: string, newPassword: string) {
  return apiRequest<void>(`/api/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  })
}

export async function moveAccountToTrash(id: string): Promise<void> {
  await apiRequest(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export function restoreAccount(id: string) {
  return apiRequest<{ user: Account }>(
    `/api/users/${encodeURIComponent(id)}/restore`,
    { method: "POST" },
  )
}

export async function permanentlyDeleteAccount(id: string): Promise<void> {
  await apiRequest(`/api/users/${encodeURIComponent(id)}/permanent`, {
    method: "DELETE",
  })
}
