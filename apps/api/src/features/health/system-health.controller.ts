import type { RequestHandler } from "express"
import { HttpError } from "../../shared/http-error.js"
import { authorizeDiagnosticRead } from "../system-logs/diagnostic-access.js"
import { systemHealthObserver } from "./system-health.service.js"

export function readSystemHealth(
  isShuttingDown: () => boolean,
): RequestHandler {
  return async (request, response) => {
    try {
      await authorizeDiagnosticRead(request.auth!, "System Health unavailable")
      if (Object.keys(request.query).length)
        throw new HttpError(400, "Invalid health query")
      const snapshot = await systemHealthObserver.observe(isShuttingDown)
      // A probe can wait seconds: recheck role/revocation before disclosing.
      await authorizeDiagnosticRead(request.auth!, "System Health unavailable")
      response.json(snapshot)
    } catch (error: unknown) {
      const status =
        error instanceof HttpError &&
        [400, 401, 403, 503].includes(error.status)
          ? error.status
          : 500
      const messages: Record<number, string> = {
        400: "Invalid health query",
        401: "Authentication required",
        403: "Insufficient permissions",
        503: "System Health unavailable",
        500: "Internal server error",
      }
      response.status(status).json({ error: messages[status] })
    }
  }
}
