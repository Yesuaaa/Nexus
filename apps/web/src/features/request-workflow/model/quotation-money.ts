export function parseMoneyInput(value: string): string | null {
  const raw = value.replace(/[,\s₱$€£]/g, "")
  if (!/^\d{0,10}(?:\.\d{0,2})?$/.test(raw)) return null
  if (!raw || raw === ".") return raw === "." ? "0." : ""
  return raw.replace(/^0+(?=\d)/, "")
}
