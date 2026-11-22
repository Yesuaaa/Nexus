import { crc32, deflateRawSync } from "node:zlib"
import { fail } from "../../shared/http-error.js"
import type { ReportRow } from "./payroll-reports.service.js"

export type PayrollSheet = {
  name: string
  columns: readonly string[]
  rows: ReportRow[]
  numeric?: ReadonlySet<number>
  currency?: ReadonlySet<number>
}

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const office =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const packageRelations =
  "http://schemas.openxmlformats.org/package/2006/relationships"
const xml = (value: string) =>
  Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0)!
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        code >= 0x10000
      )
    })
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

function archive(entries: [string, string][]) {
  const files: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  for (const [path, value] of entries) {
    const name = Buffer.from(path)
    const data = Buffer.from(value)
    const packed = deflateRawSync(data)
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(33, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(33, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    files.push(local, name, packed)
    directory.push(central, name)
    offset += local.length + name.length + packed.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(
    directory.reduce((sum, bytes) => sum + bytes.length, 0),
    12,
  )
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...files, ...directory, end])
}

const style = (font: number, fill: number, format = 0, numeric = false) =>
  '<xf numFmtId="' +
  format +
  '" fontId="' +
  font +
  '" fillId="' +
  fill +
  '" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" wrapText="1"' +
  (numeric ? ' horizontal="right"' : "") +
  "/></xf>"

const styles =
  '<styleSheet xmlns="' +
  ns +
  '">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/></numFmts>' +
  '<fonts count="4"><font><sz val="11"/><color rgb="FF121214"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF121214"/><name val="Calibri"/></font></fonts>' +
  '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  ["FF121214", "FF2F5BFF", "FFF2F1EE", "FFFFFFFF"]
    .map(
      (color) =>
        '<fill><patternFill patternType="solid"><fgColor rgb="' +
        color +
        '"/><bgColor indexed="64"/></patternFill></fill>',
    )
    .join("") +
  '</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="13">' +
  [
    style(0, 0),
    style(1, 2),
    style(2, 3),
    style(0, 4),
    style(0, 5),
    style(0, 4, 164, true),
    style(0, 5, 164, true),
    style(0, 4, 0, true),
    style(0, 5, 0, true),
    style(3, 4),
    style(3, 5),
    style(3, 4, 164, true),
    style(3, 5, 164, true),
  ].join("") +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

const column = (index: number) => String.fromCharCode(65 + index)
function cell(ref: string, value: string, styleIndex: number, numeric = false) {
  if (value.length > 32767)
    fail(422, "A report field exceeds Excel cell limits. Export CSV instead.")
  if (numeric && value) {
    if (
      !/^-?\d+(?:\.\d{2})?$/.test(value) ||
      value.replace(/\D/g, "").replace(/^0+/, "").length > 15
    )
      fail(
        422,
        "A report value exceeds Excel's exact numeric precision. Export CSV or narrow the scope.",
      )
    return (
      '<c r="' + ref + '" s="' + styleIndex + '" t="n"><v>' + value + "</v></c>"
    )
  }
  return (
    '<c r="' +
    ref +
    '" s="' +
    styleIndex +
    '" t="inlineStr"><is><t xml:space="preserve">' +
    xml(value) +
    "</t></is></c>"
  )
}

function worksheet(sheet: PayrollSheet, context: readonly string[]) {
  const header = context.length + 2
  const last = column(sheet.columns.length - 1)
  const range = "A" + header + ":" + last + (header + sheet.rows.length)
  const row = (index: number, body: string, height: number) =>
    '<row r="' +
    index +
    '" ht="' +
    height +
    '" customHeight="1">' +
    body +
    "</row>"
  const summary = sheet.name === "Summary"
  const rows = sheet.rows.map(({ cells }, index) => {
    const even = index % 2
    const n = index + header + 1
    const height = cells.some((value) => value.length > 46) ? 38 : 20
    return row(
      n,
      cells
        .map((value, i) => {
          const currency =
            sheet.currency?.has(i) ||
            (summary && i === 1 && value.includes("."))
          const numeric = Boolean(currency || sheet.numeric?.has(i))
          const styleIndex = currency
            ? (summary ? 11 : 5) + even
            : numeric
              ? 7 + even
              : (summary ? 9 : 3) + even
          return cell(column(i) + n, value, styleIndex, numeric)
        })
        .join(""),
      height,
    )
  })
  return (
    '<worksheet xmlns="' +
    ns +
    '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="' +
    header +
    '" topLeftCell="A' +
    (header + 1) +
    '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
    sheet.columns
      .map(
        (label, i) =>
          '<col min="' +
          (i + 1) +
          '" max="' +
          (i + 1) +
          '" width="' +
          (summary && i === 0
            ? 36
            : /reference|details|recorded deductions/i.test(label)
              ? 42
              : Math.max(18, Math.min(34, label.length + 5))) +
          '" customWidth="1"/>',
      )
      .join("") +
    "</cols><sheetData>" +
    row(1, cell("A1", "CONVERYN — PAYROLL REPORT", 1), 30) +
    context
      .map((value, i) => row(i + 2, cell("A" + (i + 2), value, 0), 29))
      .join("") +
    row(
      header,
      sheet.columns
        .map((label, i) => cell(column(i) + header, label, 2))
        .join(""),
      28,
    ) +
    rows.join("") +
    '</sheetData><autoFilter ref="' +
    range +
    '"/><mergeCells count="' +
    (context.length + 1) +
    '">' +
    Array.from(
      { length: context.length + 1 },
      (_, i) => '<mergeCell ref="A' + (i + 1) + ":" + last + (i + 1) + '"/>',
    ).join("") +
    '</mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape"/></worksheet>'
  )
}

export function payrollReportWorkbook(
  sheets: PayrollSheet[],
  context: readonly string[],
) {
  const types = (part: string, type: string) =>
    '<Override PartName="/xl/' +
    part +
    '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.' +
    type +
    '+xml"/>'
  const sheetPath = (index: number) => "worksheets/sheet" + (index + 1) + ".xml"
  const relation = (id: string, type: string, target: string) =>
    '<Relationship Id="' +
    id +
    '" Type="' +
    office +
    "/" +
    type +
    '" Target="' +
    target +
    '"/>'
  return archive([
    [
      "[Content_Types].xml",
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        types("workbook.xml", "sheet.main") +
        types("styles.xml", "styles") +
        sheets.map((_, i) => types(sheetPath(i), "worksheet")).join("") +
        "</Types>",
    ],
    [
      "_rels/.rels",
      '<Relationships xmlns="' +
        packageRelations +
        '">' +
        relation("rId1", "officeDocument", "xl/workbook.xml") +
        "</Relationships>",
    ],
    [
      "xl/workbook.xml",
      '<workbook xmlns="' +
        ns +
        '" xmlns:r="' +
        office +
        '"><bookViews><workbookView/></bookViews><sheets>' +
        sheets
          .map(
            ({ name }, i) =>
              '<sheet name="' +
              xml(name) +
              '" sheetId="' +
              (i + 1) +
              '" r:id="rId' +
              (i + 1) +
              '"/>',
          )
          .join("") +
        "</sheets></workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<Relationships xmlns="' +
        packageRelations +
        '">' +
        sheets
          .map((_, i) => relation("rId" + (i + 1), "worksheet", sheetPath(i)))
          .join("") +
        relation("rIdStyles", "styles", "styles.xml") +
        "</Relationships>",
    ],
    ["xl/styles.xml", styles],
    ...sheets.map((sheet, i): [string, string] => [
      "xl/" + sheetPath(i),
      worksheet(sheet, context),
    ]),
  ])
}
