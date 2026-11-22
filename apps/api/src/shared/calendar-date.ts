/** Compare the written calendar day before applying the timestamp's offset. */
export function hasValidCalendarDay(timestamp: string): boolean {
  const day = timestamp.slice(0, 10)
  const utc = new Date(`${day}T00:00:00Z`)
  return (
    Number.isFinite(utc.getTime()) && utc.toISOString().slice(0, 10) === day
  )
}
