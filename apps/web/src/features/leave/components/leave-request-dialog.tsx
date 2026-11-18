"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { FilterSelect } from "@/components/ui/filter-select"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import { previewLeave, submitLeave, type LeaveType } from "../api/leave-api"

const types = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "EMERGENCY", label: "Emergency leave" },
  { value: "UNPAID", label: "Unpaid leave" },
  { value: "OTHER", label: "Other leave" },
] satisfies { value: LeaveType; label: string }[]

export function LeaveRequestDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<LeaveType>("ANNUAL")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [requestKey] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const rangeReady =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    startDate <= endDate
  const preview = useAsyncResource(
    (signal) => previewLeave(startDate, endDate, signal),
    [startDate, endDate],
    {
      enabled: rangeReady,
      fallbackError: "Couldn't calculate leave coverage.",
    },
  )

  return (
    <Modal size="md" busy={pending} closeOnEscape={false} onClose={onClose}>
      <ModalHeader
        title="Request leave"
        description="Choose an inclusive date range. Working time comes from your assigned attendance policy."
        closeDisabled={pending}
        closeLabel="Close leave request"
      />
      <Form
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            pending ||
            !rangeReady ||
            preview.loading ||
            !preview.data ||
            preview.error
          )
            return
          setPending(true)
          setError("")
          try {
            await submitLeave({ requestKey, type, reason, startDate, endDate })
            sileo.success({ title: "Leave request submitted" })
            onSaved()
            onClose()
          } catch (failure) {
            setError(errorMessage(failure, "Couldn't submit leave request."))
          } finally {
            setPending(false)
          }
        }}
      >
        <ModalBody>
          {error && <Alert>{error}</Alert>}
          <label className="grid gap-1 text-xs font-medium">
            Leave type
            <FilterSelect
              label="Leave type"
              value={type}
              options={types}
              disabled={pending}
              triggerClassName="h-10 w-full"
              onChange={setType}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium">
              Start date
              <DateInput
                required
                aria-label="Leave start date"
                value={startDate}
                max={endDate || undefined}
                disabled={pending}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              End date
              <DateInput
                required
                aria-label="Leave end date"
                value={endDate}
                min={startDate || undefined}
                disabled={pending}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium">
            Private reason
            <FormTextarea
              required
              minLength={5}
              maxLength={2000}
              value={reason}
              disabled={pending}
              placeholder="Explain the leave request for authorized reviewers."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {rangeReady && (
            <div
              role="status"
              className="rounded-lg border border-[#e3e7ed] bg-[#f8fafc] p-3 text-xs leading-5 text-[#65718a]"
            >
              {preview.loading
                ? "Calculating working days…"
                : preview.error
                  ? preview.error
                  : preview.data
                    ? `${preview.data.days.filter((day) => day.leaveMinutes > 0).length} working day(s), ${preview.data.totalMinutes / 60} hours covered.`
                    : null}
            </div>
          )}
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
            disabled={
              pending ||
              !rangeReady ||
              preview.loading ||
              !preview.data ||
              Boolean(preview.error)
            }
          >
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  )
}
