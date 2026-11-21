import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { expect, test, type Page, type Request } from "@playwright/test"

const runId = process.env.NEXUS_PAYROLL_E2E_RUN_ID
const password = process.env.NEXUS_PAYROLL_E2E_PASSWORD
const baseURL = process.env.NEXUS_E2E_BASE_URL
const period = process.env.NEXUS_PAYROLL_E2E_PERIOD
const year = period?.slice(0, 4)
const periodDisplayName = period
  ? new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${period}-01T00:00:00.000Z`))
  : ""
const periodDate = period ? `${period}-01` : ""
const suffix = runId ?? "missing-fixture"
const employeeAName = `=Payroll QA Employee A ${suffix}`
const employeeBName = `-Payroll QA Employee B ${suffix}`
const employeeAId = `+PAYC${suffix.toUpperCase()}A`
const employeeBId = `@PAYC${suffix.toUpperCase()}B`

assert.match(runId ?? "", /^[a-f0-9]{12}$/)
assert.match(password ?? "", /^PayrollC-E2E![a-f0-9]{12}$/)
assert.match(period ?? "", /^\d{4}-\d{2}$/)
assert.ok(period)
assert.ok(baseURL)

function emailFor(
  role: "preparer" | "approver" | "superadmin" | "staff-a" | "staff-b" | "user",
) {
  return `payroll-c-${suffix}-${role}@example.test`
}

async function signIn(page: Page, role: Parameters<typeof emailFor>[0]) {
  await page.goto(role === "user" ? "/login" : "/internal/login")
  await page.locator("#email").fill(emailFor(role))
  await page.locator("#password").fill(password!)
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(role === "user" ? /\/dashboard$/ : /\/module$/)
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click()
  await expect(page).toHaveURL(/\/internal\/login$|\/login$/)
}

async function openPayrollSection(page: Page, section: string) {
  await page.goto("/module")
  await page
    .getByRole("link", { name: "Open People & HR workspace", exact: true })
    .click()
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await sidebar.getByRole("button", { name: "Payroll", exact: true }).click()
  await sidebar.getByRole("link", { name: section, exact: true }).click()
  return sidebar
}

async function openStaffPayroll(page: Page) {
  await page.goto("/module")
  await page
    .getByRole("link", {
      name: "Open Workforce Compliance workspace",
      exact: true,
    })
    .click()
  const mobileNavigation = page.getByRole("button", {
    name: "Open navigation menu",
  })
  if (await mobileNavigation.count()) await mobileNavigation.click()
  const sidebar = page.locator("#app-sidebar")
  await sidebar.getByRole("link", { name: "My Payroll", exact: true }).click()
  await expect(page).toHaveURL(/\/my-payroll$/)
  return sidebar
}

async function configureCompensation(
  page: Page,
  employeeName: string,
  baseRate: string,
  options: { allowance?: string; deduction?: string } = {},
) {
  const configure = page.getByRole("button", {
    name: `Configure compensation for ${employeeName}`,
  })
  await configure.focus()
  await page.keyboard.press("Enter")
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: employeeName, exact: true }),
  ).toBeVisible()
  await panel
    .getByRole("button", { name: "Configure compensation", exact: true })
    .click()
  await expect(
    panel.getByRole("heading", { name: "New compensation version" }),
  ).toBeVisible()
  await panel.getByRole("combobox", { name: "Pay type" }).click()
  await page.getByRole("option", { name: "Monthly", exact: true }).click()
  await panel.getByLabel("Base rate (PHP)").fill(baseRate)
  await panel.getByLabel("Effective from").fill(periodDate)
  const reason = panel.getByLabel("Reason for change")
  await reason.fill("   ")
  await panel.getByRole("button", { name: "Review revision" }).click()
  await expect(panel.getByRole("alert")).toHaveText(
    "Enter a reason between 3 and 500 characters.",
  )
  await expect(
    page.getByRole("dialog", { name: "Create this compensation revision?" }),
  ).toHaveCount(0)

  await reason.fill("Synthetic Checkpoint C monthly compensation")
  if (options.allowance) {
    await panel.getByRole("button", { name: "Add allowance" }).click()
    await panel.getByLabel("Allowance name").fill("QA Transport Allowance")
    await panel.getByLabel("Amount (PHP)").last().fill(options.allowance)
  }
  if (options.deduction) {
    await panel.getByRole("button", { name: "Add deduction" }).click()
    await panel.getByLabel("Deduction name").fill("QA Equipment Deduction")
    await panel.getByLabel("Amount (PHP)").last().fill(options.deduction)
  }
  await panel.getByRole("button", { name: "Review revision" }).click()
  const confirmation = page.getByRole("dialog", {
    name: "Create this compensation revision?",
  })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Create revision" }).click()
  await expect(page.getByText("Compensation revision created")).toBeVisible()
  await panel.getByRole("button", { name: "Close", exact: true }).click()
}

function captureBearer(page: Page) {
  let bearer = ""
  const listener = (request: Request) => {
    const authorization = request.headers().authorization
    if (authorization?.startsWith("Bearer ")) bearer = authorization
  }
  page.on("request", listener)
  return {
    value: () => bearer,
    stop: () => page.off("request", listener),
  }
}

function extractPdfText(document: Buffer) {
  const source = document.toString("latin1")
  assert.ok(source.startsWith("%PDF-1.4"), "PDF header is missing")
  assert.ok(source.includes("xref"), "PDF cross-reference table is missing")
  assert.ok(source.includes("trailer"), "PDF trailer is missing")
  assert.ok(source.includes("%%EOF"), "PDF end marker is missing")

  const text = [...source.matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
    .map((match) => match[1] ?? "")
    .filter((stream) => stream.includes(" Tj"))
    .flatMap((stream) =>
      [...stream.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((match) =>
        (match[1] ?? "")
          .replace(/\\([\\()])/g, "$1")
          .replace(/\\([0-7]{1,3})/g, (_escape, octal: string) =>
            String.fromCharCode(Number.parseInt(octal, 8)),
          ),
      ),
    )
  assert.ok(text.length > 10, "PDF text streams could not be parsed")
  return text.join("\n")
}

test("[PAY-E2E-001/003/004/005/008/009] Admin-to-Staff payroll lifecycle uses real services and PostgreSQL", async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, "preparer")
  const compensationSidebar = await openPayrollSection(page, "Compensation")
  await expect(
    page.getByRole("heading", { name: "Employee Compensation" }),
  ).toBeVisible()
  await configureCompensation(page, employeeAName, "25000", {
    allowance: "500",
    deduction: "1000",
  })
  await configureCompensation(page, employeeBName, "18000")
  await expect(
    page
      .getByRole("table", { name: "Employee compensation" })
      .getByText(employeeAId),
  ).toBeVisible()
  await expect(
    page
      .getByRole("table", { name: "Employee compensation" })
      .getByText(employeeBId),
  ).toBeVisible()

  await compensationSidebar
    .getByRole("link", { name: "Payroll Runs", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Payroll Runs", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Generate periods" }).first().click()
  await page.getByLabel("Payroll calendar year").fill(year!)
  const generatedPeriods = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/payroll/periods" &&
      response.request().method() === "POST",
  )
  await page
    .getByRole("button", { name: "Generate periods", exact: true })
    .last()
    .click()
  expect((await generatedPeriods).status()).toBe(201)
  await expect(page.getByText("Payroll periods added")).toBeVisible()

  await page.getByRole("button", { name: "Create draft run" }).first().click()
  await page.getByRole("combobox", { name: "Choose payroll period" }).click()
  await page
    .getByRole("option", { name: periodDisplayName, exact: true })
    .click()
  const createdRun = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/payroll/runs" &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Create draft", exact: true }).click()
  const createResponse = await createdRun
  expect(createResponse.status()).toBe(201)
  const createdBody = (await createResponse.json()) as { id: string }
  expect(createdBody.id).toBeTruthy()
  await expect(page.getByText("This run has not been calculated")).toBeVisible()

  const calculationResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/payroll/runs/${createdBody.id}/calculate` &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Calculate draft" }).click()
  expect((await calculationResponse).status()).toBe(200)
  await expect(
    page.getByRole("dialog").getByText("Calculated", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/43,500\.00/).first()).toBeVisible()
  await expect(page.getByText(/1,000\.00/).first()).toBeVisible()
  await expect(page.getByText(/42,500\.00/).first()).toBeVisible()

  const approvalTab = page.getByRole("tab", {
    name: "Approval",
    exact: true,
  })
  await expect(approvalTab).toBeEnabled()
  await approvalTab.click()
  await expect(approvalTab).toHaveAttribute("aria-selected", "true")
  const submitButton = page.getByRole("button", {
    name: "Submit for Approval",
    exact: true,
  })
  await expect(submitButton).toBeVisible()
  await submitButton.click()
  const submitDialog = page.getByRole("dialog", {
    name: "Submit payroll for approval?",
  })
  await expect(submitDialog).toBeVisible()
  const submissionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(
        `/api/payroll/runs/${createdBody.id}/`,
      ),
  )
  await submitDialog.getByRole("button", { name: "Submit" }).click()
  expect((await submissionResponse).status()).toBe(200)

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close panel" })
    .click()
  await signOut(page)
  await signIn(page, "approver")
  const approverAuth = captureBearer(page)
  const approvalsSidebar = await openPayrollSection(page, "Approvals")
  await expect(
    page.getByRole("heading", { name: "Payroll Approvals", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: `View payroll approval for ${period}` })
    .click()
  const approvalDetails = page.getByRole("dialog")
  await expect(
    approvalDetails.getByRole("heading", { name: "Approval Details" }),
  ).toBeVisible()
  await expect(approvalDetails.getByText(/42,500\.00/)).toBeVisible()
  await approvalDetails.getByRole("tab", { name: "Employees" }).click()
  await expect(approvalDetails.getByText(employeeAName)).toBeVisible()
  await expect(approvalDetails.getByText(employeeBName)).toBeVisible()
  await approvalDetails.getByRole("tab", { name: "Approval" }).click()
  await approvalDetails.getByRole("button", { name: "Approve" }).click()
  const approvalDialog = page.getByRole("dialog", {
    name: "Approve this payroll revision?",
  })
  const approvedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(
        `/api/payroll/runs/${createdBody.id}/`,
      ),
  )
  await approvalDialog.getByRole("button", { name: "Approve" }).click()
  expect((await approvedResponse).status()).toBe(200)
  await expect(page.getByText("Payroll approved")).toBeVisible()

  await approvalDetails.getByRole("button", { name: "Close panel" }).click()
  await approvalsSidebar
    .getByRole("link", { name: "Payslips & History", exact: true })
    .click()
  const sections = page.getByRole("group", {
    name: "Payroll history sections",
  })
  await sections.getByRole("button", { name: "Approved Runs" }).click()
  await page
    .getByRole("button", { name: `View approved run details for ${period}` })
    .click()
  const approvedDetails = page.getByRole("dialog")
  await expect(
    approvedDetails.getByRole("heading", { name: "Payslip Details" }),
  ).toBeVisible()
  const generate = approvedDetails.getByRole("button", {
    name: "Generate payslips",
    exact: true,
  })
  const generateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/payroll/runs/${createdBody.id}/generate-payslips`,
  )
  await generate.click()
  await page
    .getByRole("dialog", { name: "Generate payslips?" })
    .getByRole("button", { name: "Generate", exact: true })
    .click()
  expect((await generateResponse).status()).toBe(200)

  const generatedListResponse = await page
    .context()
    .request.get(`${baseURL}/api/payroll/payslips?status=generated`, {
      headers: { authorization: approverAuth.value() },
    })
  expect(generatedListResponse.status()).toBe(200)
  const generatedList = (await generatedListResponse.json()) as {
    total: number
    rows: { id: string; employeeNumber: string }[]
  }
  expect(generatedList.total).toBe(2)
  const unpublishedSlipId = generatedList.rows.find(
    (row) => row.employeeNumber === employeeAId,
  )?.id
  assert.ok(unpublishedSlipId)

  await approvedDetails
    .getByRole("button", { name: "Close payslip details" })
    .click()
  await signOut(page)
  await signIn(page, "staff-a")
  const unpublishedStaffAuth = captureBearer(page)
  const unpublishedStaffListPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/staff/my-payroll/payslips" &&
      response.request().method() === "GET",
  )
  await openStaffPayroll(page)
  const unpublishedStaffListResponse = await unpublishedStaffListPromise
  expect(unpublishedStaffListResponse.status()).toBe(200)
  expect(
    (await unpublishedStaffListResponse.json()) as { total: number },
  ).toMatchObject({ total: 0 })
  for (const suffixPath of ["", "/download", "/preview"]) {
    const response = await page
      .context()
      .request.get(
        `${baseURL}/api/staff/my-payroll/payslips/${unpublishedSlipId}${suffixPath}`,
        { headers: { authorization: unpublishedStaffAuth.value() } },
      )
    expect(response.status()).toBe(404)
  }
  unpublishedStaffAuth.stop()

  await signOut(page)
  await signIn(page, "approver")
  await openPayrollSection(page, "Payslips & History")
  const publishedHistorySections = page.getByRole("group", {
    name: "Payroll history sections",
  })
  await publishedHistorySections
    .getByRole("button", { name: "Approved Runs" })
    .click()
  await page
    .getByRole("button", { name: `View approved run details for ${period}` })
    .click()
  const approvedHistoryDetails = page.getByRole("dialog")
  await expect(
    approvedHistoryDetails.getByRole("heading", { name: "Payslip Details" }),
  ).toBeVisible()

  const publishResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/payroll/runs/${createdBody.id}/publish-payslips`,
  )
  await approvedHistoryDetails
    .getByRole("button", { name: "Publish payslips", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Publish payslips?" })
    .getByRole("button", { name: "Publish", exact: true })
    .click()
  expect((await publishResponse).status()).toBe(200)
  await expect(
    approvedHistoryDetails.getByRole("button", { name: "Payslips published" }),
  ).toBeVisible()
  approverAuth.stop()

  await approvedHistoryDetails
    .getByRole("button", { name: "Close payslip details" })
    .click()
  await signOut(page)
  await signIn(page, "staff-a")
  const staffAAuth = captureBearer(page)
  const staffSlipsResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/staff/my-payroll/payslips" &&
      response.request().method() === "GET",
  )
  await openStaffPayroll(page)
  await expect(page.getByRole("heading", { name: "My Payroll" })).toBeVisible()
  const staffSlipsResponse = await staffSlipsResponsePromise
  expect(staffSlipsResponse.status()).toBe(200)
  const staffSlips = (await staffSlipsResponse.json()) as {
    rows: { id: string; reference: string; employeeName: string }[]
    total: number
  }
  expect(staffSlips.total).toBe(1)
  expect(staffSlips.rows).toHaveLength(1)
  expect(staffSlips.rows[0]?.employeeName).toBe(employeeAName)
  const employeeASlipId = staffSlips.rows[0]!.id
  const slipsTable = page.getByRole("table", { name: "My payslips" })
  const employeeARow = slipsTable.getByRole("row").nth(1)
  await expect(
    employeeARow.getByText(staffSlips.rows[0]!.reference),
  ).toBeVisible()
  await expect(employeeARow.getByText(/24500\.00/)).toBeVisible()
  await page.getByRole("button", { name: "View", exact: true }).click()
  const ownDetails = page.getByRole("dialog")
  await expect(ownDetails.getByText(employeeAName)).toBeVisible()
  await expect(ownDetails.getByText(employeeAId)).toBeVisible()
  await expect(
    ownDetails.getByText(
      /Gross PHP 25,?500\.00 · Deductions PHP 1,?000\.00 · Net PHP 24,?500\.00/,
    ),
  ).toBeVisible()
  await expect(ownDetails.getByText(period)).toBeVisible()

  const preview = await page
    .context()
    .request.get(
      `${baseURL}/api/staff/my-payroll/payslips/${employeeASlipId}/preview`,
      { headers: { authorization: staffAAuth.value() } },
    )
  expect(preview.status()).toBe(200)
  expect(preview.headers()["content-type"] ?? "").toContain("application/pdf")
  const previewText = extractPdfText(await preview.body())
  expect(previewText).toContain(employeeAName)
  expect(previewText).toContain(employeeAId)
  expect(previewText).toContain(period)
  expect(previewText).toContain("Gross pay")
  expect(previewText).toMatch(/25,?500\.00/)
  expect(previewText).toContain("Total deductions")
  expect(previewText).toMatch(/1,?000\.00/)
  expect(previewText).toMatch(/24,?500\.00/)

  const downloadEvent = page.waitForEvent("download")
  await ownDetails.getByRole("button", { name: "Download PDF" }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  const downloadedPath = await download.path()
  assert.ok(downloadedPath)
  const downloadedText = extractPdfText(await readFile(downloadedPath))
  expect(downloadedText).toContain(employeeAName)
  expect(downloadedText).toMatch(/24,?500\.00/)
  staffAAuth.stop()

  await ownDetails.getByRole("button", { name: "Close panel" }).click()
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).resolves.toBe(true)
  }

  await signOut(page)
  await signIn(page, "staff-b")
  const staffBAuth = captureBearer(page)
  const staffBSlipsResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/staff/my-payroll/payslips" &&
      response.request().method() === "GET",
  )
  await page.goto("/my-payroll")
  await expect(page.getByRole("heading", { name: "My Payroll" })).toBeVisible()
  const staffBSlipsResponse = await staffBSlipsResponsePromise
  const staffBSlips = (await staffBSlipsResponse.json()) as {
    rows: { id: string; reference: string; employeeName: string }[]
    total: number
  }
  expect(staffBSlips.total).toBe(1)
  expect(staffBSlips.rows[0]?.employeeName).toBe(employeeBName)
  const staffBTable = page.getByRole("table", { name: "My payslips" })
  const employeeBRow = staffBTable.getByRole("row").nth(1)
  await expect(
    employeeBRow.getByText(staffBSlips.rows[0]!.reference),
  ).toBeVisible()
  await expect(employeeBRow.getByText(/18000\.00/)).toBeVisible()
  const bearer = staffBAuth.value()
  expect(bearer.startsWith("Bearer ")).toBe(true)
  const crossEmployeeDetail = await page
    .context()
    .request.get(
      `${baseURL}/api/staff/my-payroll/payslips/${employeeASlipId}`,
      { headers: { authorization: bearer } },
    )
  expect(crossEmployeeDetail.status()).toBe(404)
  const crossEmployeeDownload = await page
    .context()
    .request.get(
      `${baseURL}/api/staff/my-payroll/payslips/${employeeASlipId}/download`,
      { headers: { authorization: bearer } },
    )
  expect(crossEmployeeDownload.status()).toBe(404)
  const crossEmployeePreview = await page
    .context()
    .request.get(
      `${baseURL}/api/staff/my-payroll/payslips/${employeeASlipId}/preview`,
      { headers: { authorization: bearer } },
    )
  expect(crossEmployeePreview.status()).toBe(404)
  staffBAuth.stop()
})

test("[PAY-E2E-002] role routes and backend authorization agree", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/module/payroll/runs")
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, "superadmin")
  const superadminAuth = captureBearer(page)
  await openPayrollSection(page, "Payroll Runs")
  await expect(
    page.getByRole("heading", { name: "Payroll Runs", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Generate periods" }),
  ).toHaveCount(0)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).resolves.toBe(true)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const bearer = superadminAuth.value()
  expect(bearer.startsWith("Bearer ")).toBe(true)
  const deniedWrite = await page
    .context()
    .request.post(`${baseURL}/api/payroll/periods`, {
      headers: { authorization: bearer },
      data: { year: Number(year) + 1 },
    })
  expect(deniedWrite.status()).toBe(403)
  superadminAuth.stop()
  await signOut(page)

  await signIn(page, "staff-a")
  const staffAuth = captureBearer(page)
  await page.goto("/module/payroll/runs")
  await expect(page).toHaveURL(/\/module$/)
  await expect(page.getByRole("heading", { name: "Payroll Runs" })).toHaveCount(
    0,
  )
  const staffToken = staffAuth.value()
  expect(staffToken.startsWith("Bearer ")).toBe(true)
  const deniedStaffRead = await page
    .context()
    .request.get(`${baseURL}/api/payroll/runs?page=1`, {
      headers: { authorization: staffToken },
    })
  expect(deniedStaffRead.status()).toBe(403)
  staffAuth.stop()
  await signOut(page)

  await signIn(page, "user")
  const userAuth = captureBearer(page)
  await page.goto("/module/payroll/runs")
  await expect(page).toHaveURL(/\/dashboard$/)
  const userToken = userAuth.value()
  expect(userToken.startsWith("Bearer ")).toBe(true)
  const deniedUserRead = await page
    .context()
    .request.get(`${baseURL}/api/payroll/runs?page=1`, {
      headers: { authorization: userToken },
    })
  expect(deniedUserRead.status()).toBe(403)
  userAuth.stop()
})
