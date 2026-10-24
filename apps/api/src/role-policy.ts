import { Role } from "./generated/prisma/client.js"

export function canAssignRole(actor: Role, current: Role, next: Role): boolean {
  if (actor === Role.SUPERADMIN) return true
  return (
    actor === Role.ADMIN &&
    (current === Role.STAFF || current === Role.USER) &&
    (next === Role.STAFF || next === Role.USER)
  )
}
