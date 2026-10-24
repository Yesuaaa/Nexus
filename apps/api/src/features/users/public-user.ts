import type { User } from "../../generated/prisma/client.js"

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    contactNumber: user.contactNumber,
    role: user.role,
    createdAt: user.createdAt,
  }
}
