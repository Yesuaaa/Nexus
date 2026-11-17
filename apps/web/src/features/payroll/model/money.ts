const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats an API decimal string without converting salary values to Number. */
export function formatPayrollMoney(value: string | null | undefined): string {
  if (!value || !/^(?:0|[1-9]\d{0,9})\.\d{2}$/.test(value)) return "—"
  const [whole, fraction] = value.split(".")
  const parts = currencyFormatter.formatToParts(BigInt(whole))
  return parts
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("")
}
