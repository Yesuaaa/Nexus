"use client"

import { useState } from "react"
import { sileo } from "sileo"
import { WorkloadButton as Button } from "./workload-button"
import { WorkloadSelect } from "./workload-select"
import {
  decideStaffing,
  closeAssignment,
  type EmployeeWorkload,
  type Staffing,
} from "../api/workload-api"
import {
  Field,
  fieldClass,
  displayDate,
  labelText,
  Status,
} from "./workload-ui"

function StaffingCard({
  request,
  departmentId,
  employees,
  onChanged,
}: {
  request: Staffing
  departmentId: string
  employees: EmployeeWorkload[]
  onChanged: () => void
}) {
  const [employeeId, setEmployeeId] = useState("")
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const incoming = request.recipientDepartmentId === departmentId
  async function decide(decision: string) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await decideStaffing(request.id, decision, employeeId || undefined)
      onChanged()
      sileo.success({ title: `Staffing request ${decision.toLowerCase()}` })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update staffing request",
      )
    } finally {
      setBusy(false)
    }
  }
  async function cancelAssignment() {
    if (!request.assignment || busy) return
    setBusy(true)
    setError("")
    try {
      await closeAssignment(request.assignment.id, "CANCELLED")
      onChanged()
      sileo.success({ title: "Assignment cancelled" })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not cancel assignment",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="space-y-3 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {incoming
              ? `Incoming from ${request.ownerDepartment.name}`
              : `Sent to ${request.recipientDepartment.name}`}
          </p>
          <h3 className="font-semibold">{request.title}</h3>
        </div>
        <Status value={request.status} />
      </div>
      <p className="text-sm">
        {displayDate(request.startsAt)} – {displayDate(request.endsAt)}
      </p>
      <p className="text-sm text-muted-foreground">
        {request.estimatedHours}h · {labelText(request.priority)} priority
        {request.deadline ? ` · Due ${displayDate(request.deadline)}` : ""}
      </p>
      <p className="text-sm">
        Required skills:{" "}
        {request.requiredSkills.join(", ") || "No specific skills recorded"}
      </p>
      {request.assignment && (
        <p className="text-sm">
          Approved personnel: {request.assignment.employee.fullName} ·{" "}
          {labelText(request.assignment.status)}
        </p>
      )}
      {request.status === "PENDING" &&
        (incoming ? (
          <>
            <Field label="Employee to approve">
              <select
                className={fieldClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select from your department</option>
                {employees.map((e) => (
                  <option
                    key={e.id}
                    value={e.id}
                    disabled={
                      e.employeeStatus !== "ACTIVE" ||
                      !e.scheduleConfigured ||
                      !request.requiredSkills.every((skill) =>
                        e.skills.some(
                          (s) => s.toLowerCase() === skill.toLowerCase(),
                        ),
                      )
                    }
                  >
                    {e.fullName} · {labelText(e.status)} · {e.remainingHours}h
                    free in view
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy || !employeeId}
                onClick={() => void decide("APPROVED")}
              >
                Approve and assign
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void decide("REJECTED")}
              >
                Reject
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Approval checks the requested block against this employee’s
              current schedule, skills and assignments.
            </p>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void decide("CANCELLED")}
          >
            Withdraw request
          </Button>
        ))}
      {!incoming && request.assignment?.status === "CONFIRMED" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void cancelAssignment()}
        >
          Cancel approved assignment
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </article>
  )
}
export function StaffingPanel({
  requests,
  departmentId,
  employees,
  onChanged,
}: {
  requests: Staffing[]
  departmentId: string
  employees: EmployeeWorkload[]
  onChanged: () => void
}) {
  const [filter, setFilter] = useState("PENDING")
  const rows = requests.filter((r) => !filter || r.status === filter)
  return (
    <section className="space-y-4" aria-label="Cross-department staffing">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-[650]">Cross-department staffing</h2>
          <p className="mt-1 text-xs text-[#738096]">
            The receiving manager approves personnel; the requesting department
            retains responsibility for the work.
          </p>
        </div>
        <WorkloadSelect
          label="Request status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "", label: "All statuses" },
            ...["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
              (value) => ({ value, label: labelText(value) }),
            ),
          ]}
        />
      </div>
      {!rows.length ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No {filter ? filter.toLowerCase() : ""} staffing requests.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((request) => (
            <StaffingCard
              key={request.id}
              request={request}
              employees={employees}
              departmentId={departmentId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Showing the latest 200 requests across incoming and sent requests.
        Pending requests are departmental demand and have no employee assigned.
      </p>
    </section>
  )
}
