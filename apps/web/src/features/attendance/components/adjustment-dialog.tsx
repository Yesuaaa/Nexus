"use client"
import { useState } from "react"
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormTextarea } from "@/components/ui/form-input"
import { Alert } from "@/components/ui/alert"
import { FilterSelect } from "@/components/ui/filter-select"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import {
  requestAttendanceAdjustment,
  type AttendanceSession,
} from "../api/attendance-api"
import {
  AttendanceDateTimeInput,
  attendanceDateTimeError,
  initialAttendanceDateTime,
  resolveAttendanceDateTime,
} from "./attendance-date-time-input"

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
  const [start, setStart] = useState(() =>
    initialAttendanceDateTime(session?.startedAt),
  )
  const [end, setEnd] = useState(() =>
    initialAttendanceDateTime(session?.endedAt),
  )
  const [reason, setReason] = useState("")
  const [type, setType] = useState<"CORRECTION" | "OVERTIME">("CORRECTION")
  const overtime = type === "OVERTIME"
  const [requestKey] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startTime = resolveAttendanceDateTime(start)
  const endTime = resolveAttendanceDateTime(end)
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
            setError(attendanceDateTimeError(label, time, zone))
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
            <AttendanceDateTimeInput
              label={startLabel}
              field={start}
              time={startTime}
              onChange={(field) => {
                setStart(field)
                setError("")
              }}
            />
            <AttendanceDateTimeInput
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
