import assert from "node:assert/strict"
import { test } from "node:test"
import {
  defaultErrorFilters,
  errorQuery,
  parseErrorPage,
} from "../src/features/system-logs/model/error-logs.ts"
const event = {
  schemaVersion: 1,
  errorId: "5168086b-2d02-4e99-9c14-93cef129aabc",
  requestId: "6168086b-2d02-4e99-9c14-93cef129aabc",
  occurredAt: "2026-11-16T01:00:00.000Z",
  moduleId: "administration",
  category: "application",
  severity: "error",
  operation: "http.request",
  code: "API_FAILURE",
  message: "private raw exception",
  method: "GET",
  routeTemplate: "/api/users/:id",
  status: 500,
  actorId: null,
  stack: "private stack",
}
const page = {
  schemaVersion: 1,
  scope: "instance",
  durable: false,
  retentionHours: 24,
  capacity: 1000,
  droppedCount: 2,
  evictedCount: 3,
  expiredCount: 4,
  matchedRetainedCount: 1,
  returnedCount: 1,
  truncated: false,
  windowExpired: false,
  retentionCutoff: "2026-11-15T01:00:00.000Z",
  events: [event],
}
test("error filters serialize explicit UTC dates and preserve supported filters", () => {
  assert.equal(errorQuery(defaultErrorFilters()), "")
  const query = new URLSearchParams(
    errorQuery({
      ...defaultErrorFilters(),
      moduleId: "platform",
      status: "503",
      from: "2026-11-16T01:00",
      to: "2026-11-16T02:00",
    }),
  )
  assert.equal(query.get("from"), "2026-11-16T01:00:00.000Z")
  assert.equal(query.get("status"), "503")
  assert.throws(() => errorQuery({ ...defaultErrorFilters(), from: "invalid" }))
  assert.throws(() =>
    errorQuery({
      ...defaultErrorFilters(),
      from: "2026-11-16T02:00",
      to: "2026-11-16T01:00",
    }),
  )
})
test("error parser reconstructs safe text and rejects unsafe or inconsistent envelopes", () => {
  const parsed = parseErrorPage(page)
  assert.equal(parsed.events[0].message, "Application request failed")
  assert.ok(!JSON.stringify(parsed).includes("private"))
  for (const change of [
    { durable: true },
    { scope: "global" },
    { returnedCount: 2 },
    { matchedRetainedCount: 1001 },
    { droppedCount: -1 },
    { truncated: true },
    { events: [{ ...event, code: "private" }] },
    { events: [{ ...event, routeTemplate: "/api/users?token=private" }] },
    { events: [{ ...event, requestId: "private" }] },
  ])
    assert.throws(() => parseErrorPage({ ...page, ...change }))
  assert.deepEqual(
    parseErrorPage({
      ...page,
      events: [],
      returnedCount: 0,
      matchedRetainedCount: 0,
      windowExpired: true,
    }).events,
    [],
  )
})
