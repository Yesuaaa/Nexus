import type { Account } from "./types"

export const Permissions = {
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
  DEPARTMENTS_READ: "departments:read",
  DEPARTMENTS_MANAGE: "departments:manage",
  DEPARTMENTS_DELETE: "departments:delete",
} as const

export type Permission = (typeof Permissions)[keyof typeof Permissions]

type Role = Account["role"]

function isPrivileged(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERADMIN"
}

export function hasPermission(
  account: Account,
  permission: Permission,
): boolean {
  return account.permissions?.includes(permission) ?? false
}

export function canAccessDepartmentManagement(account: Account): boolean {
  return (
    account.role === "ADMIN" &&
    hasPermission(account, Permissions.DEPARTMENTS_READ)
  )
}

export function canCreateRole(actor: Account, role: Role): boolean {
  return hasPermission(
    actor,
    isPrivileged(role)
      ? Permissions.ACCOUNTS_CREATE_PRIVILEGED
      : Permissions.ACCOUNTS_CREATE_BASIC,
  )
}

export function canAssignRole(
  actor: Account,
  current: Role,
  next: Role,
): boolean {
  return hasPermission(
    actor,
    isPrivileged(current) || isPrivileged(next)
      ? Permissions.ACCOUNTS_ASSIGN_PRIVILEGED
      : Permissions.ACCOUNTS_ASSIGN_BASIC,
  )
}

export function canChangeAccountStatus(
  actor: Account,
  target: Account,
): boolean {
  return (
    actor.id !== target.id &&
    hasPermission(
      actor,
      isPrivileged(target.role)
        ? Permissions.ACCOUNTS_STATUS_PRIVILEGED
        : Permissions.ACCOUNTS_STATUS_BASIC,
    )
  )
}
