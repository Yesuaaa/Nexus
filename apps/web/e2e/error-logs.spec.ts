import { test, expect } from "@playwright/test"
import { restoreSession, configureRegressionTest } from "./regression-support"
configureRegressionTest()
const event = {
  schemaVersion: 1,
  errorId: "5168086b-2d02-4e99-9c14-93cef129aabc",
  requestId: "6168086b-2d02-4e99-9c14-93cef129aabc",
  occurredAt: "2026-11-16T01:00:00.000Z",
  moduleId: "people-hr",
  category: "application",
  severity: "error",
  operation: "http.request",
  code: "API_FAILURE",
  message: "Application request failed",
  method: "GET",
  routeTemplate: "/api/employees/:id",
  status: 500,
  actorId: null,
}
const envelope = {
  schemaVersion: 1,
  scope: "instance",
  durable: false,
  retentionHours: 24,
  capacity: 1000,
  droppedCount: 2,
  evictedCount: 3,
  expiredCount: 4,
  matchedRetainedCount: 101,
  returnedCount: 100,
  truncated: true,
  windowExpired: false,
  retentionCutoff: "2026-11-15T01:00:00.000Z",
  events: Array.from({ length: 100 }, (_, i) => ({
    ...event,
    errorId: `5168086b-2d02-4e99-9c14-${String(i).padStart(12, "0")}`,
  })),
}
for (const [device, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 820, 1180],
  ["laptop", 1280, 800],
  ["desktop", 1600, 1000],
] as const) {
  test(`${device}: error filters, safe details, bounded warnings and distinct loading/empty/expired/unavailable states`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await restoreSession(page, "SUPERADMIN")
    await page.route("**/api/system-logs/management-history?*", (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          events: [],
          nextCursor: null,
          snapshotBoundary: "2026-11-16T01:00:00.000Z",
          sources: [
            "audit.account-management",
            "audit.workforce-management",
          ].map((source) => ({
            source,
            status: "available",
            omittedCount: 0,
            reasonCode: null,
          })),
          complete: true,
          grouping: {
            scope: "page",
            eventCount: 0,
            operationCount: 0,
            operations: [],
          },
        },
      }),
    )
    let mode = "data"
    let release = () => {}
    const loading = new Promise<void>((resolve) => {
      release = resolve
    })
    const queries: string[] = []
    await page.route("**/api/system-logs/errors?*", async (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer test-session",
      )
      queries.push(new URL(route.request().url()).search)
      await loading
      if (mode === "unavailable" || mode === "locked")
        return route.fulfill({
          status: mode === "locked" ? 404 : 503,
          json: { error: "private-diagnostic-sentinel" },
        })
      return route.fulfill({
        json:
          mode === "data"
            ? envelope
            : {
                ...envelope,
                returnedCount: 0,
                matchedRetainedCount: 0,
                truncated: false,
                windowExpired: mode === "expired",
                events: [],
              },
      })
    })
    await page.goto("/system-logs")
    await page.getByRole("tab", { name: "Errors & Exceptions" }).click()
    const table = page.getByRole("table", { name: "Application error records" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    release()
    await expect(
      page.getByText("100 errors shown", { exact: false }),
    ).toBeVisible()
    await expect(page.getByText("Instance-local coverage only.")).toBeVisible()
    await expect(
      page.getByText("Response truncated to 100 errors.", { exact: false }),
    ).toBeVisible()
    await expect(
      page.getByText("3 evicted · 2 dropped · 4 expired records"),
    ).toBeVisible()
    await table
      .getByRole("button", { name: "Details", exact: true })
      .first()
      .click()
    await expect(
      page.getByRole("heading", { name: "Error details" }),
    ).toBeVisible()
    await expect(page.getByText(event.requestId, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Close error details" }).click()
    await page.getByRole("combobox", { name: "Error module filter" }).click()
    await page.getByRole("option", { name: "People & HR", exact: true }).click()
    await page.getByLabel("HTTP status", { exact: true }).fill("500")
    await page.getByLabel("From time (UTC)").fill("2026-11-16T00:00")
    await page.getByRole("button", { name: "Apply error filters" }).click()
    await expect.poll(() => queries.at(-1)).toContain("moduleId=people-hr")
    expect(queries.at(-1)).toContain("status=500")
    expect(queries.at(-1)).toContain("from=2026-11-16T00%3A00%3A00.000Z")
    for (const next of ["empty", "expired", "unavailable", "locked"]) {
      mode = next
      await page.getByRole("button", { name: "Refresh errors" }).click()
      await expect(
        page.getByText(
          next === "empty"
            ? "No retained errors match these filters."
            : next === "expired"
              ? "Selected time window has expired"
              : next === "unavailable"
                ? "Error logs could not be loaded."
                : "Error logs are unavailable.",
          { exact: false },
        ),
      ).toBeVisible()
      await expect(
        table.getByRole("button", { name: "Details", exact: true }),
      ).toHaveCount(0)
    }
    await expect(page.locator("body")).not.toContainText(
      "private-diagnostic-sentinel",
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole("tab", { name: "Activity & Audit" }).click()
    await expect(
      page.getByRole("form", { name: "Filter audit history" }),
    ).toBeVisible()
  })
}
