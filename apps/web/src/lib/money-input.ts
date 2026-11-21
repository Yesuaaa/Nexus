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

export function moneyInputCaret(formatted: string, characters: number): number {
  let caret = 0
  while (caret < formatted.length && characters > 0) {
    if (formatted[caret] !== ",") characters--
    caret++
  }
  return caret
}

export function moneyInputError(raw: string, requirePositive: boolean): string {
  if (!raw)
    return requirePositive ? "Base rate is required." : "Amount is required."
  if (!/^\d*(?:\.\d*)?$/.test(raw) || raw === ".")
    return "Enter a valid amount."
  const [whole, fraction = ""] = raw.split(".")
  if (fraction.length > 2) return "Use no more than 2 decimal places."
  // Decimal(12, 2), also enforced by the compensation API.
  if (whole.length > 10) return "Amount exceeds the allowed limit."
  if (requirePositive && !/[1-9]/.test(raw))
    return "Base rate must be greater than zero."
  return ""
}

export function isMoneyInputPaste(text: string): boolean {
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)
}
