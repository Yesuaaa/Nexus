/** Portal roles, from most to least privileged. */
export const roles = ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const

export type Role = (typeof roles)[number]

/** Staff-side roles (everyone except clients). */
export type InternalRole = Exclude<Role, "USER">

export const roleLabels: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "Client",
}

export function roleLabel(role: Role): string {
  return roleLabels[role]
}
