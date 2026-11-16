import { test, expect } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"
configureRegressionTest()
const time = "2026-11-16T01:00:00.000Z"
const snapshot = {
  schemaVersion: 1,
  scope: "instance",
  observedAt: time,
  lastSuccessfulCheckAt: time,
  api: { status: "Healthy", uptimeSeconds: 120 },
  database: { status: "Healthy", checkedAt: time },
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
for (const [device, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 820, 1180],
  ["laptop", 1280, 800],
  ["desktop", 1600, 1000],
] as const) {
  test(`${device}: System Health has manual, instance-local, honest status and unavailable states`, async ({
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
          snapshotBoundary: time,
          sources: [
            {
              source: "audit.account-management",
              status: "available",
              omittedCount: 0,
              reasonCode: null,
            },
          ],
          complete: true,
          grouping: { scope: "page", eventCount: 0, operationCount: 0 },
        },
      }),
    )
    let mode = "healthy",
      requests = 0
    let release = () => {}
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route("**/api/system-logs/health", async (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer test-session",
      )
      requests++
      await waiting
      if (["unavailable", "locked", "denied"].includes(mode))
        return route.fulfill({
          status: mode === "locked" ? 404 : mode === "denied" ? 403 : 503,
          json: { error: "private-health-secret" },
        })
      return route.fulfill({
        json:
          mode === "healthy"
            ? snapshot
            : {
                ...snapshot,
                database: { ...snapshot.database, status: "Unavailable" },
                messageExpiry: {
                  status: "Degraded",
                  running: false,
                  startedAt: time,
                  completedAt: time,
                  lastResult: "failed",
                  stale: false,
                },
                recentErrors: {
                  ...snapshot.recentErrors,
                  status: "Degraded",
                  retainedCount: 2,
                  droppedCount: 1,
                },
              },
      })
    })
    await page.goto("/system-logs")
    await page.getByRole("tab", { name: "System Health", exact: true }).click()
    const region = page.getByRole("region", {
      name: "System Health observations",
    })
    await expect(region).toHaveAttribute("aria-busy", "true")
    release()
    const card = (name: string) =>
      region
        .locator("article")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
    await expect(
      card("API availability").getByText("Healthy", { exact: true }),
    ).toBeVisible()
    await expect(
      card("Message-expiry job").getByText("Unknown", { exact: true }),
    ).toBeVisible()
    await expect(
      card("Recent error observations").getByText("Unknown", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Instance-local observations only."),
    ).toBeVisible()
    await expect(
      page.getByText("Unknown — no execution observed", { exact: false }),
    ).toBeVisible()
    expect(requests).toBe(1)
    mode = "degraded"
    await page
      .getByRole("button", { name: "Refresh health", exact: true })
      .click()
    await expect(
      card("Database readiness").getByText("Unavailable", { exact: true }),
    ).toBeVisible()
    await expect(
      card("Message-expiry job").getByText("Degraded", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Last successful readiness check", { exact: true }),
    ).toBeVisible()
    for (const value of ["unavailable", "locked", "denied"]) {
      mode = value
      await page
        .getByRole("button", { name: "Refresh health", exact: true })
        .click()
      await expect(
        page
          .getByRole("tabpanel", { name: "System Health", exact: true })
          .getByRole("alert"),
      ).toContainText(
        value === "locked"
          ? "Production access remains disabled"
          : value === "denied"
            ? "cannot access System Health"
            : "Component health is unknown",
      )
      await expect(
        card("Database readiness").getByText("Unknown", { exact: true }),
      ).toBeVisible()
    }
    mode = "healthy"
    await page
      .getByRole("button", { name: "Retry health", exact: true })
      .click()
    await expect(
      card("API availability").getByText("Healthy", { exact: true }),
    ).toBeVisible()
    expect(requests).toBe(6)
    await expect(page.locator("body")).not.toContainText(
      "private-health-secret",
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
