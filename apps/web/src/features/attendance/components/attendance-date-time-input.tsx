"use client"

import { useId } from "react"
import { Alert } from "@/components/ui/alert"
import { DateInput } from "@/components/ui/date-input"
import { FilterSelect } from "@/components/ui/filter-select"
import { deviceDateTime, deviceDateTimeOccurrences } from "../model/attendance"

type AttendanceDateTime = { local: string; instant?: string }

export function initialAttendanceDateTime(
  instant?: string | null,
): AttendanceDateTime {
  return instant ? { local: deviceDateTime(instant), instant } : { local: "" }
}

export function resolveAttendanceDateTime({
  local,
  instant,
}: AttendanceDateTime) {
  const occurrences = deviceDateTimeOccurrences(local)
  const stored = Date.parse(instant ?? "")
  const selected = instant
    ? occurrences.find((choice) => {
        // Prefills display minutes while the stored instant can include seconds.
        const elapsed = stored - choice.getTime()
        return elapsed >= 0 && elapsed < 60000
      })
    : occurrences.length === 1
      ? occurrences[0]
      : undefined
  return {
    occurrences,
    selected: selected?.toISOString() ?? "",
    instant: selected && (instant ? new Date(stored) : selected),
  }
}

type ResolvedDateTime = ReturnType<typeof resolveAttendanceDateTime>

export function attendanceDateTimeError(
  label: string,
  time: ResolvedDateTime,
  zone: string,
) {
  return time.occurrences.length
    ? `Choose a UTC offset for ${label.toLowerCase()}.`
    : `${label} is not a valid local time in ${zone}. Choose another time.`
}

export function AttendanceDateTimeInput({
  label,
  field,
  time,
  onChange,
  disabled,
  validationMessage,
}: {
  label: string
  field: AttendanceDateTime
  time: ResolvedDateTime
  onChange: (field: AttendanceDateTime) => void
  disabled?: boolean
  validationMessage?: string
}) {
  const validationId = useId()
  const offsetFormat =
    time.occurrences.length > 1
      ? new Intl.DateTimeFormat("en", { timeZoneName: "longOffset" })
      : undefined
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-xs">
        {label}
        <DateInput
          type="datetime-local"
          required
          disabled={disabled}
          value={field.local}
          aria-invalid={Boolean(field.local && !time.occurrences.length)}
          aria-describedby={validationMessage ? validationId : undefined}
          onChange={(event) => {
            const local = event.currentTarget.value
            if (local !== field.local) onChange({ local })
          }}
        />
      </label>
      {offsetFormat && (
        <div className="grid gap-2 text-xs">
          <span>{label} occurrence</span>
          <FilterSelect
            label={`${label} occurrence`}
            placeholder="Choose a UTC offset"
            triggerClassName="w-full"
            disabled={disabled}
            value={time.selected}
            options={time.occurrences.map((instant) => ({
              value: instant.toISOString(),
              label:
                offsetFormat
                  .formatToParts(instant)
                  .find((part) => part.type === "timeZoneName")
                  ?.value.replace("GMT", "UTC") ?? instant.toISOString(),
            }))}
            onChange={(instant) => onChange({ local: field.local, instant })}
          />
        </div>
      )}
      {validationMessage && (
        <Alert variant="text" id={validationId}>
          {validationMessage}
        </Alert>
      )}
    </div>
  )
}
