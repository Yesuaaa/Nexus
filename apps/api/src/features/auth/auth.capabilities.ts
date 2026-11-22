import { Role, type User } from "../../generated/prisma/client.js"
import { hasPermission, Permission } from "./auth.permissions.js"

export type AuthorizationActor = Pick<
  User,
  "id" | "role" | "isActive" | "accountDeletedAt"
>

/** Global administrative grants. Existing feature permissions remain independent. */
export const AdministrativeCapability = {
  MODULE_ACCESS: Permission.MODULES_ACCESS_ALL,
  ORGANIZATION_READ: Permission.ORGANIZATION_READ_ALL,
  MANAGEMENT: Permission.ADMINISTRATION_MANAGE_ALL,
  BUSINESS_CONVERSATION_INSPECTION: Permission.BUSINESS_CONVERSATIONS_INSPECT,
} as const

export type AdministrativeCapability =
  (typeof AdministrativeCapability)[keyof typeof AdministrativeCapability]

export const PayrollCapability = {
  READ: Permission.PAYROLL_READ,
  MANAGE: Permission.PAYROLL_MANAGE,
} as const

export type PayrollCapability =
  (typeof PayrollCapability)[keyof typeof PayrollCapability]

export const OperationalCapability = {
  ASSIGNED_STAFF: "staff:assigned-operation",
  DEPARTMENT_HEAD: "department-head:assigned-operation",
  EMPLOYEE_SELF_SERVICE: "employee:self-service",
  CLIENT_DECISION: "client:own-decision",
  CONVERSATION_PARTICIPATION: "conversation:participate",
} as const

/** Facts must come from current server-side record/assignment queries, never request claims. */
export type OperationalAccess =
  | {
      capability: typeof OperationalCapability.ASSIGNED_STAFF
      assignedUserId: string | null
    }
  | {
      capability: typeof OperationalCapability.DEPARTMENT_HEAD
      headUserId: string | null
    }
  | {
      capability: typeof OperationalCapability.EMPLOYEE_SELF_SERVICE
      employeeUserId: string | null
    }
  | {
      capability: typeof OperationalCapability.CLIENT_DECISION
      clientUserId: string | null
    }
  | {
      capability: typeof OperationalCapability.CONVERSATION_PARTICIPATION
      participantUserIds: readonly string[]
    }

function isActive(actor: AuthorizationActor): boolean {
  return actor.isActive && actor.accountDeletedAt === null
}

/** Does not bypass requireRole(), feature permissions, or workflow validation. */
export function hasAdministrativeCapability(
  actor: AuthorizationActor,
  capability: AdministrativeCapability,
): boolean {
  if (!isActive(actor)) return false
  switch (capability) {
    case AdministrativeCapability.MODULE_ACCESS:
    case AdministrativeCapability.ORGANIZATION_READ:
    case AdministrativeCapability.MANAGEMENT:
    case AdministrativeCapability.BUSINESS_CONVERSATION_INSPECTION:
      return hasPermission(actor.role, capability)
    default:
      return false
  }
}

/** Payroll access is separate from global administration; Superadmin is read-only. */
export function hasPayrollCapability(
  actor: AuthorizationActor,
  capability: PayrollCapability,
): boolean {
  if (!isActive(actor)) return false

  switch (capability) {
    case PayrollCapability.READ:
      return (
        (actor.role === Role.ADMIN || actor.role === Role.SUPERADMIN) &&
        hasPermission(actor.role, Permission.PAYROLL_READ)
      )
    case PayrollCapability.MANAGE:
      return (
        actor.role === Role.ADMIN &&
        hasPermission(actor.role, Permission.PAYROLL_MANAGE)
      )
    default:
      return false
  }
}

/** Base identity/scope eligibility only; feature status and workflow checks still apply. */
export function hasOperationalCapability(
  actor: AuthorizationActor,
  access: OperationalAccess,
): boolean {
  if (!isActive(actor)) return false
  switch (access.capability) {
    case OperationalCapability.ASSIGNED_STAFF:
      return actor.role === Role.STAFF && access.assignedUserId === actor.id
    case OperationalCapability.DEPARTMENT_HEAD:
      return actor.role === Role.STAFF && access.headUserId === actor.id
    case OperationalCapability.EMPLOYEE_SELF_SERVICE:
      return (
        (actor.role === Role.STAFF || actor.role === Role.ADMIN) &&
        access.employeeUserId === actor.id
      )
    case OperationalCapability.CLIENT_DECISION:
      return actor.role === Role.USER && access.clientUserId === actor.id
    case OperationalCapability.CONVERSATION_PARTICIPATION:
      return access.participantUserIds.includes(actor.id)
    default:
      return false
  }
}
