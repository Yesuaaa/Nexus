export function parseMoneyInput(value: string): string | null {
  const raw = value.replace(/[,\s₱$€£]/g, "")
  if (!/^\d{0,10}(?:\.\d{0,2})?$/.test(raw)) return null
  if (!raw || raw === ".") return raw === "." ? "0." : ""
  return raw.replace(/^0+(?=\d)/, "")
}

export function formatMoneyInput(raw: string): string {
  const [whole, fraction] = raw.split(".")
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction !== undefined ? `.${fraction}` : "")
  )
}

export function decimalMoneyValue(raw: string): string {
  if (!raw) return ""
  const [whole, fraction = ""] = raw.split(".")
  return `${whole || "0"}.${fraction.padEnd(2, "0")}`
}
