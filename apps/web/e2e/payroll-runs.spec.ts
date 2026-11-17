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
      const rows = run && history.length ? [itemFor(run, revision)] : []
      await route.fulfill({
        json: {
          rows,
          total: rows.length,
          page: Number(url.searchParams.get("page") ?? 1),
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
  await page.getByRole("option", { name: /2026-11 · Monthly/ }).click()
  await page.getByRole("button", { name: "Create draft", exact: true }).click()
  await expect(page.getByText("This run has not been calculated")).toBeVisible()
  await page.getByRole("button", { name: "Calculate draft" }).click()

  await expect(page.getByText("Blocked", { exact: true }).first()).toBeVisible()
  await page
    .getByRole("button", { name: "View Morgan Payroll calculation" })
    .click()
  await expect(
    page.getByText(
      "Monthly salary versions change inside this period; no proration rule is configured.",
    ),
  ).toBeVisible()
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
