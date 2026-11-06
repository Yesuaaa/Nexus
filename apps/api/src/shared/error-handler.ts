import path from "node:path"
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express"

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

      logDevError({
        status: response.statusCode,
        method: request.method,
        url: request.originalUrl || request.url,
        clientMessage: errorBody.error,
        location: errorBody.location,
        devDetails: errorBody.details,
      })
    }
    return originalJson(body)
  }
  next()
}

/**
 * Global Error Request Handler for Express
 */
export const handleError: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) => {
  void _next
  const isDev = process.env.NODE_ENV === "development"

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    const location = extractErrorLocation(error)
    logDevError({
      status: 400,
      method: request.method,
      url: request.originalUrl || request.url,
      clientMessage: "Invalid JSON",
      location,
      devDetails: "JSON body parsing failed due to invalid syntax",
    })
    response.status(400).json({
      error: "Invalid JSON",
      ...(isDev
        ? {
            location,
            details: "JSON body parsing failed due to invalid syntax",
          }
        : {}),
    })
    return
  }

  if (error instanceof Error && "status" in error && error.status === 413) {
    const location = extractErrorLocation(error)
    logDevError({
      status: 413,
      method: request.method,
      url: request.originalUrl || request.url,
      clientMessage: "Request payload is too large",
      location,
      devDetails: "Body size exceeded configured limit",
    })
    response.status(413).json({
      error: "Request payload is too large",
      ...(isDev
        ? { location, details: "Body size exceeded configured limit" }
        : {}),
    })
    return
  }

  // Handle errors that carry an explicit HTTP status (e.g. AuthError, ServicesError)
  if (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status
    const location = extractErrorLocation(error)
    const details =
      "details" in error ? (error as { details: unknown }).details : undefined
    logDevError({
      status,
      method: request.method,
      url: request.originalUrl || request.url,
      clientMessage: error.message,
      location,
      devDetails: details,
    })
    response.status(status).json({
      error: error.message,
      ...(isDev
        ? { location, ...(details !== undefined ? { details } : {}) }
        : {}),
    })
    return
  }

  // Generic 500 error
  const location = extractErrorLocation(error)
  const message =
    error instanceof Error ? error.message : "Internal server error"
  const stack = error instanceof Error ? error.stack : undefined

  logDevError({
    status: 500,
    method: request.method,
    url: request.originalUrl || request.url,
    clientMessage: "Internal server error",
    location,
    devDetails: message,
    stack,
  })

  if (!isDev) {
    console.error("API request failed:", error)
  }

  response.status(500).json({
    error: "Internal server error",
    ...(isDev ? { location, details: message } : {}),
  })
}
