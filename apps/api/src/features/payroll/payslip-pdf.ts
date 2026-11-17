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

export function renderPayslipPdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const content = lines.flatMap((line) => line.match(/.{1,80}/gu) ?? [""])
  const pages = Array.from(
    { length: Math.ceil(content.length / 42) },
    (_, index) => content.slice(index * 42, (index + 1) * 42),
  )
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count " +
      pages.length +
      " /Kids [" +
      pages.map((_, i) => 4 + i * 2 + " 0 R").join(" ") +
      "] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ]
  for (const [index, page] of pages.entries()) {
    const stream =
      "BT /F1 10 Tf 15 TL 48 790 Td\n" +
      page.map((line) => "(" + pdfText(line) + ") Tj T*").join("\n") +
      "\nET\n"
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents " +
        (5 + index * 2) +
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
