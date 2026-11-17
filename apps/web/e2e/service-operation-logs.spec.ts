import { test, expect } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Uses isolated log fixtures")

for (const width of [1440, 390])
  test(`Superadmin Service Operations logs at ${width}px`, async ({ page }) => {
    const successMessage =
      "Accepted a service request for department review: Website Development (SR-1001)."
    const failureMessage =
      "Failed while updating workload capacity for Jordan Reyes because the database operation timed out."
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN")
    let denied = false
    await page.route("**/api/service-operation-logs?**", (route) =>
      route.fulfill(
        denied
          ? { status: 403, json: { error: "Log access denied" } }
          : {
              json: {
                events: [
                  {
                    id: "log-1",
                    event: "REQUEST_ACCEPTED",
                    action: null,
                    source: "requests",
                    outcome: "SUCCESS",
                    actorId: "head",
                    actorRole: "STAFF",
                    actor: {
                      id: "head",
                      name: "Jordan Reyes",
                      role: "STAFF",
                      attribution: "RECORDED",
                    },
                    message: successMessage,
                    target: {
                      id: "request-1",
                      type: "Service request",
                      label: "Website Development (SR-1001)",
                    },
                    changes: [
                      {
                        field: "Status",
                        before: "Submitted",
                        after: "Under Review",
                      },
                      {
                        field: "Department",
                        before: null,
                        after: "Engineering",
                      },
                    ],
                    subjectId: "request-1",
                    requestId: "request-1",
                    correlationId: "safe-correlation",
                    status: null,
                    failureCode: null,
                    failureReason: null,
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: "log-2",
                    event: "API_FAILURE",
                    action: null,
                    source: "workload",
                    outcome: "FAILURE",
                    actorId: "head",
                    actorRole: "STAFF",
                    actor: {
                      id: "head",
                      name: "Jordan Reyes",
                      role: "STAFF",
                      attribution: "RECORDED",
                    },
                    message: failureMessage,
                    target: {
                      id: "employee-1",
                      type: "Staff capacity",
                      label: "Jordan Reyes",
                    },
                    changes: [
                      {
                        field: "Scheduled hours",
                        before: 40,
                        after: 32,
                      },
                    ],
                    endpoint: "PUT /api/workload/capacity",
                    subjectId: "employee-1",
                    requestId: null,
                    correlationId: "incident-correlation",
                    status: 500,
                    failureCode: "DATABASE_TIMEOUT",
                    failureReason:
                      "The database operation timed out before it could finish.",
                    createdAt: new Date().toISOString(),
                  },
                ],
                total: 2,
                page: 1,
                pageSize: 25,
                retentionDays: 30,
                asOf: new Date().toISOString(),
              },
            },
      ),
    )
    await page.goto("/module/service-operations/logs")
    await expect(
      page.getByRole("heading", { name: "Service Operations logs" }),
    ).toBeVisible()
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const menu = page.getByRole("navigation", { name: "Main menu" })
    await expect(menu.locator("p", { hasText: "System Tool" })).toBeVisible()
    await expect(
      menu.getByRole("link", { name: "Logs", exact: true }),
    ).toBeVisible()
    if (width < 768)
      await page
        .getByRole("complementary", { name: "Primary navigation" })
        .getByRole("button", { name: "Close navigation menu" })
        .click()
    await expect(page.getByText(successMessage)).toBeVisible()
    await expect(page.getByText("Jordan Reyes").first()).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    if (width === 1440)
      await expect(
        page.getByRole("columnheader", { name: "Performed by" }),
      ).toBeVisible()
    await page
      .getByRole("button", { name: `View log: ${successMessage}` })
      .click()
    await expect(
      page.getByRole("heading", { name: "Log details" }),
    ).toBeVisible()
    await expect(page.getByText("Affected record")).toBeVisible()
    await expect(page.getByText("What changed")).toBeVisible()
    await expect(
      page.getByText("Website Development (SR-1001)", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Submitted → Under Review")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "View service request" }),
    ).toHaveAttribute("href", "/module/service-operations?request=request-1")
    await page.getByRole("button", { name: "Close log details" }).click()
    await page
      .getByRole("button", { name: `View log: ${failureMessage}` })
      .click()
    await expect(page.getByText("Why it failed")).toBeVisible()
    await expect(page.getByText("What was attempted")).toBeVisible()
    await expect(page.getByText("40 → 32")).toBeVisible()
    await expect(
      page.getByText(
        "The database operation timed out before it could finish.",
      ),
    ).toBeVisible()
    await expect(page.getByText("DATABASE_TIMEOUT")).toBeVisible()
    await expect(
      page.getByText(
        "Search this correlation ID in the API server logs to find the raw developer error and stack trace for this request.",
      ),
    ).toBeVisible()
    await page.getByRole("button", { name: "Close log details" }).click()
    const request = page.waitForRequest(
      (request) =>
        request.url().includes("/api/service-operation-logs?") &&
        request.url().includes("search=request-1"),
    )
    await page.getByLabel("Search logs").fill("request-1")
    await request
    denied = true
    await page.getByRole("button", { name: "Refresh", exact: true }).click()
    await expect(
      page.getByRole("alert").filter({ hasText: "Log access denied" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: `View log: ${successMessage}` }),
    ).toHaveCount(0)
  })
