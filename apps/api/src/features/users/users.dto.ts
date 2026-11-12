import type { Prisma, User } from "../../generated/prisma/client.js"
import {
  departmentSummarySelect,
  teamSummarySelect,
} from "../../shared/query/selects.js"
import { permissionsFor } from "../auth/auth.permissions.js"
import { userImageUrl } from "../services/service-image-storage.js"

/**
 * Relations every `publicUser()` source should load so that `imageUrl`
 * (employee image fallback), department, team and `headOf` are the same on
 * /me, login, profile and account-management responses.
 */
export const publicUserInclude = {
  employee: { select: { profileImageUrl: true } },
  department: { select: departmentSummarySelect },
  team: { select: teamSummarySelect },
  headOf: { select: { id: true, name: true } },
} as const satisfies Prisma.UserInclude

export function publicUser(
  user: User & {
    employee?: { profileImageUrl: string | null } | null
    department?: {
      id: string
      name: string
      code: string | null
      color: string
    } | null
    team?: { id: string; name: string } | null
    headOf?: { id: string; name: string } | null
  },
) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    imageUrl: userImageUrl(user),
    contactNumber: user.contactNumber,
    position: user.position ?? null,
    role: user.role,
    isActive: user.isActive,
    accountDeletedAt: user.accountDeletedAt,
    departmentId: user.departmentId ?? null,
    department: user.department
      ? {
          id: user.department.id,
          name: user.department.name,
          code: user.department.code,
          color: user.department.color,
        }
      : null,
    teamId: user.teamId ?? null,
    team: user.team
      ? {
          id: user.team.id,
          name: user.team.name,
        }
      : null,
    permissions: permissionsFor(user.role),
    headOf: user.headOf ? { id: user.headOf.id, name: user.headOf.name } : null,
    createdAt: user.createdAt,
  }
}
