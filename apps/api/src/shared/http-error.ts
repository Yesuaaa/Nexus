/**
 * The single HTTP error type for the API.
 *
 * Services throw `HttpError` (or call `fail`) and the app-level `handleError`
 * turns it into `{ error: message }` with `status`. Controllers should not
 * catch it: Express 5 forwards rejected handlers to the error middleware.
 * 4xx HttpErrors are expected outcomes and are never logged as server errors.
 *
 * The former per-feature classes (`EmployeeError`, `ServiceRequestsError`,
 * ...) are aliases of this class, so `instanceof` checks keep working.
 */
import type { ErrorRequestHandler } from "express"
import { isPrismaCode } from "../lib/errors.js"

export class HttpError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(
    status: number,
    message: string,
    details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "HttpError"
    this.status = status
    if (details !== undefined) this.details = details
  }
}

/** Throws an `HttpError`; typed `never` so it narrows like `throw`. */
export function fail(
  status: number,
  message: string,
  details?: unknown,
): never {
  throw new HttpError(status, message, details)
}

/** Prisma write failures that map to a client-facing response. */
export type PrismaErrorCode = "P2002" | "P2003" | "P2025" | "P2034"
export type PrismaErrorResponse = { status: number; message: string }
export type PrismaErrorResponses = Partial<
  Record<PrismaErrorCode, PrismaErrorResponse>
>

const defaultPrismaResponses: Record<PrismaErrorCode, PrismaErrorResponse> = {
  // Unique constraint violation
  P2002: {
    status: 409,
    message: "A record with these details already exists",
  },
  // Foreign key violation: still referenced by (or referencing) other records
  P2003: {
    status: 409,
    message:
      "This record is linked to other data and can't be changed or deleted",
  },
  // Record to update/delete no longer exists
  P2025: { status: 409, message: "This record changed; refresh and retry" },
  // Serialization failure / write conflict
  P2034: { status: 409, message: "This record changed; refresh and retry" },
}

const prismaCodes = Object.keys(defaultPrismaResponses) as PrismaErrorCode[]

/**
 * The `HttpError` a known Prisma failure maps to, or `null` for anything
 * else. `overrides` lets a router give a code a domain-specific response.
 */
export function prismaHttpError(
  error: unknown,
  overrides: PrismaErrorResponses = {},
): HttpError | null {
  const code = prismaCodes.find((candidate) => isPrismaCode(error, candidate))
  if (!code) return null
  const { status, message } = overrides[code] ?? defaultPrismaResponses[code]
  return new HttpError(
    status,
    message,
    error instanceof Error ? error.message : undefined,
    { cause: error },
  )
}

/**
 * Router-level error middleware that gives known Prisma failures
 * route-specific messages; `handleError` applies the defaults everywhere else.
 */
export function mapPrismaErrors(
  overrides: PrismaErrorResponses,
): ErrorRequestHandler {
  return (error, _request, _response, next) =>
    next(prismaHttpError(error, overrides) ?? error)
}
