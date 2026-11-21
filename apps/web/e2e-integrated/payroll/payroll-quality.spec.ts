import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"

const runId = process.env.NEXUS_PAYROLL_E2E_RUN_ID
const password = process.env.NEXUS_PAYROLL_E2E_PASSWORD
const expectedPath = process.env.NEXUS_PAYROLL_E2E_EXPECTED_PATH
const suffix = runId ?? "missing-fixture"
const employeeAName = `=Payroll QA Employee A ${suffix}`

if (!runId || !password || !expectedPath) {
  throw new Error("Set the verified integrated Payroll fixture environment")
}

async function signIn(page: Page, role: "preparer" | "staff-a") {
  await page.goto("/internal/login")
  await page.locator("#email").fill(`payroll-c-${suffix}-${role}@example.test`)
  await page.locator("#password").fill(password!)
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/\/module$/)
}

async function assertNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

test("[PAY-E2E-008] payroll pages remain usable across desktop, tablet, and mobile viewports", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const expected = JSON.parse(await readFile(expectedPath!, "utf8")) as {
    runId: string
  }
  await signIn(page, "preparer")

  const routes = [
    ["Overview", "/module/payroll"],
    ["Compensation", "/module/payroll/compensation"],
    ["Payroll Runs", "/module/payroll/runs"],
    ["Approvals", "/module/payroll/approvals"],
    ["Payroll Reports", "/module/payroll/reports"],
    ["Reconciliation", `/module/payroll/reconciliation?run=${expected.runId}`],
    ["Payslips & History", "/module/payroll/payslips"],
    ["Disbursements", "/module/payroll/disbursements"],
    ["Payroll Settings", "/module/payroll/settings"],
  ] as const
  for (const [heading, route] of routes) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(route)
      if (heading === "Overview") {
        await expect(
          page.getByRole("heading", { name: "Payroll Overview", exact: true }),
        ).toBeVisible()
      } else {
        await expect(page.getByRole("main")).toBeVisible()
      }
      await assertNoDocumentOverflow(page)
    }
  }

  await signOut(page)
  await signIn(page, "staff-a")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/my-payroll")
  await expect(page.getByRole("heading", { name: "My Payroll" })).toBeVisible()
  await assertNoDocumentOverflow(page)
})

async function signOut(page: Page) {
  const accountMenu = page.getByRole("button", { name: "Open account menu" })
  if (await accountMenu.count()) {
    await accountMenu.click()
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click()
    await expect(page).toHaveURL(/\/internal\/login$|\/login$/)
  }
}

test("[PAY-E2E-009] payroll reports and detail panels support keyboard access and semantic navigation", async ({
  page,
}) => {
  await signIn(page, "preparer")
  await page.goto("/module/payroll/reports")
  const reportMain = page.getByRole("main", { name: "Payroll Reports" })
  await expect(reportMain).toBeVisible()
  const reportTable = page.getByRole("table", { name: "Payroll Summary" })
  for (const header of [
    "Payroll period",
    "Gross pay",
    "Deductions",
    "Net pay",
  ]) {
    await expect(
      reportTable.getByRole("columnheader", { name: header }),
    ).toBeVisible()
  }

  const summaryTab = page.getByRole("tab", { name: "Payroll Summary" })
  await summaryTab.focus()
  await page.keyboard.press("ArrowRight")
  await expect(
    page.getByRole("tab", { name: "Compensation & Deductions" }),
  ).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Home")
  await expect(summaryTab).toHaveAttribute("aria-selected", "true")

  const exportButton = page.getByRole("button", { name: "Export Report" })
  await exportButton.focus()
  await page.keyboard.press("Enter")
  const csvOption = page.getByRole("menuitem", { name: "Export CSV" })
  await expect(csvOption).toBeVisible()
  await expect(csvOption).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(exportButton).toBeFocused()
  await page.keyboard.press("Space")
  await expect(page.getByRole("menuitem", { name: "Export CSV" })).toBeVisible()
  await page.keyboard.press("Escape")

  const detailsButton = reportTable.getByRole("button", {
    name: /View report details for/,
  })
  await detailsButton.focus()
  await page.keyboard.press("Enter")
  const details = page.getByRole("dialog")
  await expect(details).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(details.locator(":focus")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(details).toHaveCount(0)
  await expect(detailsButton).toBeFocused()

  await page.goto("/module/payroll/compensation")
  const compensationTrigger = page.getByRole("button", {
    name: `View compensation for ${employeeAName}`,
  })
  await expect(compensationTrigger).toBeVisible()
  await compensationTrigger.focus()
  await page.keyboard.press("Enter")
  const compensationDetails = page.getByRole("dialog")
  await expect(compensationDetails).toBeVisible()
  await expect(
    compensationDetails.getByText("Base rate", { exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(compensationDetails.locator(":focus")).toHaveCount(1)
  await compensationDetails
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await expect(compensationDetails).toHaveCount(0)
  await expect(compensationTrigger).toBeFocused()
})

test("[PAY-E2E-010] a transient readiness network interruption exposes recovery and retry succeeds against Express", async ({
  page,
}) => {
  await signIn(page, "preparer")
  let interrupted = false
  let allowRetry = false
  await page.route("**/api/payroll/settings/readiness", async (route) => {
    if (!allowRetry) {
      interrupted = true
      await route.abort("failed")
      return
    }
    await route.continue()
  })

  await page.goto("/module/payroll/settings")
  await page.getByRole("tab", { name: "Readiness", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
  expect(interrupted).toBe(true)
  allowRetry = true
  const retryResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/payroll/settings/readiness" &&
      response.request().method() === "GET",
  )
  await page.getByRole("button", { name: "Retry" }).click()
  const response = await retryResponsePromise
  expect(response.status()).toBe(200)
  await expect(
    page.getByRole("heading", { name: "Payroll Operational Readiness" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0)
  await page.unroute("**/api/payroll/settings/readiness")
})
