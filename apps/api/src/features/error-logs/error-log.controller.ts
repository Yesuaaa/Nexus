import type { RequestHandler } from "express"
import { HttpError } from "../../shared/http-error.js"
import { listErrorLogs } from "./error-log.service.js"

/** Mounted only inside the attested offline/owned local-demo System Logs router. */
export const readErrorLogs: RequestHandler = async (request, response) => {
  try {
    response.json(await listErrorLogs(request.auth!, request.query))
  } catch (error: unknown) {
    const status =
      error instanceof HttpError && [400, 401, 403, 503].includes(error.status)
        ? error.status
        : 500
    const messages: Record<number, string> = {
      400: "Invalid error log filters",
      401: "Authentication required",
      403: "Insufficient permissions",
      503: "Error logs unavailable",
      500: "Internal server error",
    }
    response.status(status).json({ error: messages[status] })
  }
}
