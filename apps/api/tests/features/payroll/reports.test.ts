import { inflateRawSync } from "node:zlib"
import { payrollReportWorkbook } from "../../../src/features/payroll/payroll-report-workbook.js"
import assert from "node:assert/strict"
import { test } from "node:test"
import { payrollReportCsv } from "../../../src/features/payroll/payroll-reports.service.js"

test("payroll CSV escapes quoted fields and prevents spreadsheet formulas", () => {
  const csv = payrollReportCsv(
    ["Name", "Amount"],
    [
      {
        id: "row",
        targetId: "run",
        status: "",
        cells: ['  =HYPERLINK("x")', "12300.01"],
      },
      {
        id: "row2",
        targetId: "run",
        status: "",
        cells: ['Dela Cruz, "J."', "0.00"],
      },
    ],
  )
  assert.equal(
    csv,
    '\uFEFF"Name","Amount"\r\n"\'  =HYPERLINK(""x"")","12300.01"\r\n"Dela Cruz, ""J.""","0.00"\r\n',
  )
})

test("Excel export uses typed money and literal text with styled, frozen and filterable columns", () => {
  const workbook = payrollReportWorkbook(
    [
      {
        name: "Employee Payroll Details",
        columns: ["Employee", "Net pay"],
        currency: new Set([1]),
        rows: [
          {
            id: "row",
            targetId: "run",
            status: "",
            cells: ["=HYPERLINK(&x)", "12300.01"],
          },
        ],
      },
    ],
    ["Scope: November 2026"],
  )
  const files = new Map<string, string>()
  for (let offset = 0; workbook.readUInt32LE(offset) === 0x04034b50;) {
    const size = workbook.readUInt32LE(offset + 18)
    const nameLength = workbook.readUInt16LE(offset + 26)
    const start = offset + 30 + nameLength
    const path = workbook.toString("utf8", offset + 30, start)
    files.set(
      path,
      inflateRawSync(workbook.subarray(start, start + size)).toString("utf8"),
    )
    offset = start + size
  }
  const sheet = files.get("xl/worksheets/sheet1.xml")!
  assert.match(sheet, /state="frozen"/)
  assert.match(sheet, /autoFilter ref="A3:B4"/)
  assert.match(sheet, /t="n"><v>12300\.01<\/v>/)
  assert.match(
    sheet,
    /t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&amp;x\)/,
  )
  assert.doesNotMatch(sheet, /<f>/)
  assert.match(files.get("xl/styles.xml")!, /FF2F5BFF/)
  assert.match(files.get("xl/styles.xml")!, /₱/)
})
