import { useState } from "react"
import { DateInput } from "@/components/ui/date-input"

export function WorkloadWeekInput({
  week,
  onChange,
}: {
  week: string
  onChange: (week: string) => void
}) {
  const [draft, setDraft] = useState(week)
  const [error, setError] = useState("")
  function dateError(input: HTMLInputElement): string {
    const value = input.value
    const date = new Date(`${value}T00:00:00Z`)
    if (
      !input.validity.valid ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      return "Enter a valid date (year 0001–9999)."
    return ""
  }
  function apply(input: HTMLInputElement) {
    const value = input.value
    const date = new Date(`${value}T00:00:00Z`)
    const validationError = dateError(input)
    if (validationError) {
      setError(validationError)
      return
    }
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    const monday = date.toISOString().slice(0, 10)
    setError("")
    setDraft(monday)
    if (monday !== week) onChange(monday)
  }
  return (
    <div className="relative w-[140px] flex-none">
      <DateInput
        selectionMode="week"
        aria-label="Week starting"
        title="Choose a date; its Monday-starting week is shown"
        min="0001-01-01"
        max="9999-12-31"
        required
        value={draft}
        className="h-[34px] py-1"
        aria-invalid={!!error}
        aria-describedby={error ? "workload-week-error" : undefined}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(dateError(event.currentTarget))
        }}
        onBlur={(event) => apply(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            apply(event.currentTarget)
          }
        }}
      />
      {error && (
        <p
          id="workload-week-error"
          role="alert"
          className="mt-1 mb-0 max-w-48 text-[11px] text-[#bc3649]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
