import { ApiError } from "@/features/auth/api/auth-api"

export const networkErrorMessage =
  "Can't reach the server. Check your connection and try again."

/**
 * User-facing text for a caught error: the API's message, a network-failure
 * message when `fetch` couldn't reach the server, any other error's message,
 * or `fallback` when the thrown value isn't an Error.
 */
export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) return reason.message || fallback
  // fetch() rejects with a TypeError when the request never reaches the server.
  if (reason instanceof TypeError) return networkErrorMessage
  if (reason instanceof Error) return reason.message || fallback
  return fallback
}
