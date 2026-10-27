import { Role } from "../../generated/prisma/client.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"

function isPrivileged(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

export function canAssignRole(actor: Role, current: Role, next: Role): boolean {
  const permission =
    isPrivileged(current) || isPrivileged(next)
      ? Permission.ACCOUNTS_ASSIGN_PRIVILEGED
      : Permission.ACCOUNTS_ASSIGN_BASIC
  return hasPermission(actor, permission)
}

export function canCreateRole(actor: Role, role: Role): boolean {
  const permission = isPrivileged(role)
    ? Permission.ACCOUNTS_CREATE_PRIVILEGED
    : Permission.ACCOUNTS_CREATE_BASIC
  return hasPermission(actor, permission)
}

export function canChangeAccountStatus(actor: Role, target: Role): boolean {
  return hasPermission(
    actor,
    isPrivileged(target)
      ? Permission.ACCOUNTS_STATUS_PRIVILEGED
      : Permission.ACCOUNTS_STATUS_BASIC,
  )
}
