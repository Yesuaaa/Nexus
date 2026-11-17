import path from "node:path"
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express"
import { isTemporaryDatabaseError } from "../lib/database-read.js"
import { HttpError, prismaHttpError } from "./http-error.js"

/**
 * Extracts the file path and line number of the caller or the error source,
 * converting absolute paths to workspace-relative paths (e.g. apps/api/src/features/...).
 */
export function extractErrorLocation(error?: unknown): string {
  const stack = (error instanceof Error ? error.stack : new Error().stack) || ""
  const lines = stack.split("\n")
  for (const line of lines) {
    if (
      line.includes("node_modules") ||
      line.includes("node:internal") ||
      line.includes("error-handler.ts") ||
      line.includes("error-handler.js") ||
      line.includes("extractErrorLocation") ||
      line.includes("devErrorInterceptor")
    ) {
      continue
    }
    const match = line.match(
      /(?:at\s+(?:.*?\s+\()?)?(?:[a-zA-Z]:[\\/]|file:\/\/\/)?([^:)]+):(\d+):(\d+)\)?/,
    )
    if (match) {
      const fullPath = match[1]
      const lineNum = match[2]
      const colNum = match[3]
      const normalized = fullPath.replace(/\\/g, "/")
      const srcIdx = normalized.indexOf("apps/api/src/")
      const distIdx = normalized.indexOf("apps/api/dist/")
      let relPath: string

      if (srcIdx !== -1) {
        relPath = normalized.slice(srcIdx)
      } else if (distIdx !== -1) {
        const sub = normalized.slice(distIdx + "apps/api/dist/".length)
        const tsPath = sub.replace(/\.js$/, ".ts")
        relPath = `apps/api/src/${tsPath}`
      } else {
        const featIdx = normalized.indexOf("features/")
        relPath =
          featIdx !== -1
            ? `apps/api/src/${normalized.slice(featIdx).replace(/\.js$/, ".ts")}`
            : path.basename(normalized)
      }

      return `${relPath}:${lineNum}:${colNum}`
    }
  }
  return "unknown"
}

export function logDevError(options: {
  status: number
  method: string
  url: string
  clientMessage: string
  location?: string
  devDetails?: unknown
  stack?: string
}) {
  if (process.env.NODE_ENV !== "development") return

  const divider = "─".repeat(50)
  console.error(
    `\n┌─ [API ERROR ${options.status}] ${options.method} ${options.url} ${divider}`,
  )
  if (options.location && options.location !== "unknown") {
    console.error(`│ 📍 Location: ${options.location}`)
  }
  console.error(`│ 💬 Toast:    ${options.clientMessage}`)
  if (options.devDetails !== undefined) {
    const detailsStr =
      typeof options.devDetails === "object"
        ? JSON.stringify(options.devDetails, null, 2)
            .split("\n")
            .join("\n│    ")
        : String(options.devDetails)
    console.error(`│ 🔍 Details:  ${detailsStr}`)
  }
  if (options.status >= 500 && options.stack) {
    const relevantStack = options.stack
      .split("\n")
      .slice(1, 4)
      .map((l) => l.trim())
      .join("\n│    ")
    console.error(`│ 💥 Trace:    ${relevantStack}`)
  }
  console.error(`└${divider}\n`)
}

/**
 * Middleware that intercepts outgoing JSON responses with status >= 400 in development mode.
 * - Enriches the response with `location` and `details` for Network Tab inspection
 * - Prints the formatted error box in the backend terminal
 * - Preserves `error` as the clean toast message for client UI (Web & Mobile)
 */
export const devErrorInterceptor = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  if (process.env.NODE_ENV !== "development") {
    return next()
  }

  const originalJson = response.json.bind(response)
  response.json = (body: unknown) => {
    if (
      response.statusCode >= 400 &&
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      const errorBody = body as {
        error: string
        location?: string
        details?: unknown
      }

      if (!errorBody.location) {
        errorBody.location = extractErrorLocation()
      }

      if (!(response.locals as Record<string, unknown>)._devErrorLogged) {
        logDevError({
          status: response.statusCode,
          method: request.method,
          url: request.originalUrl || request.url,
          clientMessage: errorBody.error,
          location: errorBody.location,
          devDetails: errorBody.details,
        })
      }
    }
    return originalJson(body)
  }
  next()
}

type ResolvedError = {
  status: number
  message: string
  details?: unknown
  retryAfter?: string
}

function resolveError(error: unknown): ResolvedError {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      details: error.details,
    }
  }

  // body-parser: malformed JSON
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    return {
      status: 400,
      message: "Invalid JSON",
      details: "JSON body parsing failed due to invalid syntax",
    }
  }

  // body-parser: body over the route's limit
  if (error instanceof Error && "status" in error && error.status === 413) {
    return {
      status: 413,
      message: "Request payload is too large",
      details: "Body size exceeded configured limit",
    }
  }

  // Known Prisma write failures (P2002/P2003/P2025/P2034) are 409 conflicts on
  // every route. Checked before the temporary-failure branch so a write
  // conflict (P2034) is a 409, not a 503.
  const prismaError = prismaHttpError(error)
  if (prismaError) {
    return {
      status: prismaError.status,
      message: prismaError.message,
      details: prismaError.details,
    }
  }

  if (isTemporaryDatabaseError(error)) {
    return {
      status: 503,
      message:
        "The database is temporarily busy or unavailable. Please try again.",
      details:
        error instanceof Error ? error.message : "Temporary database failure",
      retryAfter: "2",
    }
  }

  // Other errors carrying an explicit HTTP status (e.g. body-parser 415)
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return {
      status: error.status,
      message: error.message,
      details: "details" in error ? error.details : undefined,
    }
  }

  return {
    status: 500,
    message: "Internal server error",
    details: error instanceof Error ? error.message : "Internal server error",
  }
}

/**
 * Global Error Request Handler for Express.
 *
 * Expected outcomes (4xx, including every 4xx `HttpError`) are normal traffic
 * and are not logged; only unexpected failures and 5xx responses are.
 */
export const handleError: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  if (response.headersSent) return next(error)
  ;(response.locals as Record<string, unknown>)._devErrorLogged = true
  const isDev = process.env.NODE_ENV === "development"

  const { status, message, details, retryAfter } = resolveError(error)
  if (status >= 500) {
    console.error("API request failed:", request.method, request.path, error)
  }

  const source =
    error instanceof HttpError && error.cause instanceof Error
      ? error.cause
      : error
  const location = extractErrorLocation(source)
  logDevError({
    status,
    method: request.method,
    url: request.originalUrl || request.url,
    clientMessage: message,
    location,
    devDetails: details,
    stack: source instanceof Error ? source.stack : undefined,
  })

  if (retryAfter) response.setHeader("Retry-After", retryAfter)
  response.status(status).json({
    error: message,
    ...(isDev
      ? { location, ...(details !== undefined ? { details } : {}) }
      : {}),
  })
}
