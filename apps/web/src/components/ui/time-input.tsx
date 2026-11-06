"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

const pad = (value: number) => String(value).padStart(2, "0")

export function TimeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [hours, minutes] = value.split(":").map(Number)
  const hour = pad(hours % 12 || 12)
  const minute = pad(minutes || 0)
  const period = hours >= 12 ? "PM" : "AM"
  function change(nextHour: string, nextMinute: string, nextPeriod: string) {
    onChange(
      `${pad((Number(nextHour) % 12) + (nextPeriod === "PM" ? 12 : 0))}:${nextMinute}`,
    )
  }
  const fields = [
    {
      label: "Hour",
      value: hour,
      values: Array.from({ length: 12 }, (_, index) => pad(index + 1)),
      change: (next: string) => change(next, minute, period),
    },
    {
      label: "Minute",
      value: minute,
      values: Array.from({ length: 60 }, (_, index) => pad(index)),
      change: (next: string) => change(hour, next, period),
    },
    {
      label: "Period",
      value: period,
      values: ["AM", "PM"],
      change: (next: string) => change(hour, minute, next),
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map((field) => (
        <label
          key={field.label}
          className="grid min-w-0 gap-1.5 text-[10px] font-medium text-[#738096]"
        >
          {field.label}
          <Select value={field.value} onValueChange={field.change}>
            <SelectTrigger
              aria-label={field.label}
              className="h-8 min-w-0 rounded-lg border-[#dfe5ee] bg-white px-2 text-xs shadow-none focus:ring-[#294a9b]/20"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[180]">
              {field.values.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ))}
    </div>
  )
}
