import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import type { RequestHandler, Request } from "express"

// Hold the server request, never caller-provided actor/correlation claims.
export const logContext = new AsyncLocalStorage<{
  request: Request
  correlationId: string
}>()
export const serviceLogContext: RequestHandler = (request, response, next) => {
  const correlationId = randomUUID()
  response.setHeader("X-Correlation-ID", correlationId)
  logContext.run({ request, correlationId }, next)
}

/** Only static Express route templates; no raw URLs, query strings or parameter values. */
export function serviceLogEndpoint(request: Request): string | undefined {
  const root = request.originalUrl.split("?")[0].split("/")[2]?.toLowerCase()
  // Failures in router-level middleware happen before a route is matched, so
  // only the mount point is known.
  const route: unknown = request.route ? request.route.path : "/"
  if (
    !root ||
    !/^[a-z-]+$/.test(root) ||
    typeof route !== "string" ||
    !/^\/[A-Za-z0-9/:-]*$/.test(route) ||
    !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  )
    return undefined
  const endpoint = `${request.method} /api/${root}${route === "/" ? "" : route}`
  return endpoint.length <= 160 ? endpoint : undefined
}
