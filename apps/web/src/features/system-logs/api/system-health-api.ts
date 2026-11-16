import { ApiError, apiRequest } from "../../auth/api/auth-api.ts"
import { parseHealthSnapshot } from "../model/system-health.ts"
export async function loadSystemHealth(signal: AbortSignal) {
  try {
    return parseHealthSnapshot(
      await apiRequest<unknown>("/api/system-logs/health", { signal }),
    )
  } catch (error: unknown) {
    throw new Error(
      error instanceof ApiError && error.status === 404
        ? "System Health is unavailable. Production access remains disabled."
        : error instanceof ApiError && [401, 403].includes(error.status)
          ? "Your current account cannot access System Health."
          : "System Health observation is unavailable. Component health is unknown; retry when available.",
      { cause: error },
    )
  }
}
