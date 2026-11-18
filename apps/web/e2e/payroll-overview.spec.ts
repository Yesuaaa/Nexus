import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

test("Payroll overview uses one scope and keeps simulated payouts separate", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/payroll/overview?**", (route) => {
    const range = new URL(route.request().url()).searchParams.get("periods")
    const populated = range !== "3"
    const multiple = range === "12"
    return route.fulfill({
      json: {
        scope: {
          periods: populated ? 1 : 0,
          from: populated ? "2026-11-01" : null,
          to: populated ? "2026-11-30" : null,
        },
        approvedNet: multiple ? "210.02" : populated ? "100.01" : "0.00",
        approvedRuns: multiple ? 2 : populated ? 1 : 0,
        realConfirmedPaid: "0.00",
        pendingApprovals: 0,
        currentExceptions: multiple ? 3 : populated ? 1 : 0,
        trend: populated
          ? [
              ...(multiple
                ? [
                    {
                      id: "older",
                      period: "October 2026",
                      gross: "120.02",
                      deductions: "10.01",
                      net: "110.01",
                    },
                  ]
                : []),
              {
                id: "period-1",
                period: "November 2026",
                gross: "110.02",
                deductions: "10.01",
                net: "100.01",
              },
            ]
          : [],
        payoutCounts: populated
          ? { SUCCEEDED: 3, PENDING: 1, FAILED: 1, BLOCKED: 26, NO_PAYMENT: 0 }
          : {},
        exceptionCounts: populated
          ? [
              { category: "FAILED_PAYOUT", count: 1 },
              ...(multiple ? [{ category: "AMOUNT_MISMATCH", count: 2 }] : []),
            ]
          : [],
        attention: populated
          ? [
              {
                id: "exception-1",
                runId: "approved-run",
                period: "November 2026",
                category: "RECONCILIATION",
                status: "CURRENT",
                item: "FAILED_PAYOUT",
              },
            ]
          : [],
      },
    })
  })
  await page.goto("/module/payroll")
  await expect(
    page.getByRole("heading", { name: "Payroll Overview" }),
  ).toBeVisible()
  const trend = page.getByRole("region", { name: "Payroll Expenditure Trend" })
  await expect(
    trend.getByText(
      "More approved periods are needed to display a payroll trend.",
    ),
  ).toBeVisible()
  await expect(trend.locator("polyline")).toHaveCount(0)
  await expect(page.getByText("26 blocked", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("img", { name: "31 unique payout records" }),
  ).toBeVisible()
  await expect(
    page.getByText("1 current discrepancy", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Review approvals" }),
  ).toHaveAttribute("href", "/module/payroll/approvals")
  const totals = page.getByRole("region", { name: "Payroll totals" })
  await expect(totals.getByText("₱100.01", { exact: true })).toBeVisible()
  await expect(totals.getByText("₱0.00", { exact: true })).toBeVisible()
  for (const name of [
    "Payroll Expenditure Trend",
    "Payroll Composition",
    "Disbursement Status",
    "Reconciliation Exception Breakdown",
  ]) {
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible()
  }
  await expect(
    page.getByText("Simulated confirmed", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "View Reconciliation for November 2026" }),
  ).toHaveAttribute("href", "/module/payroll/reconciliation?run=approved-run")
  if (process.env.NEXUS_OVERVIEW_SCREENSHOTS === "1") {
    await page.getByRole("region", { name: "Payroll analytics" }).screenshot({
      path: testInfo.outputPath("desktop.png"),
    })
  }
  await page.setViewportSize({ width: 768, height: 900 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(768)
  await page.setViewportSize({ width: 390, height: 844 })
  if (process.env.NEXUS_OVERVIEW_SCREENSHOTS === "1") {
    await page.getByRole("region", { name: "Payroll analytics" }).screenshot({
      path: testInfo.outputPath("mobile.png"),
    })
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
  await page.getByRole("combobox", { name: "Reporting range" }).click()
  await page.getByRole("option", { name: "Latest 3 payroll periods" }).click()
  await expect(page.getByText("No approved payroll data")).toBeVisible()
  await expect(
    page.getByText("No current discrepancies", { exact: true }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Reporting range" }).click()
  await page.getByRole("option", { name: "Latest 12 payroll periods" }).click()
  await expect(trend.locator("polyline")).toHaveCount(1)
  await expect(trend.locator("ellipse")).toHaveCount(2)
  await expect(
    trend.getByRole("listitem").filter({ hasText: "October 2026 · ₱110.01" }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Payroll Composition" })
      .getByText("₱120.02", { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Reconciliation Exception Breakdown" })
      .getByText("Amount mismatch", { exact: true }),
  ).toBeVisible()
})
