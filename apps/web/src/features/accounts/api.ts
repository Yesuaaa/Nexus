import { apiRequest } from "@/features/auth/api"
import type { Account } from "@/features/auth/types"

export type AccountList = {
  users: Account[]
  total: number
  page: number
  pageSize: number
}

export type AccountRole = Account["role"]

export type NewAccount = {
  email: string
  fullName: string
  contactNumber?: string
  password: string
  role: AccountRole
}

export function listAccounts(search: string, role: string, page: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set("search", search)
  if (role) params.set("role", role)
  return apiRequest<AccountList>(`/api/users?${params}`)
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
