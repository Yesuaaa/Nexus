import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

test("Payroll Reports filters disbursements, preserves detail references and exports the scope", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/payroll/reports?**", (route) => {
    const params = new URL(route.request().url()).searchParams
    const kind = params.get("category")
    const payout = kind === "disbursements"
    const reconciliation = kind === "reconciliation"
    const compensation = kind === "compensation"
    const empty = params.get("search") === "missing"
    return route.fulfill({
      json: {
        columns: reconciliation
          ? [
              "Payroll period",
              "Exception",
              "Employee ID / Reference",
              "Detection",
              "Review status",
              "Last observed",
              "Recurrence",
            ]
          : compensation
            ? [
                "Payroll period",
                "Employees",
                "Base compensation",
                "Allowances",
                "Deductions",
                "Net pay",
              ]
            : payout
              ? [
                  "Payroll period",
                  "Employee ID",
                  "Expected net pay",
                  "Payout status",
                  "Confirmation type",
                  "Last attempt",
                ]
              : [
                  "Payroll period",
                  "Approved runs",
                  "Employees",
                  "Gross pay",
                  "Deductions",
                  "Net pay",
                ],
        rows: empty
          ? []
          : [
              {
                id: "row-1",
                targetId: "batch-1",
                cells: reconciliation
                  ? [
                      "November 2026",
                      "Failed payout",
                      "EMP-001",
                      "Current",
                      "Resolved",
                      "",
                      "",
                    ]
                  : compensation
                    ? [
                        "November 2026",
                        "1",
                        "110.02",
                        "0.00",
                        "10.01",
                        "100.01",
                      ]
                    : payout
                      ? [
                          "November 2026",
                          "EMP-001",
                          "100.01",
                          "Simulated confirmed",
                          "Simulated",
                          "",
                        ]
                      : [
                          "November 2026",
                          "1",
                          "1",
                          "110.02",
                          "10.01",
                          "100.01",
                        ],
              },
            ],
        total: empty ? 0 : 1,
        page: 1,
        pageSize: 10,
        metrics: payout
          ? [
              { label: "Real confirmed", value: "0" },
              { label: "Simulated confirmed", value: "1" },
              { label: "Blocked", value: "2" },
            ]
          : reconciliation
            ? [
                { label: "Current discrepancies", value: "1" },
                { label: "Resolved", value: "1" },
              ]
            : [
                { label: "Approved gross", value: "110.02", money: true },
                { label: "Deductions", value: "10.01", money: true },
                { label: "Approved net", value: "100.01", money: true },
              ],
        trend:
          payout || reconciliation
            ? []
            : [
                {
                  id: "period-1",
                  period: "November 2026",
                  gross: "110.02",
                  deductions: "10.01",
                  net: "100.01",
                },
              ],
        scope: { periods: 1, from: "2026-11-01", to: "2026-11-30" },
      },
    })
  })
  await page.route("**/api/payroll/reports/export?**", (route) => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get("category")).toBe("disbursements")
    expect(params.has("page")).toBe(false)
    expect(["csv", "xlsx"]).toContain(params.get("format"))
    return route.fulfill({
      contentType: "text/csv",
      body: "Payroll period,Employee ID\r\nNovember 2026,EMP-001\r\n",
    })
  })
  await page.goto("/module/payroll/reports")
  await expect(
    page.getByRole("heading", { name: "Payroll Reports" }),
  ).toBeVisible()
  await expect(
    page.getByRole("table", { name: "Payroll Summary" }).getByText("₱100.01"),
  ).toBeVisible()
  const cutoff = page.getByRole("button", {
    name: "Periods ending by",
    exact: true,
  })
  await cutoff.focus()
  await cutoff.press("Enter")
  const calendar = page.getByRole("dialog", { name: "Choose a date" })
  const day = calendar.locator('[data-calendar-focus="true"]')
  await expect(day).toBeFocused()
  const date = await day.getAttribute("data-date")
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  const cutoffRequest = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("through") === date,
  )
  await day.press("Enter")
  await cutoffRequest
  const selectedLabel = await cutoff.innerText()
  expect(selectedLabel).not.toBe("Periods ending by")
  for (const tab of [
    "Payroll Summary",
    "Compensation & Deductions",
    "Reconciliation",
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click()
    await expect(
      page.getByRole("table", { name: tab, exact: true }),
    ).toBeVisible()
    await expect(cutoff).toHaveText(selectedLabel)
    if (process.env.NEXUS_REPORT_SCREENSHOTS === "1")
      await page.screenshot({
        path: testInfo.outputPath(tab.replaceAll(/[^a-z]/gi, "-") + ".png"),
      })
  }
  await page.getByRole("tab", { name: "Disbursements" }).click()
  await expect(cutoff).toHaveText(selectedLabel)
  const resetCutoff = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("through") === "",
  )
  await page.getByRole("button", { name: "Clear cutoff date" }).click()
  await resetCutoff
  await expect(cutoff).toHaveText("Periods ending by")
  const table = page.getByRole("table", { name: "Disbursements" })
  await expect(
    table.getByText("Simulated confirmed", { exact: true }),
  ).toBeVisible()
  await table.getByRole("button", { name: /View report details/ }).click()
  await expect(
    page.getByRole("dialog").getByText("batch-1", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click()
  if (process.env.NEXUS_REPORT_SCREENSHOTS === "1")
    await page.screenshot({ path: testInfo.outputPath("desktop.png") })
  const download = page.waitForEvent("download")
  const exportReport = page.getByRole("button", { name: "Export Report" })
  await expect(exportReport).toHaveCSS("background-color", "rgb(32, 63, 140)")
  await exportReport.focus()
  await exportReport.press("Enter")
  await expect(
    page.getByRole("menuitem", { name: /Export Excel/ }),
  ).toBeVisible()
  await page.getByRole("menuitem", { name: /Export CSV/ }).click()
  expect((await download).suggestedFilename()).toBe(
    "converyn-payroll-disbursements-latest-6.csv",
  )
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  }
  if (process.env.NEXUS_REPORT_SCREENSHOTS === "1")
    await page.screenshot({ path: testInfo.outputPath("mobile.png") })
  const excelDownload = page.waitForEvent("download")
  await exportReport.click()
  await page.getByRole("menuitem", { name: /Export Excel/ }).click()
  expect((await excelDownload).suggestedFilename()).toBe(
    "converyn-payroll-disbursements-latest-6.xlsx",
  )
  await cutoff.click()
  await expect(calendar).toBeVisible()
  const box = await calendar.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  const mobileDate = await day.getAttribute("data-date")
  const mobileRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get("through") === mobileDate,
  )
  await day.click()
  await mobileRequest
  await expect(
    page.getByRole("button", { name: "Clear cutoff date" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Clear cutoff date" }).click()
  await expect(cutoff).toHaveText("Periods ending by")
  await page.getByRole("searchbox", { name: "Search report" }).fill("missing")
  await expect(page.getByText("No matching payroll records")).toBeVisible()
  await page.getByRole("button", { name: "Reset filters" }).click()
  await expect(table.getByText("EMP-001", { exact: true })).toBeVisible()
})
