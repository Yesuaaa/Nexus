import { expect, test, type Page } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

const employee = {
  id: "employee-payroll-1",
  employeeId: "EXP-1042",
  fullName: "Ana Payroll",
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  startDate: "2024-04-01",
  department: { id: "department-1", name: "Engineering" },
}

const version = {
  id: "compensation-1",
  payType: "MONTHLY",
  baseRate: "72500.10",
  currency: "PHP",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  changeReason: "Initial compensation setup",
  createdAt: "2026-01-01T00:00:00.000Z",
  components: [
    {
      id: "component-1",
      type: "ALLOWANCE",
      name: "Transport",
      amount: "1250.05",
      calculationType: "FIXED",
    },
  ],
}

async function mockPayroll(page: Page, writes: unknown[]) {
  await page.route("**/api/payroll/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname
    if (
      method === "POST" &&
      path.endsWith("/compensation/employee-payroll-1/versions")
    ) {
      writes.push(request.postDataJSON())
      await route.fulfill({ status: 201, json: { compensation: version } })
      return
    }
    if (method === "POST" && path.endsWith("/settings/versions")) {
      writes.push(request.postDataJSON())
      await route.fulfill({
        status: 201,
        json: {
          configuration: {
            id: "configuration-2",
            frequency: "SEMI_MONTHLY",
            firstCutoffDay: 15,
            currency: "PHP",
            effectiveFrom: "2027-01-01",
            effectiveTo: null,
            changeReason: "Schedule update",
            createdAt: "2026-12-01T00:00:00.000Z",
            periods: [
              { startDay: 1, endDay: 15 },
              { startDay: 16, endDay: "LAST_DAY" },
            ],
          },
        },
      })
      return
    }
    if (method === "GET" && path === "/api/payroll/compensation") {
      await route.fulfill({
        json: {
          rows: [
            {
              employee: {
                ...employee,
                startDate: undefined,
              },
              compensation: version,
              configurationStatus: "CONFIGURED",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
      return
    }
    if (method === "GET" && path.endsWith("/compensation/employee-payroll-1")) {
      await route.fulfill({
        json: { employee, current: version, future: null },
      })
      return
    }
    if (
      method === "GET" &&
      path.endsWith("/compensation/employee-payroll-1/history")
    ) {
      await route.fulfill({ json: { rows: [version] } })
      return
    }
    if (method === "GET" && path.endsWith("/settings/history")) {
      await route.fulfill({
        json: {
          rows: [
            {
              id: "configuration-1",
              frequency: "MONTHLY",
              firstCutoffDay: null,
              currency: "PHP",
              effectiveFrom: "2026-01-01",
              effectiveTo: null,
              changeReason: "Initial monthly schedule",
              createdAt: "2026-01-01T00:00:00.000Z",
              periods: [{ startDay: 1, endDay: "LAST_DAY" }],
            },
          ],
        },
      })
      return
    }
    if (method === "GET" && path.endsWith("/settings")) {
      await route.fulfill({
        json: {
          current: {
            id: "configuration-1",
            frequency: "MONTHLY",
            firstCutoffDay: null,
            currency: "PHP",
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
            changeReason: "Initial monthly schedule",
            createdAt: "2026-01-01T00:00:00.000Z",
            periods: [{ startDay: 1, endDay: "LAST_DAY" }],
          },
          future: null,
        },
      })
      return
    }
    await route.fulfill({
      status: 404,
      json: { error: "Unknown Payroll test endpoint" },
    })
  })
}

test("Admin creates effective-dated compensation and payroll schedule revisions", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.setViewportSize({ width: 800, height: 900 })
  const writes: unknown[] = []
  await mockPayroll(page, writes)

  await page.goto("/module/payroll/compensation")
  await expect(
    page.getByRole("heading", { name: "Employee Compensation" }),
  ).toBeVisible()
  await expect(
    page.getByRole("cell").filter({ hasText: "₱72,500.10" }).first(),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "View compensation for Ana Payroll" })
    .click()
  await expect(page.getByRole("heading", { name: "Ana Payroll" })).toBeVisible()
  await page
    .getByRole("button", { name: "Create revision", exact: true })
    .click()
  await page.getByLabel("Base rate (PHP)").fill("75500.25")
  await page
    .getByLabel("Reason for change")
    .fill("Annual compensation adjustment")
  await page.getByRole("button", { name: "Review revision" }).click()
  await expect(
    page.getByRole("heading", { name: "Create this compensation revision?" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Create revision", exact: true })
    .click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({
    payType: "MONTHLY",
    baseRate: "75500.25",
    currency: "PHP",
    changeReason: "Annual compensation adjustment",
  })

  await page.goto("/module/payroll/settings")
  await expect(
    page.getByRole("heading", { name: "Payroll Settings" }),
  ).toBeVisible()
  await expect(
    page.getByText("1st–last day of each month", { exact: true }).first(),
  ).toBeVisible()
  const configurationHistory = page.getByRole("table", {
    name: "Payroll configuration history",
  })
  await expect(
    configurationHistory.getByText("Cutoffs", { exact: true }),
  ).toBeVisible()
  await expect(
    configurationHistory.getByText("Status", { exact: true }).nth(1),
  ).toBeVisible()
  await page.getByRole("button", { name: "Add schedule" }).click()
  await page.getByRole("combobox", { name: "Payroll frequency" }).click()
  await page.getByRole("option", { name: "Semi-monthly" }).click()
  await page.getByRole("combobox", { name: "First cutoff day" }).click()
  await page.getByRole("option", { name: "15", exact: true }).click()
  await page
    .getByLabel("Reason for change")
    .fill("Align the schedule with the new pay cycle")
  await page.getByRole("button", { name: "Review schedule" }).click()
  await page
    .getByRole("button", { name: "Create schedule", exact: true })
    .click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toMatchObject({
    frequency: "SEMI_MONTHLY",
    firstCutoffDay: 15,
    currency: "PHP",
    changeReason: "Align the schedule with the new pay cycle",
  })
})

test("Superadmin can read compensation and settings without write controls", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await mockPayroll(page, [])

  await page.goto("/module/payroll/compensation")
  await expect(
    page.getByRole("heading", { name: "Employee Compensation" }),
  ).toBeVisible()
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "View compensation for Ana Payroll" })
    .click()
  await expect(
    page.getByRole("definition").filter({ hasText: "₱72,500.10" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create revision", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Configure compensation" }),
  ).toHaveCount(0)

  await page.goto("/module/payroll/settings")
  await expect(
    page.getByRole("heading", { name: "Payroll Settings" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Add schedule" })).toHaveCount(
    0,
  )
  await expect(
    page
      .getByRole("definition")
      .filter({ hasText: "Initial monthly schedule" }),
  ).toBeVisible()
})

for (const role of ["STAFF", "USER"] as const)
  test(`${role} cannot access Payroll compensation routes`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    const payrollReads: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/payroll"))
        payrollReads.push(request.url())
    })
    await page.goto("/module/payroll/compensation")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    await expect(
      page.getByRole("heading", { name: "Employee Compensation" }),
    ).toHaveCount(0)
    expect(payrollReads).toEqual([])
  })
