import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { inflateRawSync } from "node:zlib"
import { expect, test, type Page } from "@playwright/test"

type ExpectedPayroll = {
  period: string
  runId: string
  calculationId: string
  employeeRows: {
    employeeId: string
    employeeName: string
    gross: string
    deductions: string
    net: string
  }[]
  simulatedDisbursement: {
    batchId: string
    items: {
      payoutId: string
      employeeId: string
      amount: string
      outcome: string
      destinationKind: string | null
      attemptId: string | null
      attemptCreatedAt: string | null
    }[]
  }
}

const runId = process.env.NEXUS_PAYROLL_E2E_RUN_ID
const password = process.env.NEXUS_PAYROLL_E2E_PASSWORD
const expectedPath = process.env.NEXUS_PAYROLL_E2E_EXPECTED_PATH
const suffix = runId ?? "missing-fixture"

if (!runId || !password || !expectedPath) {
  throw new Error("Set the verified integrated Payroll fixture environment")
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0
  while (index < source.length) {
    const character = source[index]!
    if (quoted && character === '"' && source[index + 1] === '"') {
      field += '"'
      index += 2
      continue
    }
    if (character === '"') quoted = !quoted
    else if (character === "," && !quoted) {
      row.push(field)
      field = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1
      row.push(field)
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
      field = ""
    } else field += character
    index += 1
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function readZipEntries(archive: Buffer) {
  assert.equal(archive.readUInt32LE(0), 0x04034b50, "XLSX is not a ZIP file")
  const entries = new Map<string, Buffer>()
  let offset = 0
  while (
    offset + 4 <= archive.length &&
    archive.readUInt32LE(offset) === 0x04034b50
  ) {
    const method = archive.readUInt16LE(offset + 8)
    const compressedSize = archive.readUInt32LE(offset + 18)
    const nameLength = archive.readUInt16LE(offset + 26)
    const extraLength = archive.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = archive.toString("utf8", nameStart, nameStart + nameLength)
    const compressed = archive.subarray(dataStart, dataStart + compressedSize)
    const data =
      method === 8
        ? inflateRawSync(compressed)
        : method === 0
          ? Buffer.from(compressed)
          : assert.fail(`Unsupported XLSX compression method ${method}`)
    entries.set(name, data)
    offset = dataStart + compressedSize
  }
  return entries
}

function safeCsvCell(value: string) {
  return /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value
}

function xmlCellText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

async function signIn(page: Page) {
  await page.goto("/internal/login")
  await page.locator("#email").fill(`payroll-c-${suffix}-preparer@example.test`)
  await page.locator("#password").fill(password!)
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/\/module$/)
}

async function downloadReport(page: Page, option: string, extension: string) {
  await page.getByRole("button", { name: "Export Report" }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: option, exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`))
  const path = await download.path()
  assert.ok(path)
  return readFile(path)
}

test("[PAY-E2E-006] real report CSV and XLSX match independently queried PostgreSQL payroll rows", async ({
  page,
}) => {
  test.setTimeout(90_000)
  const expected = JSON.parse(
    await readFile(expectedPath!, "utf8"),
  ) as ExpectedPayroll
  expect(expected.employeeRows).toHaveLength(2)
  expect(expected.simulatedDisbursement.items).toHaveLength(2)

  await signIn(page)
  await page.goto("/module/payroll/reports")
  await expect(
    page.getByRole("heading", { name: "Payroll Reports", exact: true }),
  ).toBeVisible()
  const reportTable = page.getByRole("table", { name: "Payroll Summary" })
  await expect(reportTable.getByRole("row")).toHaveCount(2)
  await expect(reportTable.getByText(expected.period)).toBeVisible()
  await expect(reportTable.getByText("43,500.00")).toBeVisible()
  await expect(reportTable.getByText("1,000.00")).toBeVisible()
  await expect(reportTable.getByText("42,500.00")).toBeVisible()

  const summaryCsv = parseCsv(
    (await downloadReport(page, "Export CSV", "csv")).toString("utf8"),
  )
  expect(summaryCsv[0]).toEqual([
    "Payroll period",
    "Run reference",
    "Approved calculation",
    "Revision",
    "Approval status",
    "Approved at",
    "Employee ID",
    "Employee name",
    "Base compensation",
    "Allowances",
    "Gross pay",
    "Recorded deductions",
    "Total deductions",
    "Net pay",
  ])
  expect(summaryCsv).toHaveLength(3)
  for (const databaseRow of expected.employeeRows) {
    const row = summaryCsv.find(
      (candidate) => candidate[6] === safeCsvCell(databaseRow.employeeId),
    )
    expect(row).toBeDefined()
    expect(row?.[7]).toBe(safeCsvCell(databaseRow.employeeName))
    expect(row?.[10]).toBe(databaseRow.gross)
    expect(row?.[12]).toBe(databaseRow.deductions)
    expect(row?.[13]).toBe(databaseRow.net)
  }

  const summaryXlsx = readZipEntries(
    await downloadReport(page, "Export Excel (.xlsx)", "xlsx"),
  )
  expect(summaryXlsx.has("[Content_Types].xml")).toBe(true)
  expect(summaryXlsx.has("xl/workbook.xml")).toBe(true)
  const workbookXml = summaryXlsx.get("xl/workbook.xml")!.toString("utf8")
  expect(workbookXml).toContain("Employee Payroll Details")
  const employeeSheet = [...summaryXlsx.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .map(([, data]) => data.toString("utf8"))
    .find((xml) => xml.includes("Employee name"))
  assert.ok(employeeSheet, "Employee detail worksheet is missing")
  expect(employeeSheet).not.toMatch(/<f(?:\s|>)/i)
  for (const databaseRow of expected.employeeRows) {
    expect(employeeSheet).toContain(xmlCellText(databaseRow.employeeId))
    expect(employeeSheet).toContain(xmlCellText(databaseRow.employeeName))
    expect(employeeSheet).toContain(`<v>${databaseRow.gross}</v>`)
    expect(employeeSheet).toContain(`<v>${databaseRow.deductions}</v>`)
    expect(employeeSheet).toContain(`<v>${databaseRow.net}</v>`)
  }

  await page.getByRole("tab", { name: "Disbursements", exact: true }).click()
  const statusResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/payroll/reports" &&
      url.searchParams.get("category") === "disbursements" &&
      url.searchParams.get("status") === "FAILED"
    )
  })
  await page.getByRole("combobox", { name: "Report status" }).click()
  await page.getByRole("option", { name: "Failed", exact: true }).click()
  const statusResponse = await statusResponsePromise
  expect(statusResponse.status()).toBe(200)
  const failedReport = (await statusResponse.json()) as {
    total: number
    rows: { cells: string[] }[]
  }
  expect(failedReport.total).toBe(1)
  expect(failedReport.rows).toHaveLength(1)
  const failedPayout = expected.simulatedDisbursement.items.find(
    (item) => item.outcome === "FAILED",
  )
  assert.ok(failedPayout)
  expect(failedReport.rows[0]?.cells[1]).toBe(failedPayout.employeeId)
  expect(failedReport.rows[0]?.cells[2]).toBe(failedPayout.amount)
  await expect(
    page.getByRole("table", { name: "Disbursements" }).getByRole("row"),
  ).toHaveCount(2)
  await expect(
    page.getByRole("table", { name: "Disbursements" }).getByText("Failed"),
  ).toBeVisible()

  const payoutCsv = parseCsv(
    (await downloadReport(page, "Export CSV", "csv")).toString("utf8"),
  )
  expect(payoutCsv).toHaveLength(2)
  expect(payoutCsv[0]).toEqual([
    "Payroll period",
    "Run reference",
    "Approved calculation",
    "Employee ID",
    "Expected net pay",
    "Payout reference",
    "Batch reference",
    "Payout status",
    "Confirmation type",
    "Last attempt",
    "Attempt reference",
  ])
  expect(payoutCsv[1]).toEqual([
    expected.period,
    expected.runId,
    expected.calculationId,
    safeCsvCell(failedPayout.employeeId),
    failedPayout.amount,
    failedPayout.payoutId,
    expected.simulatedDisbursement.batchId,
    "Failed",
    "None",
    failedPayout.attemptCreatedAt,
    failedPayout.attemptId,
  ])
  const payoutXlsx = readZipEntries(
    await downloadReport(page, "Export Excel (.xlsx)", "xlsx"),
  )
  const payoutSheet = [...payoutXlsx.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .map(([, data]) => data.toString("utf8"))
    .find((xml) => xml.includes("Payout reference"))
  assert.ok(payoutSheet, "Disbursement detail worksheet is missing")
  expect(payoutSheet).not.toMatch(/<f(?:\s|>)/i)
  expect(payoutSheet).toContain(xmlCellText(expected.runId))
  expect(payoutSheet).toContain(xmlCellText(expected.calculationId))
  expect(payoutSheet).toContain(xmlCellText(failedPayout.employeeId))
  expect(payoutSheet).toContain(xmlCellText(failedPayout.payoutId))
  expect(payoutSheet).toContain(
    xmlCellText(expected.simulatedDisbursement.batchId),
  )
  if (failedPayout.attemptId)
    expect(payoutSheet).toContain(xmlCellText(failedPayout.attemptId))
  expect(payoutSheet).toContain(`<v>${failedPayout.amount}</v>`)
})
