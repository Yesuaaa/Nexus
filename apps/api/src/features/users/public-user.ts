import type { User } from "../../generated/prisma/client.js"
import { permissionsFor } from "../auth/permissions.js"

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    contactNumber: user.contactNumber,
    role: user.role,
    permissions: permissionsFor(user.role),
    createdAt: user.createdAt,
  }
}
