import { payslipLogo } from "./payslip-logo.js"

// Standard PDF text streams use WinAnsi for the built-in Courier font.
function pdfText(value: string) {
  return [...value.replace(/[’‘]/g, "'").replace(/[–—]/g, "-")]
    .map((character) => {
      const code = character.codePointAt(0)!
      if (code > 255) return "?"
      if (code < 32 || code > 126 || "()".includes(character) || code === 92)
        return "\\" + code.toString(8).padStart(3, "0")
      return character
    })
    .join("")
}

type FinancialLine = { name: string; amount: string }

export type PayslipDocument = {
  showCompanyLogo?: boolean
  employee: string
  employeeId?: string
  period: string
  dates: string
  frequency: string
  revision: number
  reference: string
  generatedOn: string
  earnings: FinancialLine[]
  deductions: FinancialLine[]
  gross: string
  totalDeductions: string
  net: string
}

const margin = 46
const width = 503
const gutter = 14
const column = (width - gutter) / 2
const right = margin + column + gutter
const ink = ".071 .071 .078"
const muted = ".30 .34 .41"
const blue = ".184 .357 1"
const tint = ".94 .96 1"
const border = ".82 .85 .90"
const integer = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 })

function wrap(value: string, limit: number) {
  const lines: string[] = []
  let rest = value.replace(/\s+/g, " ").trim()
  while (rest.length > limit) {
    const space = rest.lastIndexOf(" ", limit)
    const end = space > 0 ? space : limit
    lines.push(rest.slice(0, end))
    rest = rest.slice(end).trimStart()
  }
  return [...lines, rest]
}

export function renderPayslipPdf(
  data: PayslipDocument,
): Uint8Array<ArrayBuffer> {
  const pages: string[] = []
  let commands: string[] = []
  const text = (
    value: string,
    x: number,
    y: number,
    size = 10,
    bold = false,
    color = ink,
  ) =>
    commands.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${pdfText(value)}) Tj ET`,
    )
  const box = (x: number, y: number, w: number, h: number, color: string) =>
    commands.push(`${color} rg ${x} ${y} ${w} ${h} re f`)
  const rule = (x: number, end: number, y: number) =>
    commands.push(`${border} RG .5 w ${x} ${y} m ${end} ${y} l S`)
  function amount(
    value: string,
    end: number,
    y: number,
    size = 10,
    bold = false,
    maxWidth = 120,
  ) {
    const [whole, fraction] = value.replace(/^-/, "").split(".")
    const digits = `${value.startsWith("-") ? "-" : ""}${integer.format(BigInt(whole))}.${fraction}`
    size = Math.min(size, Math.floor(maxWidth / (digits.length * 0.6 + 0.67)))
    const x = end - digits.length * size * 0.6
    // Courier has no peso glyph. Draw it and preserve the Unicode value for extraction.
    const origin = x - size * 0.67
    commands.push(
      `/Span << /ActualText <FEFF20B1> >> BDC q ${size / 10} 0 0 ${size / 10} ${origin} ${y} cm ${ink} RG .62 w 1 0 m 1 7 l 3 7 l 6 7 6 2.7 3 2.7 c 1 2.7 l S 0 5.6 m 6.2 5.6 l 0 4.1 m 6.2 4.1 l S Q EMC`,
    )
    text(digits, x, y, size, bold)
  }
  function header(continued: boolean) {
    commands = []
    if (data.showCompanyLogo)
      commands.push(`q 60 0 0 30.9 ${margin} 758 cm /Logo Do Q`)
    text(
      "EXP Digital Solutions",
      margin + (data.showCompanyLogo ? 69 : 0),
      778,
      17,
      true,
    )
    text("EMPLOYEE PAYSLIP", 405, 790, 12, true, blue)
    text(data.period, 405, 773, 9, false, muted)
    text(`Approved revision ${data.revision}`, 405, 759, 9, false, muted)
    rule(margin, margin + width, 749)
    if (continued) text("Financial breakdown continued", margin, 725, 11, true)
  }
  function finishPage() {
    rule(margin, margin + width, 94)
    text(`Reference: ${data.reference}`, margin, 79, 8, false, muted)
    text(
      `Generated: ${data.generatedOn}  |  Revision: ${data.revision}  |  Page ${pages.length + 1}`,
      margin,
      66,
      8,
      false,
      muted,
    )
    text(
      "This payslip was generated electronically by Converyn for EXP Digital Solutions.",
      margin,
      53,
      8,
      false,
      muted,
    )
    pages.push(commands.join("\n") + "\n")
  }
  function tableHeader(y: number) {
    for (const [x, title] of [
      [margin, "EARNINGS"],
      [right, "DEDUCTIONS"],
    ] as const) {
      box(x, y - 23, column, 23, tint)
      text(title, x + 8, y - 15, 10, true)
      text("Description", x + 8, y - 38, 8, false, muted)
      text("Amount", x + column - 37, y - 38, 8, false, muted)
      rule(x, x + column, y - 44)
    }
    return y - 44
  }

  header(false)
  text("EMPLOYEE SUMMARY", margin, 727, 10, true, blue)
  let identityY = 707
  for (const line of wrap(data.employee, 41)) {
    text(line, margin, identityY, 11, true)
    identityY -= 15
  }
  for (const field of [
    ...(data.employeeId ? [`Employee ID: ${data.employeeId}`] : []),
    `Period: ${data.period}`,
    data.dates,
    `Frequency: ${data.frequency}`,
  ]) {
    for (const line of wrap(field, 51)) {
      text(line, margin, identityY, 9, false, muted)
      identityY -= 13
    }
  }
  box(404, 645, 145, 88, tint)
  text("EMPLOYEE NET PAY", 415, 713, 9, true)
  amount(data.net, 538, 682, data.net.length > 12 ? 12 : 16, true)
  text("Approved payroll amount", 415, 659, 8, false, muted)

  let y = tableHeader(Math.min(identityY - 13, 626))
  const rowCount = Math.max(data.earnings.length, data.deductions.length, 1)
  for (let index = 0; index < rowCount; index++) {
    const earning = data.earnings[index]
    const deduction = data.deductions[index]
    const earningLabel = earning ? wrap(earning.name, 22) : []
    const deductionLabel = deduction ? wrap(deduction.name, 22) : []
    const height =
      10 + 12 * Math.max(earningLabel.length, deductionLabel.length, 1)
    if (y - height < 111) {
      finishPage()
      header(true)
      y = tableHeader(709)
    }
    for (const [x, line, label] of [
      [margin, earning, earningLabel],
      [right, deduction, deductionLabel],
    ] as const) {
      label.forEach((part, i) => text(part, x + 8, y - 14 - 12 * i, 9))
      if (line) amount(line.amount, x + column - 8, y - 14, 9)
      if (index === 0 && x === right && !data.deductions.length)
        text("No deductions recorded", x + 8, y - 14, 9, false, muted)
      rule(x, x + column, y - height)
    }
    y -= height
  }
  if (y - 95 < 111) {
    finishPage()
    header(true)
    y = 709
  }
  text("Gross pay", margin + 8, y - 17, 10, true)
  amount(data.gross, margin + column - 8, y - 17, 10, true)
  text("Total deductions", right + 8, y - 17, 10, true)
  amount(data.totalDeductions, right + column - 8, y - 17, 10, true)
  rule(margin, margin + width, y - 36)
  box(379, y - 90, 170, 53, tint)
  text("TOTAL NET PAYABLE", margin + 8, y - 58, 12, true)
  text(
    "Gross earnings less total deductions",
    margin + 8,
    y - 75,
    9,
    false,
    muted,
  )
  amount(data.net, 537, y - 72, 17, true, 146)
  finishPage()
  return serializePdf(pages, data.showCompanyLogo === true)
}

function serializePdf(
  pages: string[],
  withLogo: boolean,
): Uint8Array<ArrayBuffer> {
  const firstPageObject = withLogo ? 6 : 5
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count " +
      pages.length +
      " /Kids [" +
      pages.map((_, i) => firstPageObject + i * 2 + " 0 R").join(" ") +
      "] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
  ]
  if (withLogo) {
    const stream = Buffer.from(payslipLogo.jpeg, "base64").toString("hex") + ">"
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${payslipLogo.width} /Height ${payslipLogo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    )
  }
  for (const [index, stream] of pages.entries()) {
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>" +
        (withLogo ? " /XObject << /Logo 5 0 R >>" : "") +
        " >> /Contents " +
        (firstPageObject + 1 + index * 2) +
        " 0 R >>",
    )
    objects.push(
      "<< /Length " +
        Buffer.byteLength(stream) +
        " >>\nstream\n" +
        stream +
        "endstream",
    )
  }
  let pdf = "%PDF-1.4\n"
  const offsets = objects.map((body, index) => {
    const offset = Buffer.byteLength(pdf)
    pdf += index + 1 + " 0 obj\n" + body + "\nendobj\n"
    return offset
  })
  const xref = Buffer.byteLength(pdf)
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n"
  for (const offset of offsets)
    pdf += String(offset).padStart(10, "0") + " 00000 n \n"
  pdf +=
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF\n"
  return Uint8Array.from(Buffer.from(pdf))
}
