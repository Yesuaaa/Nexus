import type { Permission } from "./permissions"

export type AuthMode = "login" | "register"

export type AuthLanguage = "en" | "fil"

export type Account = {
  id: string
  email: string
  fullName: string | null
  contactNumber: string | null
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "USER"
  position?: string | null
  departmentId?: string | null
  department?: { id: string; name: string; code: string | null } | null
  teamId?: string | null
  team?: { id: string; name: string } | null
  permissions: Permission[]
  createdAt: string
}

export type RegistrationData = {
  fullName: string
  contactNumber: string
  email: string
  password: string
}
