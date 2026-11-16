import { checkDatabase } from "./database-readiness.js"
import { messageExpiryObservation } from "./message-expiry-observation.js"
import { errorLogs } from "../error-logs/error-log.js"

/** One cached/in-flight bounded readiness probe per process, never cached auth. */
export class SystemHealthObserver {
  private cached: {
    status: "Healthy" | "Unavailable"
    checkedAt: string
  } | null = null
  private pending: Promise<NonNullable<SystemHealthObserver["cached"]>> | null =
    null
  private lastSuccess: string | null = null
  constructor(
    private readonly probe: () => Promise<
      "ok" | "not-configured" | "unavailable"
    > = checkDatabase,
    private readonly now: () => number = Date.now,
  ) {}
  private database() {
    if (this.cached && this.now() - Date.parse(this.cached.checkedAt) < 10_000)
      return Promise.resolve(this.cached)
    if (this.pending) return this.pending
    this.pending = (async () => {
      let available = false
      try {
        available = (await this.probe()) === "ok"
      } catch {
        /* Fixed unavailable result, never expose a cause. */
      }
      const observation = {
        status: available ? ("Healthy" as const) : ("Unavailable" as const),
        checkedAt: new Date(this.now()).toISOString(),
      }
      this.cached = observation
      return observation
    })().finally(() => {
      this.pending = null
    })
    return this.pending
  }
  async observe(shuttingDown: boolean | (() => boolean) = false) {
    const database = await this.database()
    const draining =
      typeof shuttingDown === "function" ? shuttingDown() : shuttingDown
    const observedAt = new Date(this.now()).toISOString()
    if (database.status === "Healthy" && !draining)
      this.lastSuccess = database.checkedAt
    let recentErrors: {
      status: "Degraded" | "Unknown"
      retainedCount: number | null
      droppedCount: number | null
      evictedCount: number | null
    }
    try {
      const cutoff = this.now() - 15 * 60_000
      const retainedCount = errorLogs.store
        .read()
        .filter(
          (event) =>
            Date.parse(event.occurredAt) >= cutoff &&
            Date.parse(event.occurredAt) <= this.now(),
        ).length
      recentErrors = {
        status: retainedCount > 0 ? "Degraded" : "Unknown",
        retainedCount,
        droppedCount: errorLogs.droppedCount,
        evictedCount: errorLogs.store.evictedCount,
      }
    } catch {
      recentErrors = {
        status: "Unknown",
        retainedCount: null,
        droppedCount: null,
        evictedCount: null,
      }
    }
    return {
      schemaVersion: 1 as const,
      scope: "instance" as const,
      observedAt,
      lastSuccessfulCheckAt: this.lastSuccess,
      api: {
        status: draining ? ("Degraded" as const) : ("Healthy" as const),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      database,
      probeCacheSeconds: 10,
      messageExpiry: messageExpiryObservation.snapshot(),
      recentErrors: {
        ...recentErrors,
        windowMinutes: 15 as const,
        capacity: 1000 as const,
        retentionHours: 24 as const,
      },
    }
  }
}
export const systemHealthObserver = new SystemHealthObserver()
