"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { CalendarDays } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  WorkflowCard,
  WorkflowField,
  workflowInput,
  workflowButton,
} from "@/features/request-workflow/components/workflow-primitives"
import { ConsultationLocation } from "@/features/request-workflow/components/workflow-cards"
import {
  scheduleMeeting,
  updateMeeting,
  type ConversationBooking,
  type ConversationMeeting,
  type MeetingAction,
  type MeetingSchedule,
} from "../api/request-conversations-api"

function localTime(value: string | Date) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function scheduleFrom(data: FormData): MeetingSchedule {
  const startsAt = new Date(String(data.get("startsAt")))
  return {
    startsAt: startsAt.toISOString(),
    endsAt: new Date(
      startsAt.getTime() + Number(data.get("duration")) * 60_000,
    ).toISOString(),
    location: String(data.get("location")),
  }
}

function ScheduleFields({ meeting }: { meeting?: ConversationMeeting }) {
  const duration = meeting
    ? (new Date(meeting.endsAt).getTime() -
        new Date(meeting.startsAt).getTime()) /
      60_000
    : 30
  return (
    <>
      <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
        <WorkflowField label="Date and time">
          <input
            name="startsAt"
            type="datetime-local"
            required
            min={localTime(new Date())}
            defaultValue={
              meeting
                ? localTime(meeting.proposedStartsAt ?? meeting.startsAt)
                : undefined
            }
            className={workflowInput}
          />
        </WorkflowField>
        <WorkflowField label="Duration">
          <select
            name="duration"
            defaultValue={String(duration)}
            className={workflowInput}
          >
            {[...new Set([15, 30, 45, 60, 90, 120, duration])]
              .sort((a, b) => a - b)
              .map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
          </select>
        </WorkflowField>
      </div>
      <WorkflowField label="Meeting link or location">
        <input
          name="location"
          required
          maxLength={1000}
          defaultValue={meeting?.location}
          placeholder="Meeting link or office address"
          className={workflowInput}
        />
      </WorkflowField>
    </>
  )
}

export function ScheduleConversationMeeting({
  conversationId,
  bookings,
  onClose,
  onSaved,
}: {
  conversationId: string
  bookings: ConversationBooking[]
  onClose: () => void
  onSaved: (meeting: ConversationMeeting) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const pending = useRef<{ payload: string; id: string } | null>(null)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const data = new FormData(event.currentTarget)
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      const input = {
        ...scheduleFrom(data),
        notes: String(data.get("notes") || ""),
        bookingIds: [...selectedIds].sort(),
      }
      const payload = JSON.stringify(input)
      if (pending.current?.payload !== payload)
        pending.current = { payload, id: crypto.randomUUID() }
      const { meeting } = await scheduleMeeting(conversationId, {
        ...input,
        clientActionId: pending.current.id,
      })
      onSaved(meeting)
      sileo.success({ title: "Meeting scheduled" })
      onClose()
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't schedule this meeting. Try again."
      setError(message)
      sileo.error({ title: "Meeting not scheduled", description: message })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="z-[141] max-h-[85dvh] w-[calc(100%-32px)] max-w-lg overflow-y-auto rounded-2xl border-[#dce3ee] bg-white text-[#182235]"
        overlayClassName="z-[140] bg-[#14213d]/35"
      >
        <DialogTitle className="pr-5 text-sm">
          Schedule consultation/meeting
        </DialogTitle>
        <DialogDescription className="text-xs leading-5 text-[#52627a]">
          Arrange a general meeting with the client or discuss one or more
          booked services. Selecting services is optional.
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <fieldset
            disabled={busy}
            className="m-0 min-w-0 space-y-4 border-0 p-0"
          >
            <WorkflowField label="Meeting topic">
              <textarea
                name="notes"
                maxLength={2000}
                rows={2}
                placeholder="What would you like to discuss?"
                className={workflowInput}
              />
            </WorkflowField>
            <ScheduleFields />
            <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
              <legend className="mb-2 text-[11px] font-medium text-[#52627a]">
                Related services (optional)
              </legend>
              <p className="m-0 mb-3 text-xs text-[#52627a]">
                Leave all services unchecked for a general meeting. Select
                several to discuss them together.
              </p>
              {bookings.map((booking) => (
                <label
                  key={booking.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce3ee] p-3 has-checked:border-[#294a9b] has-checked:bg-[#edf1f8]"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(booking.id)}
                    onChange={(event) =>
                      setSelectedIds((previous) =>
                        event.target.checked
                          ? [...previous, booking.id]
                          : previous.filter((id) => id !== booking.id),
                      )
                    }
                    className="mt-1 accent-[#203f8c]"
                  />
                  <span className="min-w-0 text-xs">
                    <span className="block font-semibold">
                      {booking.serviceName}
                    </span>
                    <span className="mt-1 block text-[10px] break-all text-[#52627a]">
                      {booking.referenceNumber || booking.id}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="m-0 text-xs font-medium text-[#203f8c]">
              {selectedIds.length
                ? `${selectedIds.length} related ${selectedIds.length === 1 ? "service" : "services"}`
                : "General meeting · No specific service"}
            </p>
          </fieldset>
          {error && (
            <p role="alert" className="m-0 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
            >
              {busy ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConversationMeetingCard({
  meeting,
  conversationId,
  isManager,
  canAct,
  onSaved,
  onRefresh,
}: {
  meeting: ConversationMeeting
  conversationId: string
  isManager: boolean
  canAct: boolean
  onSaved: (meeting: ConversationMeeting) => void
  onRefresh: () => void
}) {
  const [form, setForm] = useState<"reschedule" | "request" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  async function act(action: MeetingAction) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      const result = await updateMeeting(
        conversationId,
        meeting.id,
        meeting.version,
        action,
      )
      onSaved(result.meeting)
      setForm(null)
      sileo.success({ title: "Meeting updated" })
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't update this meeting. Try again."
      setError(message)
      sileo.error({ title: "Meeting not updated", description: message })
      onRefresh()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const scheduled = meeting.status === "SCHEDULED"
  return (
    <WorkflowCard
      title="Consultation/meeting"
      status={meeting.status}
      icon={CalendarDays}
    >
      <p className="m-0 whitespace-pre-wrap font-medium text-[#182235]">
        {meeting.notes || "General meeting"}
      </p>
      <p className="m-0">
        <time dateTime={meeting.startsAt}>
          {new Date(meeting.startsAt).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        {" – "}
        {new Date(meeting.endsAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })}
        {" · "}
        <ConsultationLocation
          location={meeting.location}
          label="Join meeting"
        />
      </p>
      {meeting.bookings.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Related services">
          {meeting.bookings.map(({ booking }) => (
            <span
              key={booking.id}
              className="rounded-lg bg-[#eaf0fb] px-2 py-1 text-[10px] text-[#203f8c]"
            >
              {booking.service.name} · {booking.referenceNumber || booking.id}
            </span>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[11px]">General meeting · No specific service</p>
      )}
      {scheduled && meeting.proposedStartsAt && (
        <div className="space-y-2 rounded-lg bg-[#f1f4fa] p-3">
          <p className="m-0 font-medium">
            Reschedule requested:{" "}
            {new Date(meeting.proposedStartsAt).toLocaleString("en-PH")}
          </p>
          <p className="m-0 whitespace-pre-wrap">{meeting.rescheduleNote}</p>
          <p className="m-0 text-[11px]">
            The existing schedule remains until the department head confirms a
            change.
          </p>
          {isManager && canAct && (
            <Button
              className={workflowButton}
              variant="outline"
              disabled={busy}
              onClick={() => void act({ type: "KEEP_SCHEDULE" })}
            >
              Keep existing schedule
            </Button>
          )}
        </div>
      )}
      {scheduled && canAct && (
        <>
          <div className="flex flex-wrap gap-2">
            {isManager ? (
              <>
                <Button
                  variant="outline"
                  className={workflowButton}
                  disabled={busy}
                  onClick={() => setForm("reschedule")}
                >
                  {meeting.proposedStartsAt
                    ? "Review reschedule"
                    : "Reschedule meeting"}
                </Button>
                <Button
                  variant="outline"
                  className={workflowButton}
                  disabled={busy || new Date(meeting.startsAt).getTime() > now}
                  onClick={() => void act({ type: "COMPLETE" })}
                >
                  Mark complete
                </Button>
                <Button
                  variant="outline"
                  className={workflowButton}
                  disabled={busy}
                  onClick={() => void act({ type: "CANCEL" })}
                >
                  Cancel meeting
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className={workflowButton}
                disabled={busy || Boolean(meeting.proposedStartsAt)}
                onClick={() => setForm("request")}
              >
                Request reschedule
              </Button>
            )}
          </div>
          {form && (
            <form
              className="space-y-3 rounded-xl border border-[#dce3ee] p-3"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                void act(
                  form === "reschedule"
                    ? { type: "RESCHEDULE", ...scheduleFrom(data) }
                    : {
                        type: "REQUEST_RESCHEDULE",
                        startsAt: new Date(
                          String(data.get("startsAt")),
                        ).toISOString(),
                        note: String(data.get("note")),
                      },
                )
              }}
            >
              <fieldset
                disabled={busy}
                className="m-0 min-w-0 space-y-3 border-0 p-0"
              >
                {form === "reschedule" ? (
                  <ScheduleFields key={meeting.version} meeting={meeting} />
                ) : (
                  <>
                    <WorkflowField label="Requested date and time">
                      <input
                        type="datetime-local"
                        name="startsAt"
                        required
                        min={localTime(new Date())}
                        className={workflowInput}
                      />
                    </WorkflowField>
                    <WorkflowField label="Reason for rescheduling">
                      <textarea
                        name="note"
                        required
                        maxLength={2000}
                        rows={2}
                        className={workflowInput}
                      />
                    </WorkflowField>
                  </>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={workflowButton}
                    onClick={() => setForm(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    className={`${workflowButton} bg-[#203f8c] text-white`}
                  >
                    {form === "reschedule"
                      ? "Confirm new schedule"
                      : "Send reschedule request"}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-xs text-red-700">
          {error}
        </p>
      )}
    </WorkflowCard>
  )
}
