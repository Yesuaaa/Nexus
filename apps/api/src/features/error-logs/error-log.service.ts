import type { AuthContext } from "../auth/auth.middleware.js"
import { HttpError } from "../../shared/http-error.js"
import { authorizeDiagnosticRead } from "../system-logs/diagnostic-access.js"
import { errorLogs, errorModules } from "./error-log.js"

const keys = [
  "moduleId",
  "category",
  "severity",
  "status",
  "from",
  "to",
] as const
function parseFilters(input: unknown, now: Date) {
  const invalid = (): never => {
    throw new HttpError(400, "Invalid error log filters")
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return invalid()
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (
      !keys.includes(key as (typeof keys)[number]) ||
      typeof value !== "string"
    )
      return invalid()
    values[key] = value
  }
  if (
    values.moduleId !== undefined &&
    !errorModules.some((m) => m === values.moduleId)
  )
    return invalid()
  if (
    values.category !== undefined &&
    !["application", "database", "internal"].includes(values.category)
  )
    return invalid()
  if (values.severity !== undefined && values.severity !== "error")
    return invalid()
  if (values.status !== undefined && !/^[1-5]\d{2}$/.test(values.status))
    return invalid()
  const cutoff = new Date(now.getTime() - 86400000).toISOString()
  const from = values.from ?? cutoff,
    to = values.to ?? now.toISOString()
  for (const date of [from, to]) {
    if (
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString() !== date
    )
      return invalid()
  }
  if (from > to) return invalid()
  return {
    ...values,
    moduleId: values.moduleId,
    category: values.category,
    severity: values.severity,
    status: values.status,
    from,
    to,
    cutoff,
  }
}

/** Sanitized read contract; HTTP use stays behind the attested offline router. */
export async function listErrorLogs(auth: AuthContext, input: unknown = {}) {
  await authorizeDiagnosticRead(auth, "Error logs unavailable")
  const filters = parseFilters(input, new Date())
  let retained
  try {
    retained = errorLogs.store.read()
  } catch {
    throw new HttpError(503, "Error logs unavailable")
  }
  const events = retained.filter(
    (e) =>
      e.occurredAt >= filters.from &&
      e.occurredAt <= filters.to &&
      (!filters.moduleId || e.moduleId === filters.moduleId) &&
      (!filters.category || e.category === filters.category) &&
      (!filters.severity || e.severity === filters.severity) &&
      (!filters.status || e.status === Number(filters.status)),
  )
  return {
    schemaVersion: 1 as const,
    scope: "instance" as const,
    durable: false,
    retentionHours: 24,
    capacity: 1000,
    droppedCount: errorLogs.droppedCount,
    evictedCount: errorLogs.store.evictedCount,
    expiredCount: errorLogs.store.expiredCount,
    retentionCutoff: filters.cutoff,
    windowExpired: filters.to <= filters.cutoff,
    matchedRetainedCount: events.length,
    returnedCount: Math.min(events.length, 100),
    truncated: events.length > 100,
    events: events.slice(0, 100),
  }
}
