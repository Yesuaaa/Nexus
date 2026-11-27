/** Compare the written calendar day before applying the timestamp's offset. */
export function hasValidCalendarDay(timestamp: string): boolean {
  const day = timestamp.slice(0, 10)
  const utc = new Date(`${day}T00:00:00Z`)
  return (
    Number.isFinite(utc.getTime()) && utc.toISOString().slice(0, 10) === day
  )
}

export function manilaCalendarDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`)
}
