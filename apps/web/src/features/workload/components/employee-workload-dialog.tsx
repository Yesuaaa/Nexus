"use client"

import { useEffect, useState } from "react"
import { sileo } from "sileo"
import { WorkloadButton as Button } from "./workload-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  employeeWorkload,
  closeAssignment,
  removeCommitment,
  type Assignment,
  type WorkloadDetail,
  type Range,
} from "../api/workload-api"
import { ConfigurationForm, CommitmentForm } from "./availability-forms"
import { displayDate, labelText, Status, Utilization } from "./workload-ui"

export function EmployeeWorkloadDialog({
  employeeId,
  range,
  onClose,
  onChanged,
  onAssign,
}: {
  employeeId: string
  range: Range
  onClose: () => void
  onChanged: () => void
  onAssign: (id: string) => void
}) {
  const [employee, setEmployee] = useState<WorkloadDetail | null>(null)
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState("calendar")
  const [resolved, setResolved] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const key = JSON.stringify({ employeeId, range, revision })
  useEffect(() => {
    let active = true
    employeeWorkload(employeeId, range)
      .then((data) => {
        if (active) {
          setEmployee(data)
          setError("")
          setResolved(key)
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load employee workload",
          )
          setResolved(key)
        }
      })
    return () => {
      active = false
    }
  }, [employeeId, range, revision, key])
  function changed() {
    setRevision((v) => v + 1)
    onChanged()
  }
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await action()
      changed()
      sileo.success({ title: "Workload updated" })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update workload",
      )
    } finally {
      setBusy(false)
    }
  }
  function assignments(rows: Assignment[]) {
    if (!rows.length)
      return (
        <p className="py-6 text-sm text-muted-foreground">
          No assignments in this period.
        </p>
      )
    return (
      <div className="divide-y divide-border">
        {rows.map((a) => (
          <article key={a.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{a.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {a.task
                    ? `${a.task.project.name} / ${a.task.title}`
                    : (a.project?.name ?? a.serviceRequest?.title)}{" "}
                  · Responsible department: {a.ownerDepartment.name}
                </p>
              </div>
              <Status value={a.status} />
            </div>
            <p className="text-sm">
              {displayDate(a.startsAt)} – {displayDate(a.endsAt)} ·{" "}
              {a.estimatedHours}h · {labelText(a.priority)} priority
            </p>
            <p className="text-xs text-muted-foreground">
              {a.deadline
                ? `Deadline: ${displayDate(a.deadline)}`
                : "No deadline"}{" "}
              ·{" "}
              {new Date(a.startsAt) > new Date()
                ? "Upcoming"
                : new Date(a.endsAt) <= new Date()
                  ? "Scheduled block ended"
                  : "Current"}
            </p>
            {employee?.conflicts.includes(a.id) && (
              <p className="text-sm font-medium text-red-700">
                Scheduling conflict — review this assignment.
              </p>
            )}
            {a.status === "CONFIRMED" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(() => closeAssignment(a.id, "COMPLETED"))
                  }
                >
                  Mark complete
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(() => closeAssignment(a.id, "CANCELLED"))
                  }
                >
                  Cancel assignment
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    )
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="max-h-[calc(100dvh-28px)] w-[calc(100vw-28px)] overflow-y-auto rounded-[13px] border-[#dedede] p-5 shadow-[0_22px_75px_rgb(18_36_73_/_22%)] sm:max-w-5xl sm:p-6"
      >
        <header className="-mx-5 border-b border-[#eceef1] px-5 pb-5 pr-10 sm:-mx-6 sm:px-6 sm:pr-10">
          <DialogTitle className="text-[20px] leading-tight font-[650] tracking-[-0.03em]">
            {employee?.fullName ?? "Employee workload"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-[#738096]">
            {employee
              ? `${employee.position ?? "Position not recorded"} · ${employee.department?.name} · ${labelText(employee.employmentType)}`
              : "Loading employee details…"}{" "}
            · All times use Asia/Manila.
          </DialogDescription>
        </header>
        {error && (
          <div role="alert" className="text-sm text-red-700">
            {error}
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              Retry
            </Button>
          </div>
        )}
        {resolved !== key ? (
          <p role="status">Loading workload…</p>
        ) : (
          employee &&
          !error && (
            <>
              <div className="grid gap-4 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-4 sm:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Calculated availability
                  </p>
                  <Status value={employee.status} />
                  <p className="mt-2 text-sm">
                    {employee.remainingHours}h remaining
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Workload · {labelText(employee.workload)}
                  </p>
                  <Utilization metrics={employee} />
                </div>
                <div className="text-sm">
                  <p>
                    {employee.scheduledHours}h configured ·{" "}
                    {employee.blockedHours}h blocked
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Skills: {employee.skills.join(", ") || "None recorded"}
                  </p>
                </div>
              </div>
              {!employee.scheduleConfigured && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Configure a working schedule before assigning work.
                </p>
              )}
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="flex h-auto flex-wrap justify-start [&>button]:text-xs">
                  <TabsTrigger value="calendar">
                    Availability calendar
                  </TabsTrigger>
                  <TabsTrigger value="assignments">
                    Assignments ({employee.assignmentCount})
                  </TabsTrigger>
                  <TabsTrigger value="configuration">
                    Configure availability
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="calendar" className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Automatically calculated from the manual working schedule,
                    recorded commitments and confirmed assignments. Pending
                    staffing requests do not reserve capacity.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                    {employee.calendar.map((day) => (
                      <article
                        key={day.date}
                        className="min-h-36 rounded-md border border-border p-2.5"
                      >
                        <h4 className="mb-2 text-sm font-semibold">
                          {new Intl.DateTimeFormat("en-PH", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "Asia/Manila",
                          }).format(new Date(`${day.date}T00:00:00+08:00`))}
                        </h4>
                        <p className="text-xs">
                          {day.remainingHours}h free / {day.capacityHours}h
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {day.allocatedHours}h allocated
                        </p>
                        {day.conflicts.length > 0 && (
                          <p className="mt-1 text-xs text-red-700">
                            Scheduling conflict
                          </p>
                        )}
                        {day.capacityHours === 0 && (
                          <p className="mt-1 text-xs text-red-700">
                            Unavailable
                          </p>
                        )}
                        {day.assignments.map((id) => (
                          <p
                            key={id}
                            className="mt-2 rounded bg-blue-50 px-1.5 py-1 text-xs text-blue-900"
                          >
                            {
                              employee.assignments.find((a) => a.id === id)
                                ?.title
                            }
                          </p>
                        ))}
                        {employee.commitments
                          .filter(
                            (c) =>
                              new Date(c.startsAt) <
                                new Date(
                                  +new Date(`${day.date}T00:00:00+08:00`) +
                                    86_400_000,
                                ) &&
                              new Date(c.endsAt) >
                                new Date(`${day.date}T00:00:00+08:00`),
                          )
                          .map((c) => (
                            <p
                              key={c.id}
                              className="mt-2 rounded bg-amber-50 px-1.5 py-1 text-xs text-amber-900"
                            >
                              {labelText(c.kind)}: {c.title}
                            </p>
                          ))}
                      </article>
                    ))}
                  </div>
                  <h3 className="font-semibold">Recorded commitments</h3>
                  {employee.commitments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No appointments, leave or temporary absences in this
                      period.
                    </p>
                  )}
                  {employee.commitments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {c.title} · {labelText(c.kind)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {displayDate(c.startsAt)} – {displayDate(c.endsAt)} ·{" "}
                          {c.source === "MANUAL"
                            ? "Manually entered by manager"
                            : `Imported: ${labelText(c.source)}`}
                        </p>
                      </div>
                      {c.source === "MANUAL" && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void mutate(() =>
                              removeCommitment(employee.id, c.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="assignments">
                  <div className="mt-4 flex items-center justify-between">
                    <h3 className="font-semibold">Work breakdown</h3>
                    <Button
                      disabled={
                        employee.employeeStatus !== "ACTIVE" ||
                        !employee.scheduleConfigured
                      }
                      onClick={() => onAssign(employee.id)}
                    >
                      Assign work
                    </Button>
                  </div>
                  {assignments(employee.assignments)}
                  {employee.upcomingBeyondPeriod.length > 0 && (
                    <>
                      <h3 className="mt-4 font-semibold">
                        Upcoming after this period (up to 50)
                      </h3>
                      {assignments(employee.upcomingBeyondPeriod)}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="configuration" className="space-y-6 pt-3">
                  <ConfigurationForm employee={employee} onSaved={changed} />
                  <CommitmentForm employeeId={employee.id} onSaved={changed} />
                </TabsContent>
              </Tabs>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
