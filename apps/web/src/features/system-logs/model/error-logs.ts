export const errorModules = [
  "administration",
  "people-hr",
  "service-operations",
  "project-management",
  "attendance-monitoring",
  "platform",
]
export const errorMessages = {
  API_FAILURE: "Application request failed",
  DATABASE_FAILURE: "Database operation failed",
  INTERNAL_FAILURE: "Internal operation failed",
} as const
export type ErrorEvent = {
  errorId: string
  occurredAt: string
  moduleId: string
  category: string
  severity: "error"
  code: keyof typeof errorMessages
  message: string
  operation: string
  method: string | null
  routeTemplate: string | null
  status: number | null
  requestId: string
  actorId: string | null
}
export type ErrorFilters = {
  moduleId: string
  category: string
  severity: string
  status: string
  from: string
  to: string
}
export const defaultErrorFilters = (): ErrorFilters => ({
  moduleId: "",
  category: "",
  severity: "",
  status: "",
  from: "",
  to: "",
})
export function errorQuery(filters: ErrorFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    if (key === "from" || key === "to") {
      const date = new Date(`${value}Z`)
      if (!Number.isFinite(date.getTime()))
        throw new Error("Choose valid UTC dates.")
      params.set(key, date.toISOString())
    } else params.set(key, value)
  }
  if (filters.from && filters.to && filters.from > filters.to)
    throw new Error("From time must precede to time.")
  return params.toString()
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)
const timestamp = (v: unknown): v is string =>
  typeof v === "string" &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
export function parseErrorPage(input: unknown) {
  const invalid = (): never => {
    throw new Error("Error logs returned an invalid response.")
  }
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    input.scope !== "instance" ||
    input.durable !== false ||
    input.retentionHours !== 24 ||
    input.capacity !== 1000 ||
    !Array.isArray(input.events) ||
    input.events.length > 100 ||
    !timestamp(input.retentionCutoff) ||
    typeof input.windowExpired !== "boolean" ||
    typeof input.truncated !== "boolean"
  )
    return invalid()
  const droppedCount = input.droppedCount,
    evictedCount = input.evictedCount,
    expiredCount = input.expiredCount,
    matchedRetainedCount = input.matchedRetainedCount,
    returnedCount = input.returnedCount
  if (
    ![
      droppedCount,
      evictedCount,
      expiredCount,
      matchedRetainedCount,
      returnedCount,
    ].every(count) ||
    !count(matchedRetainedCount) ||
    !count(returnedCount) ||
    matchedRetainedCount > 1000 ||
    returnedCount !== input.events.length ||
    returnedCount !== Math.min(matchedRetainedCount, 100) ||
    input.truncated !== matchedRetainedCount > 100
  )
    return invalid()
  const events: ErrorEvent[] = input.events.map((row: unknown) => {
    if (
      !object(row) ||
      row.schemaVersion !== 1 ||
      !uuid(row.errorId) ||
      !uuid(row.requestId) ||
      !timestamp(row.occurredAt) ||
      !errorModules.includes(String(row.moduleId)) ||
      !["application", "database", "internal"].includes(String(row.category)) ||
      row.severity !== "error" ||
      typeof row.code !== "string" ||
      !Object.hasOwn(errorMessages, row.code) ||
      !["http.request", "messages.expire", "database.probe"].includes(
        String(row.operation),
      )
    )
      return invalid()
    if (
      row.status !== null &&
      (typeof row.status !== "number" ||
        !Number.isInteger(row.status) ||
        row.status < 100 ||
        row.status > 599)
    )
      return invalid()
    if (
      row.actorId !== null &&
      (typeof row.actorId !== "string" ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(row.actorId))
    )
      return invalid()
    if (
      row.method !== null &&
      ![
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "OTHER",
      ].includes(String(row.method))
    )
      return invalid()
    if (
      row.routeTemplate !== null &&
      (typeof row.routeTemplate !== "string" ||
        !/^\/api\/[A-Za-z0-9_:/.-]{0,200}$/.test(row.routeTemplate))
    )
      return invalid()
    const code = row.code as keyof typeof errorMessages
    // Reconstruct the approved projection; arbitrary response fields/messages never reach UI.
    return {
      errorId: row.errorId,
      requestId: row.requestId,
      occurredAt: row.occurredAt,
      moduleId: String(row.moduleId),
      category: String(row.category),
      severity: "error",
      code,
      message: errorMessages[code],
      operation: String(row.operation),
      method: row.method as string | null,
      routeTemplate: row.routeTemplate as string | null,
      status: row.status as number | null,
      actorId: row.actorId as string | null,
    }
  })
  return {
    events,
    droppedCount: droppedCount as number,
    evictedCount: evictedCount as number,
    expiredCount: expiredCount as number,
    matchedRetainedCount,
    returnedCount,
    truncated: input.truncated,
    windowExpired: input.windowExpired,
    retentionCutoff: input.retentionCutoff,
  }
}
export type ErrorPage = ReturnType<typeof parseErrorPage>
