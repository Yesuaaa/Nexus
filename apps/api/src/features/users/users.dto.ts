import type { User } from "../../generated/prisma/client.js"
import { permissionsFor } from "../auth/auth.permissions.js"

export function publicUser(
  user: User & {
    department?: { id: string; name: string; code: string | null } | null
    team?: { id: string; name: string } | null
  },
) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    contactNumber: user.contactNumber,
    position: user.position ?? null,
    role: user.role,
    isActive: user.isActive,
    departmentId: user.departmentId ?? null,
    department: user.department
      ? {
          id: user.department.id,
          name: user.department.name,
          code: user.department.code,
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
    createdAt: user.createdAt,
  }
}
