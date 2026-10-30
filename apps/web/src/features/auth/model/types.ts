import type { Permission } from "./permissions"
import type { DepartmentColor } from "@/features/departments/model/department-color"

export type AuthMode = "login" | "register"

export type AuthLanguage = "en" | "fil"

export type Account = {
  id: string
  email: string
  fullName: string | null
  contactNumber: string | null
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "USER"
  isActive: boolean
  accountDeletedAt?: string | null
  position?: string | null
  departmentId?: string | null
  department?: {
    id: string
    name: string
    code: string | null
    color: DepartmentColor
  } | null
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
