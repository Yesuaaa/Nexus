"use client"

import { Form } from "@/components/ui/form"

import { WorkloadWeekInput } from "../components/workload-week-input"
import { CapacityFields } from "../components/capacity-fields"
import { WorkloadRowActions } from "../components/workload-row-actions"
import { WorkloadDetailsDrawer } from "../components/workload-details-drawer"
import { BriefcaseBusiness, Trash2 } from "lucide-react"
import {
  panelAssignButton,
  panelDangerButton,
  panelField,
  panelInput,
  panelSecondaryButton,
  panelSelectTrigger,
} from "@/features/departments/styles/member-panel-styles"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { WorkloadDialog } from "../components/workload-dialog"
import { WorkloadKpiCards } from "../components/workload-kpi-cards"
import {
  getWorkloadMetrics as metrics,
  type WorkloadStaff as Staff,
  type WorkloadAssignment as Assignment,
} from "../model/workload"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { useTableFooter } from "@/components/ui/use-table-search"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { useEffect, useMemo, useState } from "react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { contentClass } from "@/components/layout/styles"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
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
import { Dialog } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

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
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState("")
  const [team, setTeam] = useState("all")
  const [availability, setAvailability] = useState("all")
  const [selected, setSelected] = useState("")
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [page, setPage] = useState(1)
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
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Data>(`/api/workload?week=${week}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setData(result)
        setError("")
        setLoading(false)
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Unable to load workload")
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [week, revision])
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true)
    setActionError("")
    try {
      await apiRequest(`/api/workload${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      setRevision((v) => v + 1)
      setCapacityTarget(null)
      setAllocation(null)
      setConfirmation(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to save")
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const resolvedPage = Math.min(page, totalPages)
  const visible = useMemo(
    () => filtered.slice((resolvedPage - 1) * 10, resolvedPage * 10),
    [filtered, resolvedPage],
  )
  const tableResult = useMemo(
    () => ({
      page: resolvedPage,
      total: filtered.length,
      view: [search, team, availability, week],
    }),
    [resolvedPage, filtered.length, search, team, availability, week],
  )
  const { footer, onRowsSettled } = useTableFooter(tableResult, loading)
  const tableViewKey = JSON.stringify([
    search,
    team,
    availability,
    resolvedPage,
    week,
  ])
  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Staff Workload
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Monitor capacity, assignments, and availability
            {data
              ? ` for ${data.department.name}`
              : account.headOf
                ? ` for ${account.headOf.name}`
                : ""}
            .
          </p>
        </div>
        <WorkloadWeekInput
          week={week}
          onChange={(value) => {
            setLoading(true)
            setData(null)
            setSelected("")
            setPage(1)
            setWeek(value)
          }}
        />
      </header>
      <div className="mt-[18px] max-[560px]:mt-[14px]">
        <WorkloadKpiCards
          staff={staff}
          pending={loading && !data}
          unavailable={!!error && !data}
        />
      </div>
      <section className="mt-4 min-w-0" aria-label="Staff workload directory">
        <div className="flex flex-wrap gap-[10px] pb-4 max-[560px]:flex-col">
          <SearchField
            label="Search staff"
            placeholder="Search staff, role, or skills…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <Select
            value={team}
            onValueChange={(v) => {
              setTeam(v)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter by team"
              className="h-[34px] w-[170px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={availability}
            onValueChange={(v) => {
              setAvailability(v)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter by availability"
              className="h-[34px] w-[170px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "all",
                "Available",
                "Near capacity",
                "Overloaded",
                "Needs setup",
                "Unavailable",
                "On leave",
                "Inactive",
              ].map((v) => (
                <SelectItem key={v} value={v}>
                  {v === "all" ? "All Availability" : v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <table className="w-full min-w-[850px] text-left text-xs">
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
            <AnimatedTableBody
              items={visible}
              viewKey={tableViewKey}
              quickKey={search}
              columns={6}
              rowClassName="border-t border-[#eceef1]"
              onRowsSettled={onRowsSettled}
              emptyContent={
                <>
                  {" "}
                  {error ? (
                    <div role="alert">
                      {error}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setLoading(true)
                          setRevision((v) => v + 1)
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : loading ? (
                    <span role="status">Loading staff workload…</span>
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
                        <div className="mt-2 h-1 w-24 overflow-hidden rounded bg-[#dce2ea]">
                          <div
                            className={cn(
                              "h-full",
                              m.utilization > 100
                                ? "bg-red-500"
                                : m.utilization >= 90
                                  ? "bg-amber-500"
                                  : "bg-[#244993]",
                            )}
                            style={{
                              width: `${Math.min(m.utilization, 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        className={cn(
                          m.availability === "Available"
                            ? "bg-[#dcf5e5] text-[#19703a]"
                            : m.availability === "Near capacity" ||
                                m.availability === "On leave"
                              ? "bg-[#fff3df] text-[#805316]"
                              : m.availability === "Overloaded" ||
                                  m.availability === "Inactive"
                                ? "bg-[#fde4ea] text-[#b4234d]"
                                : "bg-[#eef0f3] text-[#596579]",
                        )}
                      >
                        {m.availability}
                      </Pill>
                    </td>
                    <td className="px-4 py-3">
                      <WorkloadRowActions
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
          </table>
        </div>
        {!loading && !error && footer.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a]">
            <span role="status">
              Showing {(footer.page - 1) * 10 + 1}–
              {Math.min(footer.page * 10, footer.total)} of {footer.total}
            </span>
            <NumberedPagination
              page={footer.page}
              totalPages={Math.max(1, Math.ceil(footer.total / 10))}
              disabled={loading || footer !== tableResult}
              label="Staff workload pages"
              onPageChange={setPage}
            />
          </footer>
        )}
      </section>
      {current && (
        <WorkloadDetailsDrawer
          name={current.fullName}
          description={`${current.position ?? "Staff"} · Week of ${week}`}
          onEdit={() => {
            setActionError("")
            setCapacityTarget(current)
          }}
          onClose={() => setSelected("")}
        >
          {" "}
          {current && (
            <div className="space-y-4 text-xs">
              <section className="grid gap-3" aria-label="Weekly capacity">
                <h3 className="m-0 text-xs font-semibold">Weekly capacity</h3>
                <dl className="m-0 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                  <div className="grid gap-1.5 py-3">
                    <dt className="text-[11px] font-medium text-[#738096]">
                      Scheduled hours
                    </dt>
                    <dd className="m-0 min-w-0 break-words text-xs font-medium text-foreground">
                      {current.capacity?.scheduledHours ?? "Not set"}
                    </dd>
                  </div>
                  <div className="grid gap-1.5 py-3">
                    <dt className="text-[11px] font-medium text-[#738096]">
                      Time off / holidays
                    </dt>
                    <dd className="m-0 min-w-0 break-words text-xs font-medium text-foreground">
                      {current.capacity?.timeOffHours ?? "Not set"}
                    </dd>
                  </div>
                  <div className="grid gap-1.5 py-3">
                    <dt className="text-[11px] font-medium text-[#738096]">
                      Assigned hours
                    </dt>
                    <dd className="m-0 min-w-0 break-words text-xs font-medium text-foreground">
                      {metrics(current).unknown
                        ? "Hours need recording"
                        : metrics(current).assigned}
                    </dd>
                  </div>
                  <div className="grid gap-1.5 py-3">
                    <dt className="text-[11px] font-medium text-[#738096]">
                      Remaining capacity
                    </dt>
                    <dd className="m-0 min-w-0 break-words text-xs font-medium text-foreground">
                      {metrics(current).capacity === null ||
                      metrics(current).unknown
                        ? "Not available"
                        : `${Math.max(0, metrics(current).capacity! - metrics(current).assigned)} hrs`}
                    </dd>
                  </div>
                </dl>
              </section>
              <section
                className="mt-6 grid gap-3"
                aria-label="Current assignments"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-xs font-semibold">
                    Current assignments
                  </h3>
                  <span className="text-[11px] text-[#738096]">
                    {current.assignments.length}{" "}
                    {current.assignments.length === 1
                      ? "Assignment"
                      : "Assignments"}
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
                  {current.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-4 border-b border-[#eceef1] px-4 py-4 last:border-b-0 max-[400px]:flex-wrap"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="grid size-8 flex-none place-items-center rounded-full bg-[#edf0f4] text-[#738096]">
                          <BriefcaseBusiness
                            size={15}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 break-words text-xs font-medium text-foreground">
                            {a.project.name}
                          </p>
                          <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                            {a.weeklyHours === null
                              ? "Hours not recorded"
                              : a.weeklyHours + " hrs/week"}
                          </p>
                          <span className="mt-2 inline-flex rounded bg-[#e4ecfa] px-1.5 py-0.5 text-[10px] text-[#244993]">
                            {a.project.status === "IN_PROGRESS"
                              ? "In progress"
                              : a.project.status === "PLANNED"
                                ? "Planned"
                                : a.project.status === "ON_HOLD"
                                  ? "On hold"
                                  : a.project.status
                                      .replaceAll("_", " ")
                                      .toLowerCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-2 max-[400px]:ml-11">
                        <Button
                          type="button"
                          className={panelAssignButton}
                          onClick={() => {
                            setSelected("")
                            openAssignment(a.projectId, current.id, current.id)
                          }}
                        >
                          Edit allocation
                        </Button>
                        <Button
                          type="button"
                          className={panelDangerButton}
                          aria-label={`Unassign from ${a.project.name}`}
                          onClick={() => {
                            setSelected("")
                            setActionError("")
                            setConfirmation(a)
                          }}
                        >
                          <Trash2
                            size={15}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                          <HoverTooltip>Unassign</HoverTooltip>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!current.assignments.length && (
                    <p className="m-0 px-4 py-5 text-xs text-[#738096]">
                      No assignments this week.
                    </p>
                  )}
                </div>
              </section>
              <p className="text-[11px] text-[#738096]">
                Utilization = assigned hours ÷ (scheduled hours − time off).
                Missing hours are never treated as free capacity.
              </p>
            </div>
          )}
        </WorkloadDetailsDrawer>
      )}
      <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
        <WorkloadDialog
          title="Staffing attention"
          description="Assign staff to projects or resolve allocations that no longer match the active department roster."
          onClose={() => setRequestsOpen(false)}
        >
          <div className="grid gap-3 p-5 sm:p-6">
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
          </div>
          <footer className="flex justify-end border-t border-[#eceef1] px-5 py-4 sm:px-6">
            <Button
              variant="outline"
              className={panelSecondaryButton}
              onClick={() => setRequestsOpen(false)}
            >
              Close
            </Button>
          </footer>
        </WorkloadDialog>
      </Dialog>
      <Dialog
        open={!!capacityTarget}
        onOpenChange={(open) => {
          if (!open && !busy) setCapacityTarget(null)
        }}
      >
        <WorkloadDialog
          title="Edit weekly capacity"
          description={`${capacityTarget?.fullName ?? ""} · Week of ${week}. Include leave and holidays in time off.`}
          onClose={() => setCapacityTarget(null)}
          busy={busy}
        >
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
              className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
            >
              <CapacityFields
                scheduledHours={capacityTarget.capacity?.scheduledHours ?? null}
                timeOffHours={capacityTarget.capacity?.timeOffHours ?? 0}
                assignedHours={metrics(capacityTarget).assigned}
                hasUnrecordedHours={metrics(capacityTarget).unknown}
              />
              {actionError && (
                <p
                  role="alert"
                  className="sm:col-span-2 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                >
                  {actionError}
                </p>
              )}
              <footer className="-mx-5 -mb-5 flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:col-span-2 sm:-mx-6 sm:-mb-6 sm:px-6">
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
              </footer>
            </Form>
          )}
        </WorkloadDialog>
      </Dialog>
      <Dialog
        open={!!allocation}
        onOpenChange={(open) => {
          if (!open && !busy) setAllocation(null)
        }}
      >
        <WorkloadDialog
          title={
            allocation?.previousEmployeeId
              ? "Reassign / edit allocation"
              : "Assign staff"
          }
          description={`Allocate weekly hours to an authorized project, starting the week of ${week}.`}
          onClose={() => setAllocation(null)}
          busy={busy}
        >
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
              className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
            >
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
                <p
                  role="alert"
                  className="sm:col-span-2 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                >
                  {actionError}
                </p>
              )}
              <footer className="-mx-5 -mb-5 flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:col-span-2 sm:-mx-6 sm:-mb-6 sm:px-6">
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
              </footer>
            </Form>
          )}
        </WorkloadDialog>
      </Dialog>
      <Dialog
        open={!!assignmentPicker}
        onOpenChange={(open) => {
          if (!open) setAssignmentPicker(null)
        }}
      >
        <WorkloadDialog
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
          onClose={() => setAssignmentPicker(null)}
        >
          <div className="grid gap-2 p-5 sm:p-6">
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
          </div>
        </WorkloadDialog>
      </Dialog>
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
