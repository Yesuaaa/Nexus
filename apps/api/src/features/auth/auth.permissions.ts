import { Role } from "../../generated/prisma/client.js"

export const Permission = {
  DASHBOARD_READ: "dashboard:read",
  PROFILE_READ: "profile:read",
  PROFILE_CHANGE_PASSWORD: "profile:change-password",
  ACCOUNTS_READ: "accounts:read",
  ACCOUNTS_CREATE_BASIC: "accounts:create-basic",
  ACCOUNTS_CREATE_PRIVILEGED: "accounts:create-privileged",
  ACCOUNTS_ASSIGN_BASIC: "accounts:assign-basic",
  ACCOUNTS_ASSIGN_PRIVILEGED: "accounts:assign-privileged",
  ACCOUNTS_STATUS_BASIC: "accounts:status-basic",
  ACCOUNTS_STATUS_PRIVILEGED: "accounts:status-privileged",
  ACCOUNTS_RESET_PASSWORD: "accounts:reset-password",
  DEPARTMENTS_READ: "departments:read",
  DEPARTMENTS_MANAGE: "departments:manage",
  DEPARTMENTS_DELETE: "departments:delete",
  EMPLOYEES_READ: "employees:read",
  EMPLOYEES_MANAGE: "employees:manage",
  SERVICES_READ: "services:read",
  SERVICES_MANAGE: "services:manage",
  CLIENTS_READ: "clients:read",
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const commonPermissions = [
  Permission.DASHBOARD_READ,
  Permission.PROFILE_READ,
  Permission.PROFILE_CHANGE_PASSWORD,
] as const

const staffPermissions = [
  ...commonPermissions,
  Permission.DEPARTMENTS_READ,
] as const

const departmentManagementPermissions = [
  ...staffPermissions,
  Permission.DEPARTMENTS_MANAGE,
  Permission.DEPARTMENTS_DELETE,
] as const

const adminPermissions = [
  ...departmentManagementPermissions,
  Permission.SERVICES_READ,
  Permission.SERVICES_MANAGE,
] as const

const accountManagementPermissions = [
  Permission.ACCOUNTS_READ,
  Permission.ACCOUNTS_CREATE_BASIC,
  Permission.ACCOUNTS_CREATE_PRIVILEGED,
  Permission.ACCOUNTS_ASSIGN_BASIC,
  Permission.ACCOUNTS_ASSIGN_PRIVILEGED,
  Permission.ACCOUNTS_STATUS_BASIC,
  Permission.ACCOUNTS_STATUS_PRIVILEGED,
  Permission.ACCOUNTS_RESET_PASSWORD,
] as const

const rolePermissions: Record<Role, readonly Permission[]> = {
  [Role.USER]: commonPermissions,
  [Role.STAFF]: staffPermissions,
  [Role.ADMIN]: [
    ...adminPermissions,
    Permission.CLIENTS_READ,
    Permission.EMPLOYEES_READ,
    Permission.EMPLOYEES_MANAGE,
  ],
  [Role.SUPERADMIN]: [
    ...departmentManagementPermissions,
    ...accountManagementPermissions,
  ],
}

export function permissionsFor(role: Role): Permission[] {
  return [...rolePermissions[role]]
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission)
}
