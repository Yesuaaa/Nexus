import { HttpError } from "../../shared/http-error.js"
import { ServiceOperationLogWriteError } from "./log-write-error.js"

export const serviceIncidentCodes = [
  "ACTIVITY_LOG_PERSISTENCE_FAILED",
  "DATABASE_UNAVAILABLE",
  "DATABASE_TIMEOUT",
  "DATABASE_OPERATION_FAILED",
  "FILE_STORAGE_UNAVAILABLE",
  "DEPENDENCY_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "UNEXPECTED_SERVER_ERROR",
] as const

export type ServiceIncidentCode = (typeof serviceIncidentCodes)[number]
export type ServiceIncidentDiagnostic = {
  code: ServiceIncidentCode
  reason: string
}

const databaseUnavailableCodes = new Set([
  "P1001",
  "P1002",
  "P1017",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
])
const databaseTimeoutCodes = new Set(["P1008", "P2024", "P2028", "ETIMEDOUT"])
const databaseOperationCodes = new Set([
  "P2000",
  "P2004",
  "P2010",
  "P2026",
  "P2039",
])
const fileStorageCodes = new Set(["EACCES", "EIO", "ENOSPC", "EPERM", "EROFS"])

function codeOf(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string"
  )
    return value.code
  if (
    typeof value === "object" &&
    value !== null &&
    "errorCode" in value &&
    typeof value.errorCode === "string"
  )
    return value.errorCode
  return undefined
}

function causes(error: unknown): unknown[] {
  const chain: unknown[] = []
  let current: unknown = error
  for (let depth = 0; current !== undefined && depth < 5; depth += 1) {
    chain.push(current)
    current = current instanceof Error ? current.cause : undefined
  }
  return chain
}

/** Closed, payload-free classification. Never returns an exception message. */
export function classifyServiceIncident(
  error: unknown,
  status: number,
  endpoint?: string,
): ServiceIncidentDiagnostic {
  const chain = causes(error)
  if (chain.some((value) => value instanceof ServiceOperationLogWriteError))
    return {
      code: "ACTIVITY_LOG_PERSISTENCE_FAILED",
      reason:
        "The activity log could not be saved, so the requested change was rolled back.",
    }
  const codes = chain.flatMap((value) => {
    const code = codeOf(value)
    return code ? [code] : []
  })
  if (codes.some((code) => databaseTimeoutCodes.has(code)))
    return {
      code: "DATABASE_TIMEOUT",
      reason: "The database operation timed out before it could finish.",
    }
  if (codes.some((code) => databaseUnavailableCodes.has(code)))
    return {
      code: "DATABASE_UNAVAILABLE",
      reason: "The database was temporarily unavailable.",
    }
  if (
    endpoint?.includes("/files") &&
    codes.some((code) => fileStorageCodes.has(code))
  )
    return {
      code: "FILE_STORAGE_UNAVAILABLE",
      reason: "File storage was unavailable while processing the request.",
    }
  if (codes.some((code) => databaseOperationCodes.has(code)))
    return {
      code: "DATABASE_OPERATION_FAILED",
      reason: "The database could not complete the operation.",
    }
  if (
    chain.some((value) => value instanceof Error && value.name === "AbortError")
  )
    return {
      code: "REQUEST_TIMEOUT",
      reason: "The server operation timed out before it could finish.",
    }
  if (
    status === 503 ||
    chain.some((value) => value instanceof HttpError && value.status === 503)
  )
    return {
      code: "DEPENDENCY_UNAVAILABLE",
      reason: "A required service was temporarily unavailable.",
    }
  return {
    code: "UNEXPECTED_SERVER_ERROR",
    reason: "An unexpected server error occurred.",
  }
}
