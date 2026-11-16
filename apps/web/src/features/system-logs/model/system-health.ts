export type HealthStatus = "Healthy" | "Degraded" | "Unavailable" | "Unknown"
export type HealthSnapshot = {
  schemaVersion: 1
  scope: "instance"
  observedAt: string
  lastSuccessfulCheckAt: string | null
  api: { status: HealthStatus; uptimeSeconds: number }
  database: { status: HealthStatus; checkedAt: string }
  probeCacheSeconds: 10
  messageExpiry: {
    status: HealthStatus
    running: boolean
    startedAt: string | null
    completedAt: string | null
    lastResult: "succeeded" | "failed" | null
    stale: boolean
  }
  recentErrors: {
    status: HealthStatus
    retainedCount: number | null
    droppedCount: number | null
    evictedCount: number | null
    windowMinutes: 15
    capacity: 1000
    retentionHours: 24
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)
const status = (value: unknown): value is HealthStatus =>
  typeof value === "string" &&
  ["Healthy", "Degraded", "Unavailable", "Unknown"].includes(value)
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
const time = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value
const optionalTime = (value: unknown) => value === null || time(value)
export function parseHealthSnapshot(input: unknown): HealthSnapshot {
  const invalid = (): never => {
    throw new Error("System Health returned an invalid response.")
  }
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    input.scope !== "instance" ||
    !time(input.observedAt) ||
    !optionalTime(input.lastSuccessfulCheckAt) ||
    input.probeCacheSeconds !== 10 ||
    !object(input.api) ||
    !object(input.database) ||
    !object(input.messageExpiry) ||
    !object(input.recentErrors)
  )
    return invalid()
  const { api, database, messageExpiry: job, recentErrors: errors } = input
  if (
    !status(api.status) ||
    !count(api.uptimeSeconds) ||
    !status(database.status) ||
    !time(database.checkedAt) ||
    !status(job.status) ||
    typeof job.running !== "boolean" ||
    typeof job.stale !== "boolean" ||
    !optionalTime(job.startedAt) ||
    !optionalTime(job.completedAt) ||
    (job.lastResult !== null &&
      job.lastResult !== "succeeded" &&
      job.lastResult !== "failed") ||
    !status(errors.status) ||
    errors.windowMinutes !== 15 ||
    errors.capacity !== 1000 ||
    errors.retentionHours !== 24 ||
    ![errors.retainedCount, errors.droppedCount, errors.evictedCount].every(
      (value) => value === null || count(value),
    ) ||
    (typeof errors.retainedCount === "number" && errors.retainedCount > 1000)
  )
    return invalid()
  if (
    (job.lastResult === null ||
      job.completedAt === null ||
      job.startedAt === null ||
      job.stale ||
      job.running) &&
    job.status !== "Unknown"
  )
    return invalid()
  if (job.status === "Healthy" && job.lastResult !== "succeeded")
    return invalid()
  if (job.status === "Degraded" && job.lastResult !== "failed") return invalid()
  if (
    errors.status !==
    (typeof errors.retainedCount === "number" && errors.retainedCount > 0
      ? "Degraded"
      : "Unknown")
  )
    return invalid()
  if (
    database.checkedAt > input.observedAt ||
    (typeof input.lastSuccessfulCheckAt === "string" &&
      input.lastSuccessfulCheckAt > input.observedAt)
  )
    return invalid()
  // Explicit safe fields; no API-provided prose or arbitrary details.
  return {
    schemaVersion: 1,
    scope: "instance",
    observedAt: input.observedAt,
    lastSuccessfulCheckAt: input.lastSuccessfulCheckAt as string | null,
    api: { status: api.status, uptimeSeconds: api.uptimeSeconds },
    database: { status: database.status, checkedAt: database.checkedAt },
    probeCacheSeconds: 10,
    messageExpiry: {
      status: job.status,
      running: job.running,
      stale: job.stale,
      startedAt: job.startedAt as string | null,
      completedAt: job.completedAt as string | null,
      lastResult: job.lastResult,
    },
    recentErrors: {
      status: errors.status,
      retainedCount: errors.retainedCount as number | null,
      droppedCount: errors.droppedCount as number | null,
      evictedCount: errors.evictedCount as number | null,
      windowMinutes: 15,
      capacity: 1000,
      retentionHours: 24,
    },
  }
}
