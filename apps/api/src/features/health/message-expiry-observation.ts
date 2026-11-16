export type HealthStatus = "Healthy" | "Degraded" | "Unavailable" | "Unknown"

/** Observes the existing job only; owns no timer and performs no job work. */
export class MessageExpiryObservation {
  private running = 0
  private startedAt: string | null = null
  private completedAt: string | null = null
  private result: "succeeded" | "failed" | null = null
  constructor(private readonly now: () => number = Date.now) {}
  async run(work: () => Promise<unknown>) {
    this.running++
    this.startedAt = new Date(this.now()).toISOString()
    try {
      const result = await work()
      this.result = "succeeded"
      return result
    } catch (error: unknown) {
      this.result = "failed"
      throw error
    } finally {
      this.completedAt = new Date(this.now()).toISOString()
      this.running--
    }
  }
  snapshot() {
    const stale =
      this.completedAt === null ||
      this.now() - Date.parse(this.completedAt) > 75 * 60_000
    const overdue =
      this.running > 0 &&
      this.startedAt !== null &&
      this.now() - Date.parse(this.startedAt) > 75 * 60_000
    const status: HealthStatus =
      stale || overdue || this.running > 0
        ? "Unknown"
        : this.result === "failed"
          ? "Degraded"
          : "Healthy"
    return {
      status,
      running: this.running > 0,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      lastResult: this.result,
      stale: stale || overdue,
    }
  }
}
export const messageExpiryObservation = new MessageExpiryObservation()
