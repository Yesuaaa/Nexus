import { expect, test, type Page } from "@playwright/test"

const runId = process.env.NEXUS_PAYROLL_E2E_RUN_ID
const password = process.env.NEXUS_PAYROLL_E2E_PASSWORD
const suffix = runId ?? "missing-fixture"
const period = process.env.NEXUS_PAYROLL_E2E_PERIOD ?? ""
const employeeAName = `=Payroll QA Employee A ${suffix}`
const employeeBName = `-Payroll QA Employee B ${suffix}`

if (!runId || !password || !period) {
  throw new Error("Set the integrated Payroll fixture environment first")
}

async function signIn(page: Page) {
  await page.goto("/internal/login")
  await page.locator("#email").fill(`payroll-c-${suffix}-approver@example.test`)
  await page.locator("#password").fill(password!)
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/\/module$/)
}

async function prepareBatch(page: Page) {
  await page.getByRole("button", { name: "Prepare batch" }).click()
  const dialog = page.getByRole("dialog", {
    name: "Prepare Disbursement Batch",
  })
  await dialog.getByRole("combobox", { name: "Approved payroll run" }).click()
  await page.getByRole("option", { name: period, exact: true }).click()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/payroll/disbursements",
  )
  await dialog.getByRole("button", { name: "Prepare batch" }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  return (await response.json()) as {
    id: string
    runId: string
    period: string
    totalNet: string
    employeeCount: number
    proposedAmount: string
  }
}

async function configureDestination(page: Page, employeeName: string) {
  await page
    .getByRole("button", { name: `Actions for ${employeeName}` })
    .click()
  await page
    .getByRole("menuitem", { name: "Configure test destination" })
    .click()
  const dialog = page.getByRole("dialog", {
    name: "Configure test destination",
  })
  await expect(
    dialog.getByText(/not a verified production payout account/i),
  ).toBeVisible()
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/destination"),
  )
  await dialog.getByRole("button", { name: "Save destination" }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  await expect(
    page.getByText(/does not enable production payouts/i),
  ).toBeVisible()
  const result = (await response.json()) as {
    simulatorEnabled: boolean
    provider: { enabled: boolean }
  }
  expect(result.simulatorEnabled).toBe(true)
  expect(result.provider.enabled).toBe(false)
}

test("[PAY-E2E-007/010] approved payroll supports local simulation and duplicate-safe batch preparation", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  await page.goto("/module/payroll/disbursements")
  await expect(
    page.getByRole("heading", { name: "Disbursements", exact: true }),
  ).toBeVisible()

  const firstBatch = await prepareBatch(page)
  expect(firstBatch.runId).toBeTruthy()
  expect(firstBatch.period).toBe(period)
  expect(firstBatch.totalNet).toBe("42500.00")
  expect(firstBatch.employeeCount).toBe(2)
  expect(firstBatch.proposedAmount).toBe("0.00")
  await expect(page.getByText("Disbursement batch prepared")).toBeVisible()

  const repeatedBatch = await prepareBatch(page)
  expect(repeatedBatch.id).toBe(firstBatch.id)
  const batchRows = page.getByRole("table", { name: "Disbursement batches" })
  await expect(batchRows.getByRole("row")).toHaveCount(2)

  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/api/payroll/disbursements/${firstBatch.id}`,
  )
  await page
    .getByRole("button", { name: `View disbursement batch ${period}` })
    .click()
  const detailResponse = await detailResponsePromise
  expect(detailResponse.status()).toBe(200)
  const detail = (await detailResponse.json()) as {
    id: string
    totalNet: string
    proposedAmount: string
    simulatorEnabled: boolean
    provider: { enabled: boolean }
    items: { employeeNameSnapshot: string; approvedNet: string }[]
  }
  expect(detail.id).toBe(firstBatch.id)
  expect(detail.totalNet).toBe("42500.00")
  expect(detail.proposedAmount).toBe("0.00")
  expect(detail.simulatorEnabled).toBe(true)
  expect(detail.provider.enabled).toBe(false)
  expect(detail.items).toHaveLength(2)
  await page.getByRole("tab", { name: "Employee payouts" }).click()
  const payouts = page.getByRole("table", { name: "Employee payouts" })
  await expect(payouts.getByText(employeeAName)).toBeVisible()
  await expect(payouts.getByText(employeeBName)).toBeVisible()

  await configureDestination(page, employeeAName)
  const failureResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/simulate"),
  )
  await page
    .getByRole("button", { name: `Actions for ${employeeAName}` })
    .click()
  await page.getByRole("menuitem", { name: "Simulate failure" }).click()
  const failed = await failureResponsePromise
  expect(failed.status()).toBe(200)
  await expect(payouts.getByText("Failed", { exact: true })).toBeVisible()
  await expect(page.getByText("Simulation recorded")).toBeVisible()

  await configureDestination(page, employeeBName)
  const successResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/simulate"),
  )
  await page
    .getByRole("button", { name: `Actions for ${employeeBName}` })
    .click()
  await page.getByRole("menuitem", { name: "Simulate success" }).click()
  const succeeded = await successResponsePromise
  expect(succeeded.status()).toBe(200)
  await expect(payouts.getByText("Succeeded", { exact: true })).toBeVisible()

  const reconciliationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/payroll/runs/${firstBatch.runId}/reconciliation`,
  )
  await page.goto(
    `/module/payroll/reconciliation?run=${encodeURIComponent(firstBatch.runId)}`,
  )
  await expect(
    page.getByRole("heading", { name: "Reconciliation", exact: true }),
  ).toBeVisible()
  const reconciliationResponse = await reconciliationResponsePromise
  expect(reconciliationResponse.status()).toBe(200)
  const reconciliation = (await reconciliationResponse.json()) as {
    amounts: { realPaid: string; simulatedConfirmed: string; failed: string }
  }
  expect(reconciliation.amounts.realPaid).toBe("0.00")
  expect(reconciliation.amounts.simulatedConfirmed).toBe("18000.00")
  expect(reconciliation.amounts.failed).toBe("24500.00")
  await expect(
    page.getByText("Real Confirmed Paid", { exact: true }),
  ).toBeVisible()
})
