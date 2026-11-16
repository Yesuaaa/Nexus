import { fail } from "../../shared/http-error.js"

export function weekValue(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fail(400, "Choose a valid week")
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCDay() !== 1
  )
    return fail(400, "Week must start on Monday")
  return value
}
