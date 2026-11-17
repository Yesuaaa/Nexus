import type { AuthPortal } from "./types"
import type { Role } from "./roles"

export function canSignInToPortal(role: Role, portal: AuthPortal): boolean {
  return portal === "client" ? role === "USER" : role !== "USER"
}

export function loginPathForRole(role: Role): "/login" | "/internal/login" {
  return role === "USER" ? "/login" : "/internal/login"
}
