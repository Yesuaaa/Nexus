"use client"

import { useRef, useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FormTextarea } from "@/components/ui/form-input"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import {
  reconcileAttendance,
  type AttendanceSession,
  type AttendanceWorkday,
} from "../api/attendance-api"
import {
  AttendanceDateTimeInput,
  attendanceDateTimeError,
  initialAttendanceDateTime,
  resolveAttendanceDateTime,
} from "./attendance-date-time-input"

export function AttendanceReconciliationDialog({
  day,
  session,
  onClose,
  onSaved,
}: {
  day: AttendanceWorkday
  session: AttendanceSession
  onClose: () => void
  onSaved: () => void
}) {
  const [end, setEnd] = useState(() => ({
    ...initialAttendanceDateTime(),
    zone: "",
  }))
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const submitting = useRef(false)
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const endField = end.zone === zone ? end : { local: end.local }
  const endTime = resolveAttendanceDateTime(endField)
  const endLabel = "Confirmed clock-out"
  const note = reason.trim()
  const validNote = note.length >= 5 && note.length <= 2000

  return (
    <Modal size="md" busy={pending} onClose={onClose}>
      <ModalHeader
        title="Reconcile suspended shift"
        description={`${day.employee?.fullName ?? "Employee"} · ${day.workDate}. Enter the confirmed clock-out in your device timezone (${zone}).`}
      />
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (submitting.current) return
          const currentZone = Intl.DateTimeFormat().resolvedOptions().timeZone
          if (currentZone !== zone) {
            setError(
              `Your device timezone changed to ${currentZone}. Review the clock-out time and try again.`,
            )
            return
          }
          if (!endTime.instant || !validNote) return
          submitting.current = true
          setPending(true)
          setError("")
          try {
            await reconcileAttendance(
              day.employeeId,
              session.id,
              endTime.instant.toISOString(),
              note,
            )
            sileo.success({ title: "Shift reconciled" })
            onSaved()
            onClose()
          } catch (failure) {
            setError(errorMessage(failure, "Couldn't reconcile the shift."))
          } finally {
            submitting.current = false
            setPending(false)
          }
        }}
      >
        <ModalBody>
          <div className="grid gap-4">
            <AttendanceDateTimeInput
              label={endLabel}
              field={endField}
              time={endTime}
              disabled={pending}
              validationMessage={
                end.local && !endTime.instant
                  ? attendanceDateTimeError(endLabel, endTime, zone)
                  : undefined
              }
              onChange={(field) => {
                setEnd({ ...field, zone })
                setError("")
              }}
            />
            <label className="grid gap-2 text-xs">
              Reason (5–2,000 characters)
              <FormTextarea
                required
                minLength={5}
                maxLength={2000}
                disabled={pending}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
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
          <Button
            type="submit"
            variant="brand"
            disabled={pending || !endTime.instant || !validNote}
          >
            {pending ? "Reconciling…" : "Reconcile shift"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
