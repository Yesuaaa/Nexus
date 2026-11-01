import type { User } from "../../generated/prisma/client.js"
import { permissionsFor } from "../auth/auth.permissions.js"
import { profileImagePublicUrl } from "../services/service-image-storage.js"

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
    imageUrl: profileImagePublicUrl(
      user.profileImagePath,
      user.employee?.profileImageUrl,
    ),
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
    headOf: user.headOf ?? null,
    createdAt: user.createdAt,
  }
}
