"use client"

import { useRef, useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
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
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const submitting = useRef(false)
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const endedAt = new Date(end)
  const note = reason.trim()
  const valid =
    Number.isFinite(endedAt.getTime()) &&
    note.length >= 5 &&
    note.length <= 2000

  return (
    <Modal size="md" busy={pending} onClose={onClose}>
      <ModalHeader
        title="Reconcile suspended shift"
        description={`${day.employee?.fullName ?? "Employee"} · ${day.workDate}. Enter the confirmed clock-out in your device timezone (${zone}).`}
      />
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (submitting.current || !valid) return
          submitting.current = true
          setPending(true)
          setError("")
          try {
            await reconcileAttendance(
              day.employeeId,
              session.id,
              endedAt.toISOString(),
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
            <label className="grid gap-2 text-xs">
              Confirmed clock-out
              <DateInput
                type="datetime-local"
                required
                disabled={pending}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
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
          <Button type="submit" variant="brand" disabled={pending || !valid}>
            {pending ? "Reconciling…" : "Reconcile shift"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
