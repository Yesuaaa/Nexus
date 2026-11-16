import { randomUUID } from "node:crypto"
import type { RequestHandler, Request } from "express"
import { HttpError } from "../../shared/http-error.js"
import { isTemporaryDatabaseError } from "../../lib/database-read.js"
import { isRecordId } from "../../shared/validation.js"

export const errorModules = [
  "administration",
  "people-hr",
  "service-operations",
  "project-management",
  "attendance-monitoring",
  "platform",
] as const
export type ErrorModule = (typeof errorModules)[number]
export type ErrorOperation =
  "http.request" | "messages.expire" | "database.probe"
export type ErrorRecord = {
  schemaVersion: 1
  errorId: string
  occurredAt: string
  category: "application" | "database" | "internal"
  severity: "error"
  moduleId: ErrorModule
  operation: ErrorOperation
  code: "DATABASE_FAILURE" | "API_FAILURE" | "INTERNAL_FAILURE"
  message: string
  method: string | null
  routeTemplate: string | null
  status: number | null
  requestId: string
  actorId: string | null
}
type StoredError = {
  record: ErrorRecord
  diagnosticCode: string | null
  retryable: boolean
}
const diagnosticCodes = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2028",
  "P2034",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
])
const ttl = 24 * 60 * 60 * 1000
const capacity = 1000

/** Best-effort instance-local diagnostics, never durable security evidence. */
export class ErrorLogStore {
  private rows: StoredError[] = []
  private evictions = 0
  private expirations = 0
  get expiredCount() {
    return this.expirations
  }
  get evictedCount() {
    return this.evictions
  }
  constructor(private readonly now: () => number = Date.now) {}
  prune() {
    const before = this.rows.length
    const cutoff = this.now() - ttl
    this.rows = this.rows.filter(
      ({ record }) => Date.parse(record.occurredAt) > cutoff,
    )
    this.expirations = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.expirations + before - this.rows.length,
    )
  }
  append(row: StoredError) {
    this.prune()
    if (this.rows.length === capacity) {
      this.rows.shift()
      this.evictions = Math.min(Number.MAX_SAFE_INTEGER, this.evictions + 1)
    }
    this.rows.push(structuredClone(row))
  }
  /** Repository boundary; HTTP callers must use the authorized read service. */
  read() {
    this.prune()
    return this.rows
      .slice()
      .reverse()
      .map(({ record }) => ({ ...record }))
  }
}

const mounts: Record<string, ErrorModule> = {
  users: "administration",
  modules: "administration",
  employees: "people-hr",
  departments: "people-hr",
  attendance: "attendance-monitoring",
  services: "service-operations",
  clients: "service-operations",
  client: "service-operations",
  "client-services": "service-operations",
  "service-requests": "service-operations",
  "request-inbox": "service-operations",
  "request-workflows": "service-operations",
  "request-conversations": "service-operations",
  "administrative-requests": "service-operations",
  projects: "project-management",
  "project-workspace": "project-management",
  "project-management": "project-management",
  "project-conversations": "project-management",
  "administrative-projects": "project-management",
  "administrative-workload": "project-management",
  "administrative-conversations": "project-management",
  workload: "project-management",
}

export class ErrorLogCollector {
  private readonly contexts = new WeakMap<
    Request,
    { id: string; captured: boolean }
  >()
  private dropped = 0
  constructor(
    readonly store = new ErrorLogStore(),
    private readonly now: () => number = Date.now,
  ) {}
  get droppedCount() {
    return this.dropped
  }
  private drop() {
    this.dropped = Math.min(Number.MAX_SAFE_INTEGER, this.dropped + 1)
  }
  readonly middleware: RequestHandler = (request, response, next) => {
    this.contexts.set(request, { id: randomUUID(), captured: false })
    // Catches routes with their own error boundary or direct 5xx responses.
    response.once("finish", () => {
      if (response.statusCode >= 500)
        this.captureRequest(request, response.statusCode)
    })
    next()
  }
  captureRequest(
    request: Request,
    status: number,
    error?: unknown,
    committedStatus = status,
  ) {
    try {
      if (status < 500) return
      const context = this.contexts.get(request)
      if (context?.captured) return
      if (context) context.captured = true
      const mount = request.originalUrl.split("?", 1)[0].split("/")[2] ?? ""
      const knownMount =
        Object.hasOwn(mounts, mount) ||
        [
          "auth",
          "health",
          "ready",
          "system-logs",
          "internal-conversations",
        ].includes(mount)
      const path: unknown = request.route?.path
      const routeTemplate =
        knownMount &&
        typeof path === "string" &&
        /^\/[A-Za-z0-9_:/.-]{0,180}$/.test(path)
          ? path.startsWith("/api/")
            ? path
            : path === `/${mount}`
              ? `/api${path}`
              : `/api/${mount}${path === "/" ? "" : path}`
          : null
      this.write(error, {
        moduleId: Object.hasOwn(mounts, mount) ? mounts[mount] : "platform",
        operation: "http.request",
        method: [
          "GET",
          "HEAD",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
        ].includes(request.method)
          ? request.method
          : "OTHER",
        routeTemplate,
        status: committedStatus,
        requestId: context?.id ?? randomUUID(),
        actorId:
          request.auth && isRecordId(request.auth.user.id)
            ? request.auth.user.id
            : null,
      })
    } catch {
      this.drop()
    }
  }
  /** Trusted server operations only; no arbitrary context or messages accepted. */
  captureInternal(
    error: unknown,
    moduleId: ErrorModule,
    operation: Exclude<ErrorOperation, "http.request">,
  ) {
    try {
      this.write(error, {
        moduleId: errorModules.includes(moduleId) ? moduleId : "platform",
        operation:
          operation === "messages.expire" ? operation : "database.probe",
        method: null,
        routeTemplate: null,
        status: null,
        requestId: randomUUID(),
        actorId: null,
      })
    } catch {
      this.drop()
    }
  }
  private write(
    error: unknown,
    context: Pick<
      ErrorRecord,
      | "moduleId"
      | "operation"
      | "method"
      | "routeTemplate"
      | "status"
      | "requestId"
      | "actorId"
    >,
  ) {
    const source =
      error instanceof HttpError && error.cause ? error.cause : error
    const rawCode: unknown =
      source instanceof Error && "code" in source ? source.code : null
    const diagnosticCode =
      typeof rawCode === "string" && diagnosticCodes.has(rawCode)
        ? rawCode
        : null
    const database =
      isTemporaryDatabaseError(source) ||
      diagnosticCode !== null ||
      (source instanceof Error &&
        [
          "PrismaClientKnownRequestError",
          "PrismaClientUnknownRequestError",
          "PrismaClientInitializationError",
          "PrismaClientRustPanicError",
        ].includes(source.name))
    const code = database
      ? "DATABASE_FAILURE"
      : context.operation === "http.request"
        ? "API_FAILURE"
        : "INTERNAL_FAILURE"
    this.store.append({
      record: {
        schemaVersion: 1,
        errorId: randomUUID(),
        occurredAt: new Date(this.now()).toISOString(),
        category: database
          ? "database"
          : context.operation === "http.request"
            ? "application"
            : "internal",
        severity: "error",
        code,
        message: database
          ? "Database operation failed"
          : code === "API_FAILURE"
            ? "Application request failed"
            : "Internal operation failed",
        ...context,
      },
      diagnosticCode,
      retryable: isTemporaryDatabaseError(source),
    })
  }
}

export const errorLogs = new ErrorLogCollector()
const expiryTimer = setInterval(() => errorLogs.store.prune(), 60_000)
expiryTimer.unref()
