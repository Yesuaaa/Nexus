import { Router, type ErrorRequestHandler } from "express"
import { readErrorLogs } from "../error-logs/error-log.controller.js"
import { readSystemHealth } from "../health/system-health.controller.js"
import { Role } from "../../generated/prisma/client.js"
import { requireAuth, requireRole } from "../auth/auth.middleware.js"
import { assertHistoryObject } from "../../shared/management-history.js"
import { HttpError } from "../../shared/http-error.js"
import { sources, type ManagementSource } from "./management-event.js"
import { uuid } from "./management-query.js"
import { verifyLocalDemo, type LocalDemoAccess } from "./local-demo.js"
import {
  listManagementHistory,
  getManagementHistoryEvent,
} from "./management-history.service.js"

const listKeys = [
  "category",
  "area",
  "moduleId",
  "source",
  "eventName",
  "action",
  "actorId",
  "subjectType",
  "subjectId",
  "operationId",
  "from",
  "to",
  "pageSize",
  "cursor",
]

/** HTTP parsing only; the service remains the authoritative contract validator. */
function queryDto(
  input: unknown,
  keys: readonly string[],
): Record<string, string | number> {
  try {
    assertHistoryObject(input, keys)
    const dto: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "string") throw new Error("Invalid query")
      if (key === "pageSize") {
        if (!/^[1-9]\d{0,2}$/.test(value)) throw new Error("Invalid page size")
        dto[key] = Number(value)
      } else dto[key] = value
    }
    return dto
  } catch {
    throw new HttpError(400, "Invalid management history query")
  }
}

/** Native offline tests or an owned synthetic local demonstration. There is no
 * production activation mechanism; flags alone cannot attest either ownership. */
export function createSystemLogsRouter(
  verifyOfflineFixture?: () => boolean,
  isShuttingDown: () => boolean = () => false,
  localDemo?: LocalDemoAccess,
) {
  const router = Router()
  const offlineTestComposition =
    process.env.NODE_ENV !== "production" &&
    process.env.NODE_TEST_CONTEXT === "child-v8" &&
    typeof verifyOfflineFixture === "function"
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store")
    let offline = false
    try {
      offline =
        process.env.NODE_ENV !== "production" &&
        ((offlineTestComposition &&
          process.env.NODE_TEST_CONTEXT === "child-v8" &&
          verifyOfflineFixture?.() === true) ||
          (_request.socket.localAddress === "127.0.0.1" &&
            _request.socket.remoteAddress === "127.0.0.1" &&
            verifyLocalDemo(localDemo)))
    } catch {
      /* A failed fixture attestation must never open the route. */
    }
    if (!offline) {
      response.status(404).json({ error: "Not found" })
      return
    }
    next()
  })
  router.use(requireAuth, requireRole(Role.SUPERADMIN))
  router.get("/errors", readErrorLogs)
  router.get("/health", readSystemHealth(isShuttingDown))
  router.get("/management-history", async (request, response) => {
    const page = await listManagementHistory(
      request.auth!,
      queryDto(request.query, listKeys),
    )
    const unavailable = page.sources.every((s) => s.status === "unavailable")
    response.status(unavailable ? 503 : 200).json({
      ...page,
      ...(unavailable ? { error: "Management history unavailable" } : {}),
    })
  })
  router.get(
    "/management-history/operations/:operationId",
    async (request, response) => {
      const operationId = String(request.params.operationId)
      if (!uuid(operationId))
        throw new HttpError(400, "Invalid management history query")
      const dto = queryDto(
        request.query,
        listKeys.filter((key) => key !== "operationId"),
      )
      const page = await listManagementHistory(request.auth!, {
        ...dto,
        operationId,
      })
      const unavailable = page.sources.every((s) => s.status === "unavailable")
      response.status(unavailable ? 503 : 200).json({
        ...page,
        operationId: operationId.toLowerCase(),
        ...(unavailable ? { error: "Management history unavailable" } : {}),
      })
    },
  )
  router.get(
    "/management-history/events/:source/:eventId",
    async (request, response) => {
      const source = String(request.params.source)
      if (!sources.includes(source as ManagementSource))
        throw new HttpError(400, "Invalid management history query")
      const dto = queryDto(request.query, ["from", "to"])
      const result = await getManagementHistoryEvent(
        request.auth!,
        source as ManagementSource,
        String(request.params.eventId),
        dto as { from?: string; to?: string },
      )
      const unavailable =
        result.status === "unavailable" ||
        result.reasonCode === "INVALID_RECORD"
      const status = unavailable ? 503 : result.event ? 200 : 404
      response.status(status).json({
        schemaVersion: 1,
        ...result,
        ...(status !== 200
          ? {
              error: unavailable
                ? "Management history unavailable"
                : "Management history event not found",
            }
          : {}),
      })
    },
  )
  router.use((_request, response) => {
    response.status(404).json({ error: "Not found" })
  })
  // This router is mounted before devErrorInterceptor/body parsing. Never pass its
  // errors to the development response decorator or serialize arbitrary causes.
  const safeError: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next,
  ) => {
    // Express requires four declared parameters to recognize error middleware.
    // This boundary intentionally does not forward errors to dev decorators.
    void _next
    const status =
      error instanceof HttpError && [400, 401, 403, 503].includes(error.status)
        ? error.status
        : error instanceof URIError
          ? 400
          : 500
    const messages: Record<number, string> = {
      400: "Invalid management history query",
      401: "Authentication required",
      403: "Insufficient permissions",
      503: "Management history unavailable",
      500: "Internal server error",
    }
    response.status(status).json({ error: messages[status] })
  }
  router.use(safeError)
  return router
}
