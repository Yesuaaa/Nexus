"use client"
import { useState } from "react"
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { FormTextarea } from "@/components/ui/form-input"
import { Alert } from "@/components/ui/alert"
import { FilterSelect } from "@/components/ui/filter-select"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import {
  requestAttendanceAdjustment,
  type AttendanceSession,
} from "../api/attendance-api"
import { deviceDateTime, deviceDateTimeOccurrences } from "../model/attendance"

type AdjustmentTime = { local: string; instant?: string }

function initialTime(instant?: string | null): AdjustmentTime {
  return instant ? { local: deviceDateTime(instant), instant } : { local: "" }
}

function resolveTime({ local, instant }: AdjustmentTime) {
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

function AdjustmentTimeInput({
  label,
  field,
  time,
  onChange,
}: {
  label: string
  field: AdjustmentTime
  time: ReturnType<typeof resolveTime>
  onChange: (field: AdjustmentTime) => void
}) {
  const showOccurrences = time.occurrences.length > 1
  const offsetFormat = showOccurrences
    ? new Intl.DateTimeFormat("en", { timeZoneName: "longOffset" })
    : undefined
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-xs">
        {label}
        <DateInput
          type="datetime-local"
          required
          value={field.local}
          aria-invalid={Boolean(field.local && !time.occurrences.length)}
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
    </div>
  )
}

export function AdjustmentDialog({
  session,
  onClose,
  onSaved,
  allowOvertime = false,
}: {
  session: AttendanceSession | null
  onClose: () => void
  onSaved: () => void
  allowOvertime?: boolean
}) {
  const [start, setStart] = useState(() => initialTime(session?.startedAt))
  const [end, setEnd] = useState(() => initialTime(session?.endedAt))
  const [reason, setReason] = useState("")
  const [type, setType] = useState<"CORRECTION" | "OVERTIME">("CORRECTION")
  const overtime = type === "OVERTIME"
  const [requestKey] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startTime = resolveTime(start)
  const endTime = resolveTime(end)
  const startLabel = overtime ? "Overtime start" : "Actual clock-in"
  const endLabel = overtime ? "Overtime end" : "Actual clock-out"
  return (
    <Modal size="md" busy={pending} onClose={onClose}>
      <ModalHeader
        title={
          overtime
            ? "Request overtime"
            : session
              ? "Request attendance correction"
              : "Request missing attendance"
        }
        description={
          overtime
            ? `Enter an overtime period within a completed session (${zone}). Unpaid breaks are excluded. The request cannot exceed recorded excess hours. HR gives final approval.`
            : `Enter the actual timestamps in your device timezone (${zone}). A reviewer will check your request.`
        }
      />
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          if (!startTime.instant || !endTime.instant) {
            const { label, time } = !startTime.instant
              ? { label: startLabel, time: startTime }
              : { label: endLabel, time: endTime }
            setError(
              time.occurrences.length
                ? `Choose a UTC offset for ${label.toLowerCase()}.`
                : `${label} is not a valid local time in ${zone}. Choose another time.`,
            )
            return
          }
          if (endTime.instant <= startTime.instant) {
            setError(`${endLabel} must be after ${startLabel.toLowerCase()}.`)
            return
          }
          setPending(true)
          setError("")
          try {
            await requestAttendanceAdjustment({
              type,
              requestKey,
              ...(session ? { sessionId: session.id } : {}),
              startedAt: startTime.instant.toISOString(),
              endedAt: endTime.instant.toISOString(),
              reason,
            })
            sileo.success({
              title: overtime ? "Overtime requested" : "Correction requested",
            })
            onSaved()
            onClose()
          } catch (failure) {
            setError(errorMessage(failure, "Couldn't submit the correction."))
          } finally {
            setPending(false)
          }
        }}
      >
        <ModalBody>
          <div className="grid gap-4">
            {allowOvertime && (
              <FilterSelect
                label="Request type"
                value={type}
                options={[
                  { value: "CORRECTION", label: "Correction" },
                  { value: "OVERTIME", label: "Overtime" },
                ]}
                onChange={(value) =>
                  setType(value as "CORRECTION" | "OVERTIME")
                }
              />
            )}
            <AdjustmentTimeInput
              label={startLabel}
              field={start}
              time={startTime}
              onChange={(field) => {
                setStart(field)
                setError("")
              }}
            />
            <AdjustmentTimeInput
              label={endLabel}
              field={end}
              time={endTime}
              onChange={(field) => {
                setEnd(field)
                setError("")
              }}
            />
            <label className="grid gap-2 text-xs">
              Reason
              <FormTextarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the correction for your reviewer"
              />
            </label>
            {error && <Alert>{error}</Alert>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="brandOutline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
