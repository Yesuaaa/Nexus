import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

test("Payroll Settings shows capability readiness and filtered audit history", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/payroll/settings", (route) =>
    route.fulfill({
      json: {
        current: null,
        future: null,
        capabilities: {
          simulatorEnabled: false,
          payMongoEnabled: false,
          sandboxDestinationKinds: [],
        },
      },
    }),
  )
  await page.route("**/api/payroll/settings/history", (route) =>
    route.fulfill({ json: { rows: [] } }),
  )
  await page.route("**/api/payroll/settings/preferences", (route) =>
    route.fulfill({
      json: {
        revision: 0,
        showCompanyLogo: true,
        showEmployeeId: true,
        requirePublicationConfirmation: true,
        requireSimulationConfirmation: false,
      },
    }),
  )
  await page.route("**/api/payroll/settings/readiness", (route) =>
    route.fulfill({
      json: {
        capabilities: [
          {
            id: "calculation",
            label: "Payroll Calculation",
            state: "NOT_CONFIGURED",
            reason: "NO_EFFECTIVE_SCHEDULE",
            description: "Schedule a payroll configuration effective today.",
          },
          {
            id: "simulation",
            label: "Disbursement Simulation",
            state: "READY",
            reason: "SIMULATOR_ENABLED",
            description: "Local simulation is enabled.",
            target: "/module/payroll/disbursements",
          },
          {
            id: "real",
            label: "Real Disbursement",
            state: "UNAVAILABLE",
            reason: "LIVE_EXECUTION_DISABLED",
            description: "Real transfers are intentionally unavailable.",
          },
        ],
        permissions: [{ role: "SUPERADMIN", read: true, manage: false }],
      },
    }),
  )
  await page.route("**/api/payroll/settings/audit?**", (route) => {
    const filtered = new URL(route.request().url()).searchParams.has("subject")
    return route.fulfill({
      json: {
        rows: filtered
          ? []
          : [
              {
                id: "audit-1",
                actorName: "Payroll Admin",
                actorRoleAtTime: "ADMIN",
                subjectType: "PAYROLL_RUN",
                subjectId: "run-1",
                action: "PAYROLL_APPROVED",
                activity: null,
                createdAt: "2026-11-30T01:00:00Z",
              },
            ],
        page: 1,
        pageSize: 10,
        total: filtered ? 0 : 1,
      },
    })
  })
  await page.goto("/module/payroll/settings")
  await expect(
    page.getByRole("heading", { name: "Payroll Settings" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Add schedule" })).toHaveCount(
    0,
  )
  await page.getByRole("tab", { name: "Readiness" }).click()
  await expect(
    page.getByText("Real transfers are intentionally unavailable."),
  ).toBeVisible()
  await expect(page.getByText("Local simulation is enabled.")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Open Disbursement Simulation workflow" }),
  ).toHaveAttribute("href", "/module/payroll/disbursements")
  if (process.env.NEXUS_ADMIN_SCREENSHOTS === "1")
    await page.screenshot({ path: testInfo.outputPath("desktop.png") })
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  }
  if (process.env.NEXUS_ADMIN_SCREENSHOTS === "1")
    await page.screenshot({ path: testInfo.outputPath("mobile.png") })
  await page.getByRole("button", { name: "Open Schedule" }).click()
  await expect(page.getByRole("tab", { name: "Schedule" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await page.getByRole("tab", { name: "Audit History" }).click()
  await expect(
    page
      .getByRole("table", { name: "Payroll audit history" })
      .getByText("Payroll Admin"),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Audit category" }).click()
  await page.getByRole("option", { name: "Compensation", exact: true }).click()
  await expect(
    page.getByText("No Payroll audit events in this category"),
  ).toBeVisible()
})
