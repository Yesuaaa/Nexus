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

async function mockPayroll(page: Page, writes: unknown[], configured = true) {
  let preferences = {
    revision: 0,
    showCompanyLogo: true,
    showEmployeeId: true,
    requirePublicationConfirmation: true,
    requireSimulationConfirmation: false,
  }
  await page.route("**/api/payroll/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname
    if (path.endsWith("/settings/preferences")) {
      if (method === "PUT") {
        const payload = request.postDataJSON()
        preferences = { ...payload, revision: preferences.revision + 1 }
      }
      return route.fulfill({ json: preferences })
    }
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
              compensation: configured ? version : null,
              configurationStatus: configured ? "CONFIGURED" : "NOT_CONFIGURED",
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
        json: { employee, current: configured ? version : null, future: null },
      })
      return
    }
    if (
      method === "GET" &&
      path.endsWith("/compensation/employee-payroll-1/history")
    ) {
      await route.fulfill({ json: { rows: configured ? [version] : [] } })
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
          capabilities: {
            simulatorEnabled: true,
            payMongoEnabled: false,
            sandboxDestinationKinds: ["TEST_BANK", "TEST_EWALLET"],
          },
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
  const baseRate = page.getByLabel("Base rate (PHP)")
  await expect(baseRate).toHaveValue("72,500.10")
  await baseRate.fill("")
  await page.getByRole("button", { name: "Review revision" }).click()
  await expect(baseRate).toHaveAccessibleDescription("Base rate is required.")
  await expect(baseRate).toBeFocused()
  await baseRate.pressSequentially("25000")
  await expect(baseRate).toHaveValue("25,000")
  await baseRate.pressSequentially("e")
  await expect(baseRate).toHaveValue("25,000")
  await expect(baseRate).toHaveAccessibleDescription("Enter a valid amount.")
  await baseRate.fill("75500.25")
  await expect(baseRate).toHaveValue("75,500.25")
  await expect(page.getByLabel("Amount (PHP)", { exact: true })).toHaveValue(
    "1,250.05",
  )
  await page.getByLabel("Amount (PHP)", { exact: true }).fill("1250.5")
  await expect(page.getByLabel("Amount (PHP)", { exact: true })).toHaveValue(
    "1,250.5",
  )
  await page.getByRole("button", { name: "Add deduction" }).click()
  await page.getByLabel("Deduction name").fill("Equipment")
  const deduction = page.getByLabel("Amount (PHP)", { exact: true }).last()
  await deduction.fill("1500")
  await expect(deduction).toHaveValue("1,500")
  await page
    .getByLabel("Reason for change")
    .fill("Annual compensation adjustment")
  await page.getByRole("button", { name: "Review revision" }).click()
  await expect(
    page.getByRole("heading", { name: "Create this compensation revision?" }),
  ).toBeVisible()
  await expect(page.getByText("₱75,500.25", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "Create revision", exact: true })
    .click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({
    payType: "MONTHLY",
    baseRate: "75500.25",
    currency: "PHP",
    changeReason: "Annual compensation adjustment",
    components: expect.arrayContaining([
      { type: "ALLOWANCE", name: "Transport", amount: "1250.50" },
      { type: "RECURRING_DEDUCTION", name: "Equipment", amount: "1500.00" },
    ]),
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
  await configurationHistory
    .getByRole("button", { name: /^View schedule effective/ })
    .click()
  const scheduleDetails = page.getByRole("dialog", { name: "Schedule details" })
  await expect(scheduleDetails.getByText("Present")).toBeVisible()
  await scheduleDetails
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await expect(scheduleDetails).toBeHidden()
  await expect(page.getByRole("tab")).toHaveText([
    "Schedule",
    "Payslips",
    "Disbursements",
    "Readiness",
    "Audit History",
  ])
  for (const [tab, label] of [
    ["Payslips", "Show company logo"],
    ["Disbursements", "Confirm payout simulation"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click()
    await expect(
      page.getByRole("tabpanel").getByRole("switch", { name: label }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add schedule" }),
    ).toHaveCount(0)
  }
  await page.getByRole("tab", { name: "Schedule" }).click()
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

test("Admin saves and discards payroll preferences", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  await mockPayroll(page, [])
  await page.setViewportSize({ width: 375, height: 812 })
  let rejectSave = true
  await page.route("**/api/payroll/settings/preferences", (route) => {
    if (route.request().method() !== "PUT" || !rejectSave)
      return route.fallback()
    rejectSave = false
    return route.fulfill({
      status: 503,
      json: { error: "Payroll preferences are temporarily unavailable." },
    })
  })
  await page.goto("/module/payroll/settings")
  await page.getByRole("tab", { name: "Payslips" }).click()
  const employeeId = page.getByRole("switch", { name: "Show employee ID" })
  await expect(employeeId).toBeChecked()
  const settings = page.getByRole("main", { name: "Payroll Settings" })
  await expect
    .poll(() =>
      settings.evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBeLessThanOrEqual(1)
  await employeeId.uncheck()
  await page.getByRole("button", { name: "Discard changes" }).click()
  await expect(employeeId).toBeChecked()
  await employeeId.uncheck()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Payroll preferences are temporarily unavailable." })
      .first(),
  ).toBeVisible()
  await expect(employeeId).not.toBeChecked()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Payroll preferences saved")).toBeVisible()
  await page.reload()
  await page.getByRole("tab", { name: "Payslips" }).click()
  await expect(employeeId).not.toBeChecked()
  await page.getByRole("tab", { name: "Disbursements" }).click()
  await expect(
    page.getByRole("switch", { name: "Confirm payout simulation" }),
  ).not.toBeChecked()
})

test("Admin can open unconfigured compensation with the keyboard", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayroll(page, [], false)
  await page.goto("/module/payroll/compensation")

  const action = page.getByRole("button", {
    name: "Configure compensation for Ana Payroll",
  })
  await expect(action.locator("svg")).toHaveCount(1)
  await expect(action.getByText("Configure compensation")).toBeHidden()
  await action.focus()
  await action.press("Enter")

  await expect(page.getByRole("heading", { name: "Ana Payroll" })).toBeVisible()
  await page
    .getByRole("button", { name: "Configure compensation", exact: true })
    .click()
  await expect(page.getByLabel("Base rate (PHP)")).toBeVisible()
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

test("Compensation paginates all employees and resets to page one on search", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const employees = Array.from({ length: 22 }, (_, index) => ({
    employee: {
      ...employee,
      id: "employee-" + index,
      fullName: "Employee " + String(index + 1).padStart(2, "0"),
    },
    compensation: null,
    configurationStatus: "NOT_CONFIGURED",
  }))
  let releasePageTwo = () => {}
  const pageTwo = new Promise<void>((resolve) => {
    releasePageTwo = resolve
  })
  await page.route("**/api/payroll/compensation?**", async (route) => {
    const params = new URL(route.request().url()).searchParams
    const current = Number(params.get("page") ?? 1)
    const search = params.get("search") ?? ""
    const matches = employees.filter((entry) =>
      entry.employee.fullName.includes(search),
    )
    if (current === 2) await pageTwo
    await route.fulfill({
      json: {
        rows: matches.slice((current - 1) * 10, current * 10),
        page: current,
        pageSize: 10,
        total: matches.length,
      },
    })
  })

  await page.goto("/module/payroll/compensation")
  await expect(page.getByText("Showing 1–10 of 22 employees")).toBeVisible()
  const pagination = page.getByRole("navigation", {
    name: "Compensation pages",
  })
  await expect(
    pagination.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled()
  await pagination.getByRole("button", { name: "Next page" }).click()
  await expect(
    page.getByRole("table", { name: "Employee compensation" }),
  ).toHaveAttribute("aria-busy", "true")
  releasePageTwo()
  await expect(page.getByText("Showing 11–20 of 22 employees")).toBeVisible()
  await pagination.getByRole("button", { name: "Next page" }).click()
  await expect(page.getByText("Showing 21–22 of 22 employees")).toBeVisible()
  await expect(
    pagination.getByRole("button", { name: "Next page" }),
  ).toBeDisabled()
  const search = page.getByRole("searchbox", { name: "Search employees" })
  await search.fill("Employee 22")
  await expect(page.getByText("Showing 1–1 of 1 employees")).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Configure compensation for Employee 22",
    }),
  ).toBeVisible()
})
