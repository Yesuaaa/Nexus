"use client"

import { Form } from "@/components/ui/form"

import { WorkloadWeekInput } from "../components/workload-week-input"
import { CapacityFields } from "../components/capacity-fields"
import { WorkloadRowActions } from "../components/workload-row-actions"
import { WorkloadDetailsDrawer } from "../components/workload-details-drawer"
import {
  panelAssignButton,
  panelDangerButton,
  panelField,
  panelInput,
  panelSecondaryButton,
  panelSelectTrigger,
} from "@/components/ui/panel-styles"
import { WorkloadKpiCards } from "../components/workload-kpi-cards"
import {
  getWorkloadMetrics as metrics,
  type WorkloadStaff as Staff,
  type WorkloadAssignment as Assignment,
} from "../model/workload"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { TableSkeletonBody } from "@/components/ui/data-table-skeleton"
import { useLocalTable } from "@/components/ui/use-local-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { useMemo, useState } from "react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { Pill, type PillTone } from "@/components/ui/pill"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

const availabilityOptions = [
  "all",
  "Available",
  "Near capacity",
  "Overloaded",
  "Needs setup",
  "Unavailable",
  "On leave",
  "Inactive",
].map((value) => ({
  value,
  label: value === "all" ? "All Availability" : value,
}))

const availabilityTones: Record<string, PillTone> = {
  Available: "success",
  "Near capacity": "warning",
  "On leave": "warning",
  Overloaded: "danger",
  Inactive: "danger",
}

type Project = {
  id: string
  name: string
  status: string
  requestId: string | null
  request: { referenceNumber: string | null; service: { name: string } } | null
  staff: {
    id: string
    employeeId: string
    employeeName: string
    weeklyHours: number | null
    allocationStart: string | null
    allocationEnd: string | null
    eligible: boolean
  }[]
}
type Data = {
  department: { id: string; name: string }
  week: string
  staff: Staff[]
  projects: Project[]
}
function projectLabel(project: Project) {
  return `${project.request?.service.name ?? project.name} · ${project.request?.referenceNumber ?? project.requestId ?? project.id}`
}
function monday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
export function WorkloadPage() {
  const account = usePortalAccount()
  const [week, setWeek] = useState(monday)
  const workload = useAsyncResource(
    (signal) => apiRequest<Data>(`/api/workload?week=${week}`, { signal }),
    [week],
    { fallbackError: "Unable to load workload" },
  )
  const data = workload.data ?? null
  const error = workload.error
  // Reloads after a save keep the current rows instead of showing skeletons.
  const loading = workload.loading && !data
  const [search, setSearch] = useState("")
  const [team, setTeam] = useState("all")
  const [availability, setAvailability] = useState("all")
  const [selected, setSelected] = useState("")
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [capacityTarget, setCapacityTarget] = useState<Staff | null>(null)
  const [allocation, setAllocation] = useState<{
    projectId: string
    employeeId: string
    previousEmployeeId?: string
    weeklyHours?: number | null
    allocationEnd?: string | null
  } | null>(null)
  const [projection, setProjection] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")
  const [assignmentPicker, setAssignmentPicker] = useState<{
    staff: Staff
    action: "reassign" | "unassign"
  } | null>(null)
  const [confirmation, setConfirmation] = useState<Assignment | null>(null)
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true)
    setActionError("")
    try {
      await apiRequest(`/api/workload${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      workload.retry()
      setCapacityTarget(null)
      setAllocation(null)
      setConfirmation(null)
    } catch (e) {
      setActionError(errorMessage(e, "Unable to save"))
    } finally {
      setBusy(false)
    }
  }
  const staff = useMemo(() => data?.staff ?? [], [data])
  const current = staff.find((s) => s.id === selected)
  const teams = [
    ...new Map(
      staff.filter((s) => s.team).map((s) => [s.team!.id, s.team!]),
    ).values(),
  ]
  const filtered = useMemo(
    () =>
      staff.filter(
        (s) =>
          (team === "all" || s.team?.id === team) &&
          (availability === "all" ||
            metrics(s).availability === availability) &&
          `${s.fullName} ${s.position ?? ""} ${s.profileSpecialties.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [staff, team, availability, search],
  )
  const selectedProject = data?.projects.find(
    (project) => project.id === allocation?.projectId,
  )
  const staffingAttention = (data?.projects ?? []).filter(
    (project) =>
      project.staff.length === 0 ||
      project.staff.some((assignment) => assignment.eligible === false),
  )
  const openAssignment = (
    projectId = "",
    employeeId = "",
    previousEmployeeId?: string,
    allocationDefaults?: {
      weeklyHours: number | null
      allocationEnd: string | null
    },
  ) => {
    setActionError("")
    setProjection("")
    setAllocation({
      projectId,
      employeeId,
      previousEmployeeId,
      ...allocationDefaults,
    })
  }
  const removeProjectAllocation = (
    project: Project,
    assignment: Project["staff"][number],
  ) => {
    setRequestsOpen(false)
    setActionError("")
    setConfirmation({
      id: assignment.id,
      projectId: project.id,
      employeeId: assignment.employeeId,
      weeklyHours: assignment.weeklyHours,
      allocationStart: assignment.allocationStart,
      allocationEnd: assignment.allocationEnd,
      project: {
        id: project.id,
        name: project.request?.service.name ?? project.name,
        status: project.status,
      },
    })
  }
  function selectAssignment(person: Staff, action: "reassign" | "unassign") {
    if (person.assignments.length === 1)
      applyAssignmentAction(person, person.assignments[0], action)
    else if (person.assignments.length)
      setAssignmentPicker({ staff: person, action })
  }
  function applyAssignmentAction(
    person: Staff,
    assignment: Assignment,
    action: "reassign" | "unassign",
  ) {
    setAssignmentPicker(null)
    setActionError("")
    if (action === "reassign")
      openAssignment(assignment.projectId, person.id, person.id)
    else setConfirmation(assignment)
  }
  const table = useLocalTable(filtered, {
    view: [search, team, availability, week],
    loading,
  })
  const teamOptions = [
    { value: "all", label: "All Teams" },
    ...teams.map((item) => ({ value: item.id, label: item.name })),
  ]
  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <PageHeader
        mobileActions="stack"
        title="Staff Workload"
        description={
          <>
            Monitor capacity, assignments, and availability
            {data
              ? ` for ${data.department.name}`
              : account.headOf
                ? ` for ${account.headOf.name}`
                : ""}
            .
          </>
        }
        actions={
          <WorkloadWeekInput
            week={week}
            onChange={(value) => {
              // Show skeletons for the new week rather than the old rows.
              workload.setData(() => undefined)
              setSelected("")
              setWeek(value)
            }}
          />
        }
      />
      <div className="mt-[18px] max-[560px]:mt-[14px]">
        <WorkloadKpiCards
          staff={staff}
          pending={loading}
          unavailable={!!error && !data}
        />
      </div>
      <section className="mt-4 min-w-0" aria-label="Staff workload directory">
        <div className={`${filterBarClass} pb-4`}>
          <SearchField
            label="Search staff"
            placeholder="Search staff, role, or skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FilterSelect
            label="Filter by team"
            value={team}
            options={teamOptions}
            triggerClassName="w-[170px]"
            onChange={setTeam}
          />
          <FilterSelect
            label="Filter by availability"
            value={availability}
            options={availabilityOptions}
            triggerClassName="w-[170px]"
            onChange={setAvailability}
          />
          <Button
            type="button"
            className={`${panelAssignButton} ml-auto max-[560px]:ml-0`}
            disabled={!data || loading}
            onClick={() => setRequestsOpen(true)}
          >
            Assign staff
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-semibold tabular-nums text-[#203f8c]">
              {staffingAttention.length}
            </span>
          </Button>
        </div>
        <div
          className="overflow-x-auto rounded-lg border border-[#e8ebef]"
          tabIndex={0}
          role="region"
          aria-label="Staff workload table"
        >
          <table
            className="w-full min-w-[850px] text-left text-xs"
            aria-busy={loading}
          >
            <thead className="bg-[#e8eef2]">
              <tr>
                {[
                  "Staff",
                  "Skills",
                  "Assigned / Capacity",
                  "Utilization",
                  "Availability",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {loading && !data ? (
              <TableSkeletonBody label="staff workload" columns={6} />
            ) : (
              <AnimatedTableBody
                items={table.visible}
                viewKey={table.viewKey}
                quickKey={search}
                columns={6}
                rowClassName="border-t border-[#eceef1]"
                onRowsSettled={table.onRowsSettled}
                emptyContent={
                  <>
                    {" "}
                    {error ? (
                      <div role="alert">
                        {error}
                        <Button variant="outline" onClick={workload.retry}>
                          Retry
                        </Button>
                      </div>
                    ) : staff.length ? (
                      "No staff match these filters."
                    ) : (
                      "No employees in this department yet."
                    )}
                  </>
                }
                renderRow={(s) => {
                  const m = metrics(s)
                  return (
                    <>
                      {" "}
                      <td className="px-4 py-3">
                        <span className="font-medium">{s.fullName}</span>
                        <div className="mt-1 text-[11px] text-[#738096]">
                          {s.position ?? "No position"}
                          {s.team ? ` · ${s.team.name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.profileSpecialties.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {m.unknown ? "Unrecorded" : m.assigned} /{" "}
                        {m.capacity ?? "—"} hrs
                      </td>
                      <td className="px-4 py-3">
                        {m.unknown || m.capacity === null
                          ? "—"
                          : m.capacity === 0
                            ? m.assigned
                              ? "Over capacity"
                              : "—"
                            : `${m.utilization}%`}
                        {m.utilization !== null && !m.unknown && (
                          <div className="mt-1 w-24">
                            <ProgressMeter
                              value={Math.min(m.utilization, 100)}
                              max={100}
                              label={`${s.fullName} utilization`}
                              colorClass={
                                m.utilization > 100
                                  ? "bg-red-500"
                                  : m.utilization >= 90
                                    ? "bg-amber-500"
                                    : "bg-[#244993]"
                              }
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          tone={availabilityTones[m.availability] ?? "neutral"}
                        >
                          {m.availability}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <WorkloadRowActions
                          staffId={s.id}
                          name={s.fullName}
                          canAssign={
                            s.status === "ACTIVE" && !!data?.projects.length
                          }
                          hasAssignments={!!s.assignments.length}
                          onView={() => setSelected(s.id)}
                          onEdit={() => {
                            setActionError("")
                            setCapacityTarget(s)
                          }}
                          onAssign={() => openAssignment("", s.id)}
                          onReassign={() => selectAssignment(s, "reassign")}
                          onUnassign={() => selectAssignment(s, "unassign")}
                        />
                      </td>
                    </>
                  )
                }}
              />
            )}
          </table>
        </div>
        {!loading && !error && table.footer.total > 0 && (
          <TablePaginationFooter
            {...table.footer}
            label="Staff workload pages"
            onPageChange={table.setPage}
          />
        )}
      </section>
      {current && (
        <WorkloadDetailsDrawer
          key={current.id}
          staff={current}
          week={week}
          onClose={() => setSelected("")}
          onEditCapacity={() => {
            setActionError("")
            setCapacityTarget(current)
          }}
          onEditAllocation={(assignment) =>
            openAssignment(assignment.projectId, current.id, current.id)
          }
          onUnassign={(assignment) => {
            setActionError("")
            setConfirmation(assignment)
          }}
        />
      )}
      <Modal open={requestsOpen} onClose={() => setRequestsOpen(false)}>
        <ModalHeader
          title="Staffing attention"
          description="Assign staff to projects or resolve allocations that no longer match the active department roster."
          closeLabel="Close form"
        />
        <ModalBody className="gap-3">
          {staffingAttention.map((project) => (
            <div
              key={project.id}
              className="grid gap-3 rounded-lg border border-[#e8ebef] p-4"
            >
              <div className="flex items-start justify-between gap-3 max-[420px]:flex-col">
                <div className="min-w-0">
                  <p className="m-0 break-words text-xs font-semibold">
                    {project.request?.service.name ?? project.name}
                  </p>
                  <p className="mt-1 mb-0 break-all text-[11px] text-[#738096]">
                    {project.request?.referenceNumber ??
                      project.requestId ??
                      project.id}
                  </p>
                </div>
                {project.staff.length === 0 && (
                  <Button
                    className={panelAssignButton}
                    onClick={() => {
                      setRequestsOpen(false)
                      openAssignment(project.id)
                    }}
                  >
                    Assign staff
                  </Button>
                )}
              </div>
              {project.staff
                .filter((assignment) => assignment.eligible === false)
                .map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceef1] pt-3"
                  >
                    <div className="min-w-0">
                      <p className="m-0 break-words text-xs font-medium">
                        {assignment.employeeName}
                      </p>
                      <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                        {assignment.weeklyHours ?? "Unrecorded"} hrs/week · No
                        longer eligible for new assignments
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        className={panelSecondaryButton}
                        onClick={() => {
                          setRequestsOpen(false)
                          openAssignment(
                            project.id,
                            "",
                            assignment.employeeId,
                            {
                              weeklyHours: assignment.weeklyHours,
                              allocationEnd:
                                assignment.allocationEnd &&
                                assignment.allocationEnd.slice(0, 10) >= week
                                  ? assignment.allocationEnd.slice(0, 10)
                                  : week,
                            },
                          )
                        }}
                      >
                        Reassign
                      </Button>
                      <Button
                        variant="outline"
                        className={panelDangerButton}
                        onClick={() =>
                          removeProjectAllocation(project, assignment)
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ))}
          {!staffingAttention.length && (
            <p className="m-0 py-6 text-center text-xs text-[#738096]">
              No projects need staffing attention.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            className={panelSecondaryButton}
            onClick={() => setRequestsOpen(false)}
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        open={!!capacityTarget}
        onClose={() => setCapacityTarget(null)}
        busy={busy}
      >
        <ModalHeader
          title="Edit weekly capacity"
          description={`${capacityTarget?.fullName ?? ""} · Week of ${week}. Include leave and holidays in time off.`}
          closeLabel="Close form"
          closeDisabled={busy}
        />
        {capacityTarget && (
          <Form
            key={`${capacityTarget.id}:${week}`}
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              void mutate("/capacity", "PUT", {
                employeeId: capacityTarget.id,
                week,
                scheduledHours: Number(f.get("scheduledHours")),
                timeOffHours: Number(f.get("timeOffHours")),
              })
            }}
          >
            <ModalBody className="sm:grid-cols-2">
              <CapacityFields
                scheduledHours={capacityTarget.capacity?.scheduledHours ?? null}
                timeOffHours={capacityTarget.capacity?.timeOffHours ?? 0}
                assignedHours={metrics(capacityTarget).assigned}
                hasUnrecordedHours={metrics(capacityTarget).unknown}
              />
              {actionError && (
                <Alert className="sm:col-span-2">{actionError}</Alert>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                type="button"
                className={panelSecondaryButton}
                disabled={busy}
                onClick={() => setCapacityTarget(null)}
              >
                Cancel
              </Button>
              <Button
                className={panelAssignButton}
                disabled={busy}
                type="submit"
              >
                {busy ? "Saving…" : "Save capacity"}
              </Button>
            </ModalFooter>
          </Form>
        )}
      </Modal>
      <Modal
        open={!!allocation}
        onClose={() => setAllocation(null)}
        busy={busy}
      >
        <ModalHeader
          title={
            allocation?.previousEmployeeId
              ? "Reassign / edit allocation"
              : "Assign staff"
          }
          description={`Allocate weekly hours to an authorized project, starting the week of ${week}.`}
          closeLabel="Close form"
          closeDisabled={busy}
        />
        {allocation && (
          <Form
            onChange={(event) => {
              const form = new FormData(event.currentTarget)
              const target = staff.find(
                (person) => person.id === form.get("employeeId"),
              )
              if (!target) {
                setProjection("")
                return
              }
              const capacity = metrics(target).capacity
              const other = target.assignments.filter(
                (a) => a.projectId !== form.get("projectId"),
              )
              const assignedHours =
                other.reduce((total, a) => total + (a.weeklyHours ?? 0), 0) +
                Number(form.get("weeklyHours") ?? 0)
              setProjection(
                capacity === null || other.some((a) => a.weeklyHours === null)
                  ? "Set capacity and record all assignment hours to calculate projected utilization."
                  : capacity === 0
                    ? "No available capacity for this week."
                    : "Projected utilization: " +
                      assignedHours +
                      " / " +
                      capacity +
                      " hrs (" +
                      Math.round((assignedHours / capacity) * 100) +
                      "%) · " +
                      (assignedHours > capacity
                        ? assignedHours - capacity + " hrs over capacity"
                        : capacity - assignedHours + " hrs remaining"),
              )
            }}
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              void mutate("/assignment", "PUT", {
                ...allocation,
                week,
                employeeId: f.get("employeeId"),
                projectId: f.get("projectId"),
                weeklyHours: Number(f.get("weeklyHours")),
                endDate: f.get("endDate"),
              })
            }}
          >
            <ModalBody className="sm:grid-cols-2">
              <div
                className={cn(panelField, "sm:col-span-2")}
                data-validation-field
              >
                <span>Project</span>
                <Select
                  name="projectId"
                  required
                  defaultValue={allocation.projectId}
                  onValueChange={(projectId) =>
                    setAllocation({ ...allocation, projectId })
                  }
                  disabled={busy || !!allocation.previousEmployeeId}
                >
                  <SelectTrigger
                    aria-label="Project"
                    className={cn(
                      panelSelectTrigger,
                      "h-auto min-h-[54px] py-2 [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:text-left",
                    )}
                  >
                    <SelectValue placeholder="Select project">
                      {selectedProject ? (
                        <span className="block min-w-0">
                          <span className="block break-words font-medium">
                            {selectedProject.request?.service.name ??
                              selectedProject.name}
                          </span>
                          <span className="mt-0.5 block break-all text-[11px] text-[#738096]">
                            {selectedProject.request?.referenceNumber ??
                              selectedProject.requestId ??
                              selectedProject.id}
                          </span>
                        </span>
                      ) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {data?.projects.map((project) => (
                      <SelectItem
                        key={project.id}
                        value={project.id}
                        textValue={projectLabel(project)}
                        className="[&>span:last-child]:whitespace-normal"
                      >
                        <span className="block font-medium">
                          {project.request?.service.name ?? project.name}
                        </span>
                        <span className="mt-0.5 block break-all text-[11px] text-[#738096]">
                          {project.request?.referenceNumber ??
                            project.requestId ??
                            project.id}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allocation.previousEmployeeId && (
                  <input
                    type="hidden"
                    name="projectId"
                    value={allocation.projectId}
                  />
                )}
              </div>
              <div
                className={cn(panelField, "sm:col-span-2")}
                data-validation-field
              >
                <span>Staff</span>
                <Select
                  name="employeeId"
                  required
                  defaultValue={allocation.employeeId}
                  onValueChange={(employeeId) =>
                    setAllocation({ ...allocation, employeeId })
                  }
                  disabled={busy}
                >
                  <SelectTrigger
                    aria-label="Staff"
                    className={panelSelectTrigger}
                  >
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff
                      .filter((person) => person.status === "ACTIVE")
                      .map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.fullName} · {metrics(person).availability}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <label className={panelField}>
                Hours per week
                <Input
                  className={panelInput}
                  name="weeklyHours"
                  type="number"
                  min="0.25"
                  max="168"
                  step="0.25"
                  required
                  defaultValue={
                    staff
                      .find((s) => s.id === allocation.employeeId)
                      ?.assignments.find(
                        (a) => a.projectId === allocation.projectId,
                      )?.weeklyHours ??
                    allocation.weeklyHours ??
                    ""
                  }
                />
              </label>
              <label className={panelField}>
                End date
                <DateInput
                  className={panelInput}
                  name="endDate"
                  min={week}
                  required
                  defaultValue={
                    staff
                      .find((s) => s.id === allocation.employeeId)
                      ?.assignments.find(
                        (a) => a.projectId === allocation.projectId,
                      )
                      ?.allocationEnd?.slice(0, 10) ??
                    allocation.allocationEnd?.slice(0, 10) ??
                    week
                  }
                />
              </label>
              <p className="sm:col-span-2 text-xs text-[#738096]">
                {projection ||
                  "Review the employee’s recorded capacity before confirming."}{" "}
                Over-capacity allocations remain visible for the manager to
                resolve.
              </p>
              {actionError && (
                <Alert className="sm:col-span-2">{actionError}</Alert>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                type="button"
                className={panelSecondaryButton}
                disabled={busy}
                onClick={() => setAllocation(null)}
              >
                Cancel
              </Button>
              <Button
                className={panelAssignButton}
                type="submit"
                disabled={busy}
              >
                {busy ? "Saving…" : "Confirm assignment"}
              </Button>
            </ModalFooter>
          </Form>
        )}
      </Modal>
      <Modal
        open={!!assignmentPicker}
        onClose={() => setAssignmentPicker(null)}
      >
        <ModalHeader
          title={
            assignmentPicker?.action === "reassign"
              ? "Choose assignment to reassign"
              : "Choose assignment to unassign"
          }
          description={
            "Select a project assigned to " +
            (assignmentPicker?.staff.fullName ?? "") +
            " for the week of " +
            week +
            "."
          }
          closeLabel="Close form"
        />
        <ModalBody className="gap-2">
          {assignmentPicker?.staff.assignments.map((assignment) => (
            <Button
              key={assignment.id}
              type="button"
              variant="outline"
              className="h-auto justify-between gap-3 py-3 text-left text-xs"
              onClick={() =>
                applyAssignmentAction(
                  assignmentPicker.staff,
                  assignment,
                  assignmentPicker.action,
                )
              }
            >
              <span>{assignment.project.name}</span>
              <span className="text-[#738096]">
                {assignment.weeklyHours ?? "Unrecorded"} hrs/week
              </span>
            </Button>
          ))}
        </ModalBody>
      </Modal>
      {confirmation && (
        <ConfirmationDialog
          title="Unassign staff?"
          subject={confirmation.project.name}
          description="Remove this employee from the project. This also removes their project access."
          confirmLabel="Unassign staff"
          pendingLabel="Unassigning…"
          pending={busy}
          error={actionError}
          onClose={() => {
            if (!busy) setConfirmation(null)
          }}
          onConfirm={() =>
            void mutate(`/assignment/${confirmation.id}`, "DELETE")
          }
        />
      )}
    </main>
  )
}
