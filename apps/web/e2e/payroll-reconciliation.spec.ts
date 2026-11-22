import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

test("Reconciliation separates simulator outcomes and opens employee evidence", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const amounts = {
    approved: "100.00",
    allocated: "100.00",
    simulatedConfirmed: "100.00",
    realPaid: "0.00",
    pending: "0.00",
    failed: "0.00",
    unresolved: "0.00",
  }
  await page.route("**/api/payroll/runs?**", (route) =>
    route.fulfill({
      json: {
        total: 1,
        page: 1,
        pageSize: 10,
        rows: [
          {
            id: "approved-run",
            status: "APPROVED",
            period: { cutoffLabel: "November 2026" },
            latestCalculation: { revision: 3 },
          },
        ],
      },
    }),
  )
  await page.route(
    "**/api/payroll/runs/approved-run/reconciliation?**",
    (route) => {
      const search = new URL(route.request().url()).searchParams.get("search")
      const employees =
        search === "missing"
          ? []
          : [
              {
                payrollItemId: "item-1",
                employeeName: "Morgan Payroll",
                employeeNumber: "EMP-001",
                status: "MATCHED",
                amounts,
                payoutId: "payout-1",
                attempt: {
                  id: "attempt-1",
                  outcome: "SUCCEEDED",
                  createdAt: "2026-11-30T00:00:00Z",
                },
                discrepancies: [],
              },
            ]
      return route.fulfill({
        json: {
          period: "November 2026",
          revision: 3,
          status: "MATCHED",
          approval: { id: "approval-1" },
          batch: { id: "batch-1", status: "BLOCKED" },
          amounts,
          employees: {
            rows: employees,
            total: employees.length,
            page: 1,
            pageSize: 10,
          },
          exceptions: { rows: [], total: 0, page: 1, pageSize: 10 },
        },
      })
    },
  )
  await page.goto("/module/payroll/reconciliation?run=approved-run")
  await expect(
    page.getByRole("heading", { name: "Reconciliation", exact: true }),
  ).toBeVisible()
  const summary = page.getByRole("region", { name: "Reconciliation Summary" })
  await expect(
    summary.getByText("Real Confirmed Paid", { exact: true }),
  ).toBeVisible()
  await expect(summary.getByText("Simulated Confirmed")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Record observations" }),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "View reconciliation for Morgan Payroll" })
    .click()
  const drawer = page.getByRole("dialog")
  await expect(drawer.getByText("attempt-1")).toBeVisible()
  await expect(drawer.getByText("Simulated Success")).toBeVisible()
  await drawer
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click()
  await page
    .getByRole("searchbox", { name: "Search employees" })
    .fill("missing")
  await expect(page.getByText("No matching employees")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
})

test("Admin reviews a recorded exception through the shared confirmation form", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const amounts = {
    approved: "100.00",
    allocated: "100.00",
    simulatedConfirmed: "0.00",
    realPaid: "0.00",
    pending: "0.00",
    failed: "100.00",
    unresolved: "100.00",
  }
  const detectedAt = "2026-11-30T00:00:00Z"
  let reviewed = false
  await page.route("**/api/payroll/runs?**", (route) =>
    route.fulfill({
      json: {
        page: 1,
        pageSize: 10,
        total: 1,
        rows: [
          {
            id: "approved-run",
            status: "APPROVED",
            period: { cutoffLabel: "November 2026" },
            latestCalculation: { revision: 3 },
          },
        ],
      },
    }),
  )
  await page.route(
    "**/api/payroll/runs/approved-run/reconciliation?**",
    (route) =>
      route.fulfill({
        json: {
          period: "November 2026",
          revision: 3,
          status: "EXCEPTION",
          approval: { id: "approval-1" },
          batch: { id: "batch-1", status: "BLOCKED" },
          amounts,
          employees: { page: 1, pageSize: 10, total: 0, rows: [] },
          exceptions: {
            page: 1,
            pageSize: 10,
            total: 1,
            rows: [
              {
                category: "FAILED_PAYOUT",
                subjectId: "item-1",
                payrollItemId: "item-1",
                employeeName: "Morgan Payroll",
                payoutId: "payout-1",
                attemptId: "attempt-1",
                batchId: "batch-1",
                expected: "100.00",
                observed: "100.00",
                difference: "0.00",
                observation: "CURRENT",
                lifecycle: reviewed ? "UNDER_REVIEW" : "OPEN",
                version: reviewed ? 1 : 0,
                firstDetectedAt: detectedAt,
                lastObservedAt: detectedAt,
              },
            ],
          },
        },
      }),
  )
  await page.route(
    "**/reconciliation/exceptions/FAILED_PAYOUT/item-1/decisions",
    (route) =>
      route.fulfill({
        json: {
          decisions: reviewed
            ? [
                {
                  id: "decision-1",
                  actorId: "admin-1",
                  actorName: "Payroll Admin",
                  action: "START_REVIEW",
                  previous: "OPEN",
                  next: "UNDER_REVIEW",
                  reason: "Investigate the failed simulator outcome",
                  createdAt: detectedAt,
                  classification: null,
                  assessment: null,
                },
              ]
            : [],
        },
      }),
  )
  await page.route("**/reconciliation/decisions", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().postDataJSON()).toMatchObject({
      category: "FAILED_PAYOUT",
      subjectId: "item-1",
      action: "START_REVIEW",
      version: 0,
      reason: "Investigate the failed simulator outcome",
    })
    reviewed = true
    await route.fulfill({ json: { id: "decision-1" } })
  })
  await page.goto("/module/payroll/reconciliation?run=approved-run")
  const details = page.getByRole("button", {
    name: /View failed payout for Morgan Payroll/i,
  })
  await details.click()
  await expect(
    page.getByText("The evaluator still detects this discrepancy.", {
      exact: false,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Start Review", exact: true }).click()
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Investigate the failed simulator outcome")
  await page.getByRole("button", { name: "Confirm decision" }).click()
  await expect(
    page.getByRole("heading", { name: "Exception Details", exact: true }),
  ).toHaveCount(0)
  await details.click()
  await expect(
    page.getByText("Investigate the failed simulator outcome", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Record Assessment", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start Review", exact: true }),
  ).toHaveCount(0)
})
