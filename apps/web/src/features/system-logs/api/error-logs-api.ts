import { ApiError, apiRequest } from "../../auth/api/auth-api.ts"
import {
  errorQuery,
  parseErrorPage,
  type ErrorFilters,
} from "../model/error-logs.ts"
export async function loadErrors(filters: ErrorFilters, signal: AbortSignal) {
  try {
    return parseErrorPage(
      await apiRequest<unknown>(
        `/api/system-logs/errors?${errorQuery(filters)}`,
        { signal },
      ),
    )
  } catch (error: unknown) {
    if (error instanceof ApiError)
      throw new Error(
        error.status === 404
          ? "Error logs are unavailable. Production access remains disabled."
          : error.status === 401 || error.status === 403
            ? "Your current account cannot access error logs."
            : "Error logs could not be loaded. Check filters or retry.",
        { cause: error },
      )
    throw new Error("Error logs could not be loaded. Check filters or retry.", {
      cause: error,
    })
  }
}
