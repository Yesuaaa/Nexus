import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHealthSnapshot } from "../src/features/system-logs/model/system-health.ts"
const snapshot = {
  schemaVersion: 1,
  scope: "instance",
  observedAt: "2026-11-16T01:00:00.000Z",
  lastSuccessfulCheckAt: "2026-11-16T01:00:00.000Z",
  api: { status: "Healthy", uptimeSeconds: 120 },
  database: { status: "Healthy", checkedAt: "2026-11-16T01:00:00.000Z" },
  probeCacheSeconds: 10,
  messageExpiry: {
    status: "Unknown",
    running: false,
    startedAt: null,
    completedAt: null,
    lastResult: null,
    stale: true,
  },
  recentErrors: {
    status: "Unknown",
    retainedCount: 0,
    droppedCount: 0,
    evictedCount: 0,
    windowMinutes: 15,
    capacity: 1000,
    retentionHours: 24,
  },
}
test("health parser permits honest missing observations, reconstructs safe fields and rejects invented health", () => {
  assert.deepEqual(parseHealthSnapshot(snapshot), snapshot)
  assert.ok(
    !JSON.stringify(
      parseHealthSnapshot({
        ...snapshot,
        connectionString: "private-secret",
        database: { ...snapshot.database, sql: "private-query" },
      }),
    ).includes("private"),
  )
  for (const patch of [
    { scope: "deployment" },
    { observedAt: "invalid" },
    { api: { status: "Healthy", uptimeSeconds: -1 } },
    { messageExpiry: { ...snapshot.messageExpiry, status: "Healthy" } },
    { recentErrors: { ...snapshot.recentErrors, status: "Healthy" } },
    {
      recentErrors: {
        ...snapshot.recentErrors,
        status: "Degraded",
        retainedCount: 1001,
      },
    },
    {
      database: { ...snapshot.database, checkedAt: "2026-11-17T01:00:00.000Z" },
    },
  ])
    assert.throws(() => parseHealthSnapshot({ ...snapshot, ...patch }))
})
test("health parser preserves degraded/unavailable statuses and unknown buffer information", () => {
  const data = parseHealthSnapshot({
    ...snapshot,
    lastSuccessfulCheckAt: null,
    database: { ...snapshot.database, status: "Unavailable" },
    messageExpiry: {
      status: "Degraded",
      running: false,
      startedAt: snapshot.observedAt,
      completedAt: snapshot.observedAt,
      lastResult: "failed",
      stale: false,
    },
    recentErrors: {
      ...snapshot.recentErrors,
      retainedCount: null,
      droppedCount: null,
      evictedCount: null,
    },
  })
  assert.equal(data.database.status, "Unavailable")
  assert.equal(data.messageExpiry.lastResult, "failed")
  assert.equal(data.recentErrors.status, "Unknown")
})
