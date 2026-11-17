"use client"

import { DateInput } from "@/components/ui/date-input"
import { useState } from "react"

export function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

export function QuotationDateTimePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [now] = useState(() => Date.now())
  const saved = value ? new Date(value) : null
  const label =
    saved && Number.isFinite(saved.getTime())
      ? `Valid until ${saved.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
      : "Choose validity date and time"
  return (
    <div data-quotation-validity className="w-full min-w-0 [&>div>button]:h-10">
      <DateInput
        triggerLabel={
          saved && Number.isFinite(saved.getTime())
            ? saved.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Select date & time"
        }
        type="datetime-local"
        name="validUntil"
        aria-label="Valid until"
        title={label}
        value={value}
        min={localDateTime(new Date(now + 60_000))}
        max={localDateTime(new Date(now + 366 * 86_400_000))}
        onDateSelect={onChange}
      />
    </div>
  )
}
