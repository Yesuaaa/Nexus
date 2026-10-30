"use client"

import { useState, type FormEvent } from "react"
import { sileo } from "sileo"
import { WorkloadButton as Button } from "./workload-button"
import {
  addCommitment,
  saveConfiguration,
  type Schedule,
  type WorkloadDetail,
} from "../api/workload-api"
import { Field, fieldClass, manilaISO, splitSkills } from "./workload-ui"

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]
const time = (minute: number) =>
  `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
const minute = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

export function ConfigurationForm({
  employee,
  onSaved,
}: {
  employee: WorkloadDetail
  onSaved: () => void
}) {
  const [rows, setRows] = useState<Schedule[]>(employee.workingSchedule)
  const [recordedSkills, setRecordedSkills] = useState(
    employee.skills.join(", "),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await saveConfiguration(employee.id, splitSkills(recordedSkills), rows)
      onSaved()
      sileo.success({ title: "Availability configuration saved" })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save configuration",
      )
    } finally {
      setBusy(false)
    }
  }
  function update(index: number, changes: Partial<Schedule>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-semibold">Working schedule and skills</h3>
      <p className="text-sm text-muted-foreground">
        Manually configured hours in Asia/Manila. Add separate shifts for breaks
        or part-time arrangements. No schedule means no available capacity.
        Changes recalculate capacity and may flag existing assignments for
        review.
      </p>
      <Field label="Skills / specializations (comma separated)">
        <input
          className={fieldClass}
          value={recordedSkills}
          onChange={(e) => setRecordedSkills(e.target.value)}
          maxLength={2000}
        />
      </Field>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(90px,1fr)_1fr_1fr_auto] items-end gap-2"
        >
          <Field label={`Day ${index + 1}`}>
            <select
              className={fieldClass}
              value={row.weekday}
              onChange={(e) =>
                update(index, { weekday: Number(e.target.value) })
              }
            >
              {weekdays.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input
              className={fieldClass}
              type="time"
              required
              value={time(row.startMinute)}
              onChange={(e) =>
                update(index, { startMinute: minute(e.target.value) })
              }
            />
          </Field>
          <Field label="Until">
            <input
              className={fieldClass}
              type="time"
              required
              value={time(row.endMinute)}
              onChange={(e) =>
                update(index, {
                  endMinute:
                    e.target.value === "00:00" ? 1440 : minute(e.target.value),
                })
              }
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
            aria-label={`Remove shift ${index + 1}`}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        type="button"
        disabled={busy || rows.length >= 28}
        onClick={() =>
          setRows([...rows, { weekday: 1, startMinute: 540, endMinute: 1020 }])
        }
      >
        Add working shift
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <Button disabled={busy}>
          {busy ? "Saving…" : "Save schedule and skills"}
        </Button>
      </div>
    </form>
  )
}

export function CommitmentForm({
  employeeId,
  onSaved,
}: {
  employeeId: string
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget,
      data = new FormData(form)
    setBusy(true)
    setError("")
    try {
      await addCommitment(employeeId, {
        title: String(data.get("title")),
        kind: String(data.get("kind")),
        startsAt: manilaISO(data.get("startsAt")),
        endsAt: manilaISO(data.get("endsAt")),
      })
      form.reset()
      onSaved()
      sileo.success({ title: "Unavailability recorded" })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not record unavailability",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border pt-5">
      <h3 className="font-semibold">Record a commitment or absence</h3>
      <p className="text-sm text-muted-foreground">
        Manager-entered records reduce capacity immediately. Record leave only
        after approval through your organization’s leave process.
      </p>
      <Field label="Type">
        <select className={fieldClass} name="kind">
          <option value="APPOINTMENT">Appointment / consultation</option>
          <option value="LEAVE">Approved leave / absence</option>
          <option value="UNAVAILABLE">Temporary unavailability</option>
        </select>
      </Field>
      <Field label="Description">
        <input className={fieldClass} name="title" maxLength={160} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts (Manila)">
          <input
            className={fieldClass}
            type="datetime-local"
            name="startsAt"
            required
          />
        </Field>
        <Field label="Ends (Manila)">
          <input
            className={fieldClass}
            type="datetime-local"
            name="endsAt"
            required
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Saving…" : "Record commitment"}</Button>
    </form>
  )
}
