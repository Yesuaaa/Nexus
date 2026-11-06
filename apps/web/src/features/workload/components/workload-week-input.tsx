import { DateInput } from "@/components/ui/date-input"

export function WorkloadWeekInput({
  week,
  onChange,
}: {
  week: string
  onChange: (week: string) => void
}) {
  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${week}T12:00:00Z`))
  return (
    <DateInput
      iconOnly
      selectionMode="week"
      aria-label={`Change workload week, starting ${weekLabel}`}
      title={`Week starting ${weekLabel}`}
      min="0001-01-01"
      max="9999-12-31"
      value={week}
      onDateSelect={(value) => {
        const date = new Date(`${value}T12:00:00Z`)
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
        const monday = date.toISOString().slice(0, 10)
        if (monday !== week) onChange(monday)
      }}
    />
  )
}
