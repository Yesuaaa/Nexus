import { expect, test, type Page } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

function period(year: number, month: number) {
  const monthKey = String(month).padStart(2, "0")
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startDate = `${year}-${monthKey}-01`
  const endDate = `${year}-${monthKey}-${String(lastDay).padStart(2, "0")}`
  return {
    id: `period-${year}-${monthKey}`,
    configurationId: "configuration-monthly",
    startDate,
    endDate,
    cutoffLabel: `${year}-${monthKey}`,
    status: "OPEN",
    frequency: "MONTHLY",
    firstCutoffDay: null,
    currency: "PHP",
    configuration: {
      id: "configuration-monthly",
      frequency: "MONTHLY",
      firstCutoffDay: null,
      currency: "PHP",
      effectiveFrom: `${year}-01-01`,
      effectiveTo: null,
    },
    createdAt: `${year}-01-01T00:00:00.000Z`,
    createdBy: { id: "admin-1", fullName: "Payroll Admin", role: "ADMIN" },
    run: null,
  }
}

function semiMonthlyPeriod(
  year: number,
  month: number,
  startDay: number,
  endDay: number,
) {
  const monthKey = String(month).padStart(2, "0")
  const dateKey = (day: number) =>
    `${year}-${monthKey}-${String(day).padStart(2, "0")}`
  return {
    ...period(year, month),
    id: `period-${year}-${monthKey}-${startDay}`,
    configurationId: "configuration-semi-monthly",
    startDate: dateKey(startDay),
    endDate: dateKey(endDay),
    cutoffLabel: `${year}-${monthKey} ${startDay}–${endDay}`,
    frequency: "SEMI_MONTHLY",
    firstCutoffDay: 15,
    configuration: {
      id: "configuration-semi-monthly",
      frequency: "SEMI_MONTHLY",
      firstCutoffDay: 15,
      currency: "PHP",
      effectiveFrom: `${year}-01-01`,
      effectiveTo: null,
    },
  }
}

function summary(revision: number, id: string) {
  return {
    id,
    revision,
    status: "BLOCKED",
    calculatedAt: `2026-12-01T10:00:0${revision}.000Z`,
    currency: "PHP",
    grossTotal: "0.00",
    deductionsTotal: "0.00",
    netTotal: "0.00",
    calculatedItemCount: 0,
    reviewItemCount: 0,
    blockedItemCount: 1,
    createdBy: { id: "admin-1", fullName: "Payroll Admin", role: "ADMIN" },
  }
}

function runFor(periodRow: ReturnType<typeof period>) {
  return {
    id: `run-${periodRow.id}`,
    status: "DRAFT",
    calculationCount: 0,
    createdAt: "2026-12-01T09:00:00.000Z",
    updatedAt: "2026-12-01T09:00:00.000Z",
    createdBy: { id: "admin-1", fullName: "Payroll Admin", role: "ADMIN" },
    period: {
      id: periodRow.id,
      configurationId: periodRow.configurationId,
      startDate: periodRow.startDate,
      endDate: periodRow.endDate,
      cutoffLabel: periodRow.cutoffLabel,
      status: "OPEN",
      frequency: "MONTHLY",
      firstCutoffDay: null,
      currency: "PHP",
    },
    latestCalculation: null as ReturnType<typeof summary> | null,
    calculationHistory: [] as ReturnType<typeof summary>[],
  }
}

function itemFor(run: ReturnType<typeof runFor>, revision: number) {
  return {
    id: `item-${run.id}-r${revision}`,
    employeeId: "employee-1",
    employeeNumber: "EMP-001",
    employeeName: "Morgan Payroll",
    employmentType: "CONTRACT",
    status: "BLOCKED",
    currency: "PHP",
    grossAmount: null,
    deductionsAmount: null,
    netAmount: null,
    compensationSnapshot: [
      {
        id: "compensation-revision-1",
        payType: "MONTHLY",
        baseRate: "25000.00",
        currency: "PHP",
        effectiveFrom: "2026-11-01",
        effectiveTo: "2026-11-15",
        components: [],
      },
      {
        id: "compensation-revision-2",
        payType: "MONTHLY",
        baseRate: "30000.00",
        currency: "PHP",
        effectiveFrom: "2026-11-16",
        effectiveTo: null,
        components: [],
      },
    ],
    attendanceSnapshot: {
      policyMissing: true,
      expectedWorkdays: [],
      workdays: [],
      overtimeAdjustments: [],
    },
    warnings: [],
    blocks: [
      {
        code: "MONTHLY_RATE_REVISION_UNSUPPORTED",
        message:
          "Monthly salary versions change inside this period; no proration rule is configured.",
        reference: "compensation-revision-2",
      },
    ],
    calculation: {
      id: `calc-${run.id}-r${revision}`,
      revision,
      status: "BLOCKED",
      calculatedAt: `2026-12-01T10:00:0${revision}.000Z`,
    },
    components: [],
  }
}

async function mockPayrollRuns(page: Page, initialRun = false) {
  const periods = initialRun ? [period(2026, 11)] : []
  const runs: ReturnType<typeof runFor>[] = initialRun
    ? [runFor(periods[0]!)]
    : []
  const calculations = new Map<string, ReturnType<typeof summary>[]>()

  await page.route("**/api/payroll/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === "/api/payroll/periods" && request.method() === "POST") {
      const year = (request.postDataJSON() as { year: number }).year
      const generated = Array.from({ length: 12 }, (_, index) =>
        period(year, index + 1),
      )
      periods.splice(0, periods.length, ...generated)
      await route.fulfill({
        status: 201,
        json: { year, createdCount: 12, total: 12, rows: generated },
      })
      return
    }
    if (path === "/api/payroll/periods" && request.method() === "GET") {
      const year = Number(url.searchParams.get("year"))
      const pageNumber = Number(url.searchParams.get("page") ?? 1)
      const filtered = periods.filter((row) =>
        year ? row.startDate.startsWith(String(year)) : true,
      )
      const rows = filtered.slice((pageNumber - 1) * 10, pageNumber * 10)
      await route.fulfill({
        json: { rows, total: filtered.length, page: pageNumber, pageSize: 10 },
      })
      return
    }
    if (path === "/api/payroll/runs" && request.method() === "POST") {
      const { periodId } = request.postDataJSON() as { periodId: string }
      const selected = periods.find((row) => row.id === periodId)
      if (!selected) {
        await route.fulfill({
          status: 404,
          json: { error: "Period not found" },
        })
        return
      }
      const run = runFor(selected)
      runs.push(run)
      await route.fulfill({ status: 201, json: run })
      return
    }
    if (path === "/api/payroll/runs" && request.method() === "GET") {
      const pageNumber = Number(url.searchParams.get("page") ?? 1)
      const status = url.searchParams.get("status") ?? ""
      const frequency = url.searchParams.get("frequency") ?? ""
      const search = (url.searchParams.get("search") ?? "").toLowerCase()
      const filtered = runs.filter(
        (run) =>
          (!status || run.status === status) &&
          (!frequency || run.period.frequency === frequency) &&
          (!search || run.period.cutoffLabel.toLowerCase().includes(search)),
      )
      await route.fulfill({
        json: {
          rows: filtered.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: filtered.length,
          page: pageNumber,
          pageSize: 10,
        },
      })
      return
    }
    const itemsMatch = path.match(/^\/api\/payroll\/runs\/([^/]+)\/items$/)
    if (itemsMatch && request.method() === "GET") {
      const run = runs.find(
        ({ id }) => id === decodeURIComponent(itemsMatch[1]!),
      )
      const history = run ? (calculations.get(run.id) ?? []) : []
      const calculationId =
        url.searchParams.get("calculationId") ?? history[0]?.id ?? ""
      const revision =
        history.find((value) => value.id === calculationId)?.revision ?? 1
      const pageNumber = Number(url.searchParams.get("page") ?? 1)
      const rows =
        run && history.length
          ? Array.from({ length: 11 }, (_, index) => {
              const item = itemFor(run, revision)
              return index === 0
                ? item
                : {
                    ...item,
                    id: `${item.id}-${index}`,
                    employeeName: `Test employee ${index + 1}`,
                  }
            })
          : []
      await route.fulfill({
        json: {
          rows: rows.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: rows.length,
          page: pageNumber,
          pageSize: 10,
          calculationId: calculationId || null,
        },
      })
      return
    }
    const calculateMatch = path.match(
      /^\/api\/payroll\/runs\/([^/]+)\/calculate$/,
    )
    if (calculateMatch && request.method() === "POST") {
      const run = runs.find(
        ({ id }) => id === decodeURIComponent(calculateMatch[1]!),
      )
      if (!run) {
        await route.fulfill({ status: 404, json: { error: "Run not found" } })
        return
      }
      const nextRevision = run.calculationCount + 1
      const revision = summary(nextRevision, `calc-${run.id}-r${nextRevision}`)
      const prior = calculations.get(run.id) ?? []
      calculations.set(run.id, [revision, ...prior])
      run.calculationCount = nextRevision
      run.status = "CALCULATED"
      run.latestCalculation = revision
      run.calculationHistory = calculations.get(run.id) ?? []
      await route.fulfill({ json: run })
      return
    }
    const runMatch = path.match(/^\/api\/payroll\/runs\/([^/]+)$/)
    if (runMatch && request.method() === "GET") {
      const run = runs.find(({ id }) => id === decodeURIComponent(runMatch[1]!))
      await route.fulfill(
        run ? { json: run } : { status: 404, json: { error: "Run not found" } },
      )
      return
    }
    await route.fulfill({
      status: 404,
      json: { error: "Unknown Payroll run endpoint" },
    })
  })
}

test("Admin generates periods, creates a draft, and reviews blocked calculations", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayrollRuns(page)

  await page.goto("/module/payroll")
  await page.getByRole("link", { name: "Payroll Runs" }).click()
  await expect(page).toHaveURL(/\/module\/payroll\/runs$/)
  await expect(
    page.getByRole("heading", { name: "Payroll Runs" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Generate periods" }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create draft run" }).first(),
  ).toBeVisible()

  await page.getByRole("button", { name: "Generate periods" }).first().click()
  await page.getByLabel("Payroll calendar year").fill("2026")
  await page
    .getByRole("button", { name: "Generate periods", exact: true })
    .last()
    .click()
  await expect(page.getByText("Payroll periods added")).toBeVisible()

  await page.getByRole("button", { name: "Create draft run" }).click()
  await page.getByRole("combobox", { name: "Choose payroll period" }).click()
  await page.getByRole("option", { name: "November 2026", exact: true }).click()
  await page.getByRole("button", { name: "Create draft", exact: true }).click()
  await expect(page.getByText("This run has not been calculated")).toBeVisible()
  await page.getByRole("button", { name: "Calculate draft" }).click()

  await expect(page.getByText("Blocked", { exact: true }).first()).toBeVisible()
  await page.getByRole("tab", { name: "Employees", exact: true }).click()
  await expect(page.getByText("Showing 1–10 of 11 employees")).toBeVisible()
  const employeePages = page.getByRole("navigation", {
    name: "Employee calculation pages",
  })
  await employeePages.getByRole("button", { name: "Next page" }).click()
  await expect(
    page.getByText("Test employee 11", { exact: true }),
  ).toBeVisible()
  await employeePages.getByRole("button", { name: "Previous page" }).click()
  await page
    .getByRole("button", { name: "View Morgan Payroll calculation" })
    .click()
  await expect(
    page.getByText(
      "Monthly salary versions change inside this period; no proration rule is configured.",
    ),
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to employees" }).click()
  await expect(page.getByText("Showing 1–10 of 11 employees")).toBeVisible()
  await page.getByRole("tab", { name: "Summary", exact: true }).click()
  await expect(page.getByText("Known calculated amounts")).toBeVisible()
  await expect(
    page.getByText(/Review and blocked results are excluded/),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Recalculate" })).toBeVisible()

  await page.getByRole("button", { name: "Recalculate", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Recalculate this draft run?" }),
  ).toBeVisible()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Recalculate" })
    .click()
  await expect(page.getByText("New calculation revision saved")).toBeVisible()
  await expect(page.getByRole("button", { name: "Revision 2" })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true)
})

test("Create Draft Run reloads and selects periods for the chosen year", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayrollRuns(page)
  let rejectFirstDraft = true
  await page.route("**/api/payroll/runs", async (route) => {
    if (route.request().method() === "POST" && rejectFirstDraft) {
      rejectFirstDraft = false
      return route.fulfill({
        status: 409,
        json: { error: "A draft already exists for this period." },
      })
    }
    return route.fallback()
  })

  const listedYears: number[] = []
  let generatedYear = 0
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname !== "/api/payroll/periods") return
    if (request.method() === "GET") {
      const year = Number(url.searchParams.get("year"))
      if (year) listedYears.push(year)
    } else if (request.method() === "POST") {
      generatedYear = (request.postDataJSON() as { year: number }).year
    }
  })

  await page.goto("/module/payroll/runs")
  await page.getByRole("button", { name: "Create draft run" }).click()
  const panel = page.getByRole("dialog")
  const yearInput = page.getByRole("spinbutton", {
    name: "Payroll period year",
  })
  await yearInput.fill("2027")
  await expect.poll(() => listedYears).toContain(2027)
  await expect(
    panel.getByRole("heading", { name: "No payroll periods generated" }),
  ).toBeVisible()

  await panel.getByRole("button", { name: "Generate periods for 2027" }).click()
  const generationPanel = page.getByRole("dialog")
  await expect(
    generationPanel.getByRole("heading", { name: "Generate payroll periods" }),
  ).toBeVisible()
  await expect(
    page.getByRole("spinbutton", { name: "Payroll calendar year" }),
  ).toHaveValue("2027")
  await generationPanel
    .getByRole("button", { name: "Generate periods", exact: true })
    .click()
  await expect(page.getByText("Payroll periods added")).toBeVisible()
  expect(generatedYear).toBe(2027)

  const draftPanel = page.getByRole("dialog")
  await expect(
    draftPanel.getByRole("heading", { name: "Create a Draft Run" }),
  ).toBeVisible()
  const periodSelect = draftPanel.getByRole("combobox", {
    name: "Choose payroll period",
  })
  await expect(periodSelect).toBeVisible()
  await periodSelect.click()
  await page.getByRole("option", { name: "January 2027" }).click()
  const selectedSummary = draftPanel.getByRole("region", {
    name: "Selected period",
  })
  await expect(selectedSummary).toContainText("January 2027")
  await expect(selectedSummary).toContainText("Monthly")
  await expect(selectedSummary).toContainText("Jan 1–31, 2027")
  await expect(selectedSummary).toContainText("Available")

  await yearInput.fill("2026")
  await expect(
    draftPanel.getByRole("heading", { name: "No payroll periods generated" }),
  ).toBeVisible()
  await expect(
    draftPanel.getByRole("region", { name: "Selected period" }),
  ).toHaveCount(0)
  await yearInput.fill("2027")
  await expect(periodSelect).toBeVisible()
  await expect(periodSelect).toContainText("Choose a period")
  await expect(
    draftPanel.getByRole("region", { name: "Selected period" }),
  ).toHaveCount(0)

  await periodSelect.click()
  await page.getByRole("option", { name: "January 2027" }).click()
  await expect(
    draftPanel.getByRole("button", { name: "Create draft", exact: true }),
  ).toBeEnabled()
  await draftPanel
    .getByRole("button", { name: "Create draft", exact: true })
    .click()
  await expect(draftPanel.getByRole("alert")).toContainText(
    "A draft already exists for this period.",
  )
  await expect(selectedSummary).toContainText("January 2027")
  await expect(
    draftPanel.getByRole("button", { name: "Create draft", exact: true }),
  ).toBeEnabled()
  await draftPanel
    .getByRole("button", { name: "Create draft", exact: true })
    .click()
  await expect(page.getByText("This run has not been calculated")).toBeVisible()
})

test("Create Draft Run sorts semimonthly periods and supports bounded keyboard scrolling", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayrollRuns(page)
  const periods = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const lastDay = new Date(Date.UTC(2027, month, 0)).getUTCDate()
    return [
      semiMonthlyPeriod(2027, month, 1, 15),
      semiMonthlyPeriod(2027, month, 16, lastDay),
    ]
  })
    .flat()
    .reverse()
  await page.route("**/api/payroll/periods**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== "GET" || url.searchParams.get("year") !== "2027")
      return route.fallback()
    return route.fulfill({
      json: { rows: periods, total: periods.length, page: 1, pageSize: 50 },
    })
  })

  await page.goto("/module/payroll/runs")
  await page.getByRole("button", { name: "Create draft run" }).click()
  const panel = page.getByRole("dialog")
  const yearInput = page.getByRole("spinbutton", {
    name: "Payroll period year",
  })
  await yearInput.fill("2027")
  await expect(
    panel.getByRole("combobox", { name: "Choose payroll period" }),
  ).toBeVisible()

  const periodSelect = panel.getByRole("combobox", {
    name: "Choose payroll period",
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  const yearBounds = await yearInput.boundingBox()
  const periodBounds = await periodSelect.boundingBox()
  expect(yearBounds).not.toBeNull()
  expect(periodBounds).not.toBeNull()
  expect(Math.abs(yearBounds!.width - periodBounds!.width)).toBeLessThanOrEqual(
    1,
  )
  await page.setViewportSize({ width: 768, height: 800 })
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true)
  const tabletYearBounds = await yearInput.boundingBox()
  const tabletPeriodBounds = await periodSelect.boundingBox()
  expect(tabletYearBounds).not.toBeNull()
  expect(tabletPeriodBounds).not.toBeNull()
  expect(
    Math.abs(tabletYearBounds!.width - tabletPeriodBounds!.width),
  ).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 390, height: 620 })
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true)
  await periodSelect.focus()
  await page.keyboard.press("Enter")
  const listbox = page.getByRole("listbox")
  await expect(listbox).toBeVisible()
  const options = listbox.getByRole("option")
  await expect(options).toHaveCount(24)
  await expect(options).toHaveText([
    "January 1–15, 2027",
    "January 16–31, 2027",
    "February 1–15, 2027",
    "February 16–28, 2027",
    "March 1–15, 2027",
    "March 16–31, 2027",
    "April 1–15, 2027",
    "April 16–30, 2027",
    "May 1–15, 2027",
    "May 16–31, 2027",
    "June 1–15, 2027",
    "June 16–30, 2027",
    "July 1–15, 2027",
    "July 16–31, 2027",
    "August 1–15, 2027",
    "August 16–31, 2027",
    "September 1–15, 2027",
    "September 16–30, 2027",
    "October 1–15, 2027",
    "October 16–31, 2027",
    "November 1–15, 2027",
    "November 16–30, 2027",
    "December 1–15, 2027",
    "December 16–31, 2027",
  ])
  const menuBounds = await listbox.boundingBox()
  expect(menuBounds).not.toBeNull()
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0)
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(390)
  expect(menuBounds!.y).toBeGreaterThanOrEqual(0)
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(620)
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true)
  const firstOptionBounds = await options.first().boundingBox()
  expect(firstOptionBounds).not.toBeNull()
  expect(firstOptionBounds!.y).toBeGreaterThanOrEqual(menuBounds!.y)
  expect(firstOptionBounds!.y + firstOptionBounds!.height).toBeLessThanOrEqual(
    menuBounds!.y + menuBounds!.height,
  )

  await page.keyboard.press("End")
  const lastOption = listbox.getByRole("option", {
    name: "December 16–31, 2027",
  })
  await expect(lastOption).toBeVisible()
  const lastOptionBounds = await lastOption.boundingBox()
  expect(lastOptionBounds).not.toBeNull()
  expect(lastOptionBounds!.y).toBeGreaterThanOrEqual(menuBounds!.y)
  expect(lastOptionBounds!.y + lastOptionBounds!.height).toBeLessThanOrEqual(
    menuBounds!.y + menuBounds!.height,
  )
  await page.keyboard.press("Enter")
  await expect(periodSelect).toBeFocused()
  const selectedSummary = panel.getByRole("region", {
    name: "Selected period",
  })
  await expect(selectedSummary).toContainText("December 16–31, 2027")
  await expect(selectedSummary).toContainText("Semi-monthly")
  await expect(selectedSummary).toContainText("Dec 16–31, 2027")

  await page.keyboard.press("Enter")
  await expect(listbox).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(listbox).toHaveCount(0)
  await expect(periodSelect).toBeFocused()
})

test("Create Draft Run explains when all generated periods already have runs", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayrollRuns(page)
  const usedPeriod = {
    ...period(2026, 11),
    run: {
      id: "run-period-2026-11",
      status: "DRAFT",
      createdAt: "2026-11-17T08:00:00.000Z",
      latestCalculation: null,
    },
  }
  await page.route("**/api/payroll/periods**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    const url = new URL(route.request().url())
    if (url.searchParams.get("year") !== "2026") return route.fallback()
    return route.fulfill({
      json: { rows: [usedPeriod], total: 1, page: 1, pageSize: 10 },
    })
  })

  await page.goto("/module/payroll/runs")
  await page.getByRole("button", { name: "Create draft run" }).click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "No available periods" }),
  ).toBeVisible()
  await expect(
    panel.getByText(
      "All generated payroll periods for this year already have associated runs.",
    ),
  ).toBeVisible()
  await expect(
    panel.getByRole("button", { name: /Generate periods for/ }),
  ).toHaveCount(0)
})

test("Create Draft Run keeps actionable load and generation errors open", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockPayrollRuns(page)
  let periodReads = 0
  await page.route("**/api/payroll/periods**", async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname !== "/api/payroll/periods")
      return route.fallback()
    if (request.method() === "GET") {
      periodReads += 1
      if (periodReads === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Period lookup is temporarily unavailable." },
        })
      return route.fulfill({
        json: { rows: [], total: 0, page: 1, pageSize: 10 },
      })
    }
    if (request.method() === "POST")
      return route.fulfill({
        status: 409,
        json: { error: "No payroll schedule covers the selected year." },
      })
    return route.fallback()
  })

  await page.goto("/module/payroll/runs")
  await page.getByRole("button", { name: "Create draft run" }).click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByRole("alert")).toContainText(
    "Period lookup is temporarily unavailable.",
  )
  await panel.getByRole("button", { name: "Try again" }).click()
  await expect(
    panel.getByRole("heading", { name: "No payroll periods generated" }),
  ).toBeVisible()

  await panel.getByRole("button", { name: "Generate periods for 2026" }).click()
  const generationPanel = page.getByRole("dialog")
  await generationPanel
    .getByRole("button", { name: "Generate periods", exact: true })
    .click()
  await expect(generationPanel.getByRole("alert")).toContainText(
    "No payroll schedule covers the selected year.",
  )
  await expect(generationPanel).toBeVisible()
  await expect(
    generationPanel.getByRole("spinbutton", { name: "Payroll calendar year" }),
  ).toHaveValue("2026")
})

test("Superadmin can inspect runs read-only", async ({ page }) => {
  await restoreSession(page, "SUPERADMIN")
  await mockPayrollRuns(page, true)
  await page.goto("/module/payroll/runs")

  await expect(
    page.getByRole("heading", { name: "Payroll Runs" }),
  ).toBeVisible()
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Generate periods" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Create draft run" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "View 2026-11 payroll run" }).click()
  await expect(page.getByText("This run has not been calculated")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Calculate draft" }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Recalculate" })).toHaveCount(0)
})

for (const role of ["STAFF", "USER"] as const)
  test(`${role} cannot enter the Payroll Runs module`, async ({ page }) => {
    await restoreSession(page, role)
    const payrollRequests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/payroll"))
        payrollRequests.push(request.url())
    })

    await page.goto("/module/payroll/runs")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    await expect(
      page.getByRole("heading", { name: "Payroll Runs" }),
    ).toHaveCount(0)
    expect(payrollRequests).toEqual([])
  })

for (const scenario of [
  "reviewer",
  "rejecter",
  "preparer",
  "demo-preparer",
  "superadmin",
] as const) {
  test(`Payroll Approvals shows the submitted revision to the ${scenario}`, async ({
    page,
  }) => {
    await restoreSession(
      page,
      scenario === "superadmin" ? "SUPERADMIN" : "ADMIN",
    )
    const baseRun = runFor(period(2026, 11))
    const approvalEvents: {
      id: string
      action: string
      actorId: string
      actorName: string
      reason: string | null
      createdAt: string
    }[] = [
      {
        id: "submission-1",
        action: "PAYROLL_SUBMITTED",
        actorId: "submitter",
        actorName: "Payroll Submitter",
        reason: null,
        createdAt: "2026-12-01T08:00:00.000Z",
      },
    ]
    const submitted = {
      ...summary(1, "revision-1"),
      status: "COMPLETE",
      grossTotal: "42000.00",
      deductionsTotal: "1250.00",
      netTotal: "40750.00",
      calculatedItemCount: 1,
      blockedItemCount: 0,
      approvalEvents,
    }
    const run = {
      ...baseRun,
      demoSelfApprovalEnabled: scenario === "demo-preparer",
      createdBy: {
        ...baseRun.createdBy,
        id:
          scenario === "preparer" || scenario === "demo-preparer"
            ? "actor"
            : "admin-1",
      },
      status: "PENDING_APPROVAL",
      calculationCount: 1,
      latestCalculation: submitted,
      calculationHistory: [submitted],
    }
    await page.route("**/api/payroll/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith("/approvals") || path.endsWith("/runs"))
        return route.fulfill({
          json: { rows: [run], total: 1, page: 1, pageSize: 10 },
        })
      if (path.endsWith("/items"))
        return route.fulfill({
          json: {
            rows: [
              {
                ...itemFor(baseRun, 1),
                status: "CALCULATED",
                grossAmount: "42000.00",
                deductionsAmount: "1250.00",
                netAmount: "40750.00",
              },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
            calculationId: submitted.id,
          },
        })
      if (path.endsWith("/approve") || path.endsWith("/reject")) {
        const action = path.endsWith("/approve")
          ? "PAYROLL_APPROVED"
          : "PAYROLL_REJECTED"
        const reason =
          action === "PAYROLL_REJECTED" ? "Payroll totals need review." : null
        expect(route.request().postDataJSON()).toMatchObject({
          calculationId: submitted.id,
          ...(reason ? { reason } : {}),
        })
        run.status = action === "PAYROLL_APPROVED" ? "APPROVED" : "REJECTED"
        approvalEvents.push({
          id: "decision-1",
          action,
          actorId: "reviewer",
          actorName: "Payroll Reviewer",
          reason,
          createdAt: "2026-12-02T08:00:00.000Z",
        })
      }
      return route.fulfill({ json: run })
    })
    await page.goto("/module/payroll/runs")
    await page.getByRole("link", { name: "Approvals", exact: true }).click()
    await expect(page.getByText("Read only", { exact: true })).toHaveCount(
      scenario === "superadmin" ? 1 : 0,
    )
    await expect(
      page.getByRole("heading", { name: "Payroll Approvals" }),
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: "View payroll approval for 2026-11",
      })
      .click()
    await expect(
      page.getByRole("heading", { name: "Approval Details" }),
    ).toBeVisible()
    await expect(
      page.getByText("Nov 1–30, 2026 · Monthly · Revision 1", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("dialog").getByText("Submission", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Financial summary", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Net pay for approval")).toBeVisible()
    await expect(
      page.getByRole("dialog").getByText("Payroll Submitter", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("submission-1", { exact: true })).toBeVisible()
    await expect(page.getByText("₱40,750.00").first()).toBeVisible()
    await expect(page.getByText("₱42,000.00")).toBeVisible()
    await expect(page.getByText("₱1,250.00")).toBeVisible()
    await expect(
      page.getByText("Approval decision", { exact: true }),
    ).toHaveCount(0)
    const footer = page.getByRole("dialog").locator("footer")
    await expect(footer.getByRole("button", { name: "Close" })).toBeVisible()
    await page.getByRole("tab", { name: "Employees", exact: true }).click()
    await expect(page.getByText("Morgan Payroll")).toBeVisible()
    const employeeTable = page.getByRole("table", {
      name: "Employee payroll calculations",
    })
    await expect(employeeTable.getByRole("columnheader")).toHaveText([
      "Employee",
      "Gross Pay",
      "Deductions",
      "Net Pay",
      "Status",
      "Details",
    ])
    if (scenario === "reviewer") {
      const row = employeeTable
        .getByRole("row")
        .filter({ hasText: "Morgan Payroll" })
      const status = row.getByText("Calculated", { exact: true })
      await expect(status).toBeVisible()
      expect(
        await status.evaluate((badge) => badge.scrollWidth),
      ).toBeLessThanOrEqual(await status.evaluate((badge) => badge.clientWidth))
      const details = row.getByRole("button", {
        name: "View employee calculation details for Morgan Payroll",
      })
      await expect(details.locator("svg.lucide-eye")).toBeVisible()
      const viewport = page.viewportSize()!
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(employeeTable.getByRole("columnheader")).toHaveCount(6)
      expect(
        await employeeTable.evaluate(
          (table) => table.scrollWidth > table.clientWidth,
        ),
      ).toBe(true)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390)
      await details.click()
      await page.getByRole("button", { name: "Back to employees" }).click()
      await page.setViewportSize(viewport)
      await expect(details).toBeFocused()
    }
    await expect(
      page.getByRole("columnheader", { name: "Deductions" }),
    ).toBeVisible()
    await expect(page.getByText("₱42,000.00").last()).toBeVisible()
    await expect(page.getByText("₱1,250.00").last()).toBeVisible()
    await expect(page.getByText("₱40,750.00").last()).toBeVisible()
    await page.getByRole("tab", { name: "Approval", exact: true }).click()
    await expect(
      page.getByText("Approval history", { exact: true }),
    ).toBeVisible()
    const footerButtons = footer.getByRole("button")
    const approve = footer.getByRole("button", {
      name: "Approve",
      exact: true,
    })
    const reject = footer.getByRole("button", {
      name: "Reject",
      exact: true,
    })
    const expectedFooterButtons =
      scenario === "reviewer" ||
      scenario === "rejecter" ||
      scenario === "demo-preparer"
        ? ["Close", "Reject", "Approve"]
        : scenario === "preparer"
          ? ["Close", "Reject"]
          : ["Close"]
    expect(
      (await footerButtons.allTextContents()).map((label) => label.trim()),
    ).toEqual(expectedFooterButtons)
    if (scenario === "reviewer" || scenario === "demo-preparer") {
      await reject.click()
      await expect(
        page.getByRole("textbox", { name: "Rejection reason" }),
      ).toHaveAttribute("required")
      await page.getByRole("button", { name: "Cancel", exact: true }).click()
      await approve.click()
      await page
        .getByRole("dialog")
        .last()
        .getByRole("button", { name: "Approve", exact: true })
        .click()
      await expect(page.getByText("Payroll approved")).toBeVisible()
      await expect(
        page.getByText("Revision 1 Approved", { exact: true }),
      ).toBeVisible()
      await expect(page.getByText("Payroll Reviewer")).toBeVisible()
    } else if (scenario === "rejecter") {
      await reject.click()
      await page
        .getByRole("textbox", { name: "Rejection reason" })
        .fill("Payroll totals need review.")
      await page
        .getByRole("dialog")
        .last()
        .getByRole("button", { name: "Reject", exact: true })
        .click()
      await expect(page.getByText("Payroll rejected")).toBeVisible()
      const submissionLabel = page.getByText("Revision 1 Submitted", {
        exact: true,
      })
      const rejectionLabel = page.getByText("Revision 1 Rejected", {
        exact: true,
      })
      await expect(submissionLabel).toBeVisible()
      await expect(rejectionLabel).toBeVisible()
      await expect(
        page.getByText("Reason: Payroll totals need review.", {
          exact: true,
        }),
      ).toBeVisible()
      expect(
        await submissionLabel.evaluate(
          (element) => element.getBoundingClientRect().top,
        ),
      ).toBeLessThan(
        await rejectionLabel.evaluate(
          (element) => element.getBoundingClientRect().top,
        ),
      )
      await expect(reject).toHaveCount(0)
    } else {
      await expect(approve).toHaveCount(0)
      if (scenario === "preparer")
        await expect(
          page.getByText(
            "The preparer and calculation author cannot approve this revision.",
          ),
        ).toBeVisible()
      else await expect(reject).toHaveCount(0)
      if (scenario === "preparer") await expect(reject).toBeVisible()
    }
  })
}

test("Payroll Approvals balances its columns and paginates filtered results", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.setViewportSize({ width: 1440, height: 900 })
  const runs = Array.from({ length: 11 }, (_, index) => {
    const baseRun = runFor(period(2026, index + 1))
    const calculation = {
      ...summary(1, `approval-revision-${index + 1}`),
      status: "COMPLETE",
      grossTotal: `${(index + 1) * 10000}.00`,
      deductionsTotal: "1000.00",
      netTotal: `${(index + 1) * 9000}.00`,
      calculatedItemCount: 1,
      blockedItemCount: 0,
      approvalEvents: [
        {
          id: `submission-${index + 1}`,
          action: "PAYROLL_SUBMITTED",
          actorId: "submitter",
          actorName: "Payroll Submitter",
          reason: null,
          createdAt: "2026-12-01T08:00:00.000Z",
        },
      ],
    }
    return {
      ...baseRun,
      status: "PENDING_APPROVAL",
      calculationCount: 2,
      latestCalculation: summary(2, `newer-unsubmitted-${index + 1}`),
      calculationHistory: [
        summary(2, `newer-unsubmitted-${index + 1}`),
        calculation,
      ],
    }
  })
  const requests: {
    page: string
    search: string
    status: string
    frequency: string
  }[] = []
  let pageTwoStarted = false
  let releasePageTwo = () => {}
  const pageTwoGate = new Promise<void>((resolve) => {
    releasePageTwo = resolve
  })

  await page.route("**/api/payroll/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/approvals")) {
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      const search = url.searchParams.get("search") ?? ""
      const status = url.searchParams.get("status") ?? ""
      const frequency = url.searchParams.get("frequency") ?? ""
      requests.push({
        page: String(pageNumber),
        search,
        status,
        frequency,
      })
      if (pageNumber === 2) {
        pageTwoStarted = true
        await pageTwoGate
      }
      const filtered = runs.filter(
        (run) =>
          (!search ||
            run.period.cutoffLabel
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!status || run.status === status) &&
          (!frequency || run.period.frequency === frequency),
      )
      return route.fulfill({
        json: {
          rows: filtered.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: filtered.length,
          page: pageNumber,
          pageSize: 10,
        },
      })
    }
    return route.fulfill({
      json: { rows: [], total: 0, page: 1, pageSize: 10 },
    })
  })

  await page.goto("/module/payroll/runs")
  await page.getByRole("link", { name: "Approvals", exact: true }).click()
  const table = page.getByRole("table", { name: "Payroll runs" })
  await expect(page.getByText("Showing 1–10 of 11 runs")).toBeVisible()
  const headerRow = table.getByRole("rowgroup").first().getByRole("row")
  const dataRow = table.getByRole("row").nth(1)
  const headers = headerRow.getByRole("columnheader")
  await expect(headers).toHaveText([
    "Payroll Period",
    "Submission",
    "Status",
    "Revisions",
    "Net Pay",
    "Employees",
    "Details",
  ])
  const headerTracks = await headerRow.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  const bodyTracks = await dataRow.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(bodyTracks).toBe(headerTracks)
  const trackWidths = headerTracks
    .split(" ")
    .map((width) => Number.parseFloat(width))
  expect(trackWidths[4]).toBeGreaterThan(trackWidths[5] * 1.5)
  expect(trackWidths[4]).toBeGreaterThan(trackWidths[6])
  await expect(dataRow.getByRole("cell").nth(3)).toHaveText("1")
  await expect(dataRow.getByRole("cell").nth(4)).toHaveText("₱9,000.00")
  const approvalAction = dataRow.getByRole("button", {
    name: "View payroll approval for 2026-01",
  })
  await expect(approvalAction).toHaveAttribute("data-slot", "button")
  await expect(approvalAction.locator("svg")).toBeVisible()
  await expect(
    approvalAction.getByText("View payroll approval", { exact: true }),
  ).toBeHidden()

  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect.poll(() => pageTwoStarted).toBe(true)
  await expect(table).toHaveAttribute("aria-busy", "true")
  await expect(
    page.getByRole("status").filter({ hasText: "Loading payroll runs…" }),
  ).toBeVisible()
  releasePageTwo()
  await expect(page.getByText("Showing 11–11 of 11 runs")).toBeVisible()
  await expect(page.getByText("2026-11", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled()

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileHeaders = table.locator("[role='columnheader']")
  await expect(mobileHeaders.nth(1)).toBeHidden()
  await expect(mobileHeaders.nth(2)).toBeVisible()
  await expect(mobileHeaders.nth(3)).toBeHidden()
  const mobileHeaderTracks = await headerRow.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  const mobileBodyTracks = await table
    .getByRole("row")
    .nth(1)
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(mobileBodyTracks).toBe(mobileHeaderTracks)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole("combobox", { name: "Filter by run status" }).click()
  await page.getByRole("option", { name: "Pending approval" }).click()
  await page.getByRole("combobox", { name: "Filter by frequency" }).click()
  await page.getByRole("option", { name: "Monthly", exact: true }).click()
  const search = page.getByRole("searchbox", { name: "Search payroll runs" })
  await search.fill("2026-10")
  await expect
    .poll(() => requests.at(-1))
    .toMatchObject({
      page: "1",
      search: "2026-10",
      status: "PENDING_APPROVAL",
      frequency: "MONTHLY",
    })
  await expect(page.getByText("Showing 1–1 of 1 runs")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Payroll approval pages" }),
  ).toHaveCount(0)
})
