import { ApiError } from "./api"
import type { AuthCopy } from "./copy"
import type { AuthMode } from "./types"

export function requestErrorMessage(
  error: unknown,
  mode: AuthMode,
  copy: AuthCopy,
): string {
  if (error instanceof ApiError) {
    if (mode === "login" && error.status === 401) return copy.badCredentials
    if (mode === "register" && error.status === 409) return copy.emailRegistered
    if (error.status === 429) return copy.rateLimited
    if (error.status >= 500) return copy.serverError
    return copy.unknownError
  }
  if (error instanceof TypeError) return copy.networkError
  return copy.unknownError
}
