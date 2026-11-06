"use client"

import { WorkloadWeekInput } from "../components/workload-week-input"
import { CapacityFields } from "../components/capacity-fields"
import { WorkloadRowActions } from "../components/workload-row-actions"
import { WorkloadDetailsDrawer } from "../components/workload-details-drawer"
import { BriefcaseBusiness, Trash2 } from "lucide-react"
import {
  panelAssignButton,
  panelDangerButton,
} from "@/features/departments/styles/member-panel-styles"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { CloseIcon } from "@/components/layout/icons"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import {
  Users,
  UserCheck,
  ChartNoAxesColumn,
  TriangleAlert,
} from "lucide-react"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { useEffect, useState } from "react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { contentClass } from "@/components/layout/styles"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Assignment = {
  id: string
  projectId: string
  employeeId: string
  weeklyHours: number | null
  allocationStart: string | null
  allocationEnd: string | null
  project: { id: string; name: string; status: string }
}
type Staff = {
  id: string
  fullName: string
  position: string | null
  status: string
  profileSpecialties: string[]
  team: { id: string; name: string } | null
  capacity: { scheduledHours: number; timeOffHours: number } | null
  assignments: Assignment[]
}
type Project = {
  id: string
  name: string
  status: string
  requestId: string | null
  staff: { employeeId: string }[]
}
type Data = {
  department: { id: string; name: string }
  week: string
  staff: Staff[]
  projects: Project[]
}
function monday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function metrics(s: Staff) {
  const capacity = s.capacity
    ? Math.max(0, s.capacity.scheduledHours - s.capacity.timeOffHours)
    : null
  const assigned = s.assignments.reduce((n, a) => n + (a.weeklyHours ?? 0), 0)
  const unknown = s.assignments.some((a) => a.weeklyHours === null)
  const utilization =
    capacity !== null && capacity > 0
      ? Math.round((assigned / capacity) * 100)
      : null
  const availability =
    s.status !== "ACTIVE"
      ? s.status === "ON_LEAVE"
        ? "On leave"
        : "Inactive"
      : capacity === null || unknown
        ? "Needs setup"
        : assigned > (capacity ?? 0)
          ? "Overloaded"
          : capacity === 0
            ? "Unavailable"
            : (utilization ?? 0) >= 90
              ? "Near capacity"
              : "Available"
  return { capacity, assigned, unknown, utilization, availability }
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
  const staff = data?.staff ?? []
  const current = staff.find((s) => s.id === selected)
  const teams = [
    ...new Map(
      staff.filter((s) => s.team).map((s) => [s.team!.id, s.team!]),
    ).values(),
  ]
  const filtered = staff.filter(
    (s) =>
      (team === "all" || s.team?.id === team) &&
      (availability === "all" || metrics(s).availability === availability) &&
      `${s.fullName} ${s.position ?? ""} ${s.profileSpecialties.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const pending = (data?.projects ?? []).filter((p) => p.staff.length === 0)
  const openAssignment = (
    projectId = "",
    employeeId = "",
    previousEmployeeId?: string,
  ) => {
    setActionError("")
    setProjection("")
    setAllocation({ projectId, employeeId, previousEmployeeId })
  }
  const recorded = staff.filter(
    (person) =>
      person.status === "ACTIVE" &&
      metrics(person).capacity !== null &&
      !metrics(person).unknown,
  )
  const totalCapacity = recorded.reduce(
    (total, person) => total + (metrics(person).capacity ?? 0),
    0,
  )
  const totalHours = recorded.reduce(
    (total, person) => total + metrics(person).assigned,
    0,
  )
  const summaryMetrics: KpiMetric[] = [
    {
      label: "Total Staff",
      value: staff.length,
      description: "Staff in your department",
      icon: Users,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Available Staff",
      value: staff.filter(
        (person) => metrics(person).availability === "Available",
      ).length,
      description: "Available for additional work",
      icon: UserCheck,
      iconClassName: "text-[#159447]",
    },
    {
      label: "Avg. Utilization",
      value: totalCapacity ? Math.round((totalHours / totalCapacity) * 100) : 0,
      formattedValue: totalCapacity
        ? Math.round((totalHours / totalCapacity) * 100) + "%"
        : "—",
      description:
        recorded.length < staff.length
          ? "Based on staff with recorded hours"
          : "Assigned hours against capacity",
      icon: ChartNoAxesColumn,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Overloaded",
      value: staff.filter(
        (person) => metrics(person).availability === "Overloaded",
      ).length,
      description: "Staff exceeding weekly capacity",
      icon: TriangleAlert,
      iconClassName: "text-[#d81758]",
    },
  ]
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
  const visible = filtered.slice((resolvedPage - 1) * 10, resolvedPage * 10)
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
          key={week}
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
        <KpiCards
          metrics={summaryMetrics}
          label="Staff workload overview"
          pending={loading && !data}
          unavailable={!!error && !data}
          showCharts={false}
          className="grid-cols-4 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1"
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
            variant="outline"
            className="ml-auto h-[34px] text-xs max-[560px]:ml-0"
            disabled={!data || loading}
            onClick={() => setRequestsOpen(true)}
          >
            Staffing requests ({pending.length})
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
            <tbody>
              {!loading &&
                !error &&
                visible.map((s) => {
                  const m = metrics(s)
                  return (
                    <tr key={s.id} className="border-t border-[#eceef1]">
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
                    </tr>
                  )
                })}
              {(loading || error || !visible.length) && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs">
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
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && filtered.length > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a]">
            <span role="status">
              Showing {(resolvedPage - 1) * 10 + 1}–
              {Math.min(resolvedPage * 10, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <NumberedPagination
              page={resolvedPage}
              totalPages={totalPages}
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
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>Staffing requests ({pending.length})</DialogTitle>
          <DialogDescription>
            Authorized projects awaiting their first staff allocation.
          </DialogDescription>
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border-b py-3 text-xs"
            >
              <strong>{p.name}</strong>
              <Button
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  setRequestsOpen(false)
                  openAssignment(p.id)
                }}
              >
                Assign staff
              </Button>
            </div>
          ))}
          {!pending.length && (
            <p className="text-xs text-[#738096]">
              No authorized projects are awaiting staff.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!capacityTarget}
        onOpenChange={(open) => {
          if (!open && !busy) setCapacityTarget(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[rgb(13_28_57_/_48%)]"
          className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                Edit weekly capacity
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
                {capacityTarget?.fullName} · Week of {week}. Include leave and
                holidays in time off.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              type="button"
              className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
              aria-label="Close form"
              disabled={busy}
              onClick={() => setCapacityTarget(null)}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </header>{" "}
          {capacityTarget && (
            <form
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
                  disabled={busy}
                  onClick={() => setCapacityTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Saving…" : "Save capacity"}
                </Button>
              </footer>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!allocation}
        onOpenChange={(open) => {
          if (!open && !busy) setAllocation(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[rgb(13_28_57_/_48%)]"
          className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                {allocation?.previousEmployeeId
                  ? "Reassign / edit allocation"
                  : "Assign staff"}
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
                Allocate weekly hours to an authorized project, starting the
                week of {week}.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              type="button"
              className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
              aria-label="Close form"
              disabled={busy}
              onClick={() => setAllocation(null)}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </header>{" "}
          {allocation && (
            <form
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
              <label className="grid min-w-0 gap-[7px] text-xs font-semibold text-foreground">
                Staff
                <select
                  aria-label="Staff"
                  name="employeeId"
                  required
                  defaultValue={allocation.employeeId}
                  className="h-10 min-w-0 rounded-lg border border-[#d6dfec] bg-background px-[11px] text-sm"
                >
                  {" "}
                  <option value="" disabled>
                    Select staff
                  </option>
                  {staff
                    .filter((s) => s.status === "ACTIVE")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} · {metrics(s).availability}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-[7px] text-xs font-semibold text-foreground">
                Project
                <select
                  aria-label="Project"
                  name="projectId"
                  required
                  defaultValue={allocation.projectId}
                  disabled={!!allocation.previousEmployeeId}
                  className="h-10 min-w-0 rounded-lg border border-[#d6dfec] bg-background px-[11px] text-sm"
                >
                  <option value="" disabled>
                    Select project
                  </option>
                  {data?.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {allocation.previousEmployeeId && (
                  <input
                    type="hidden"
                    name="projectId"
                    value={allocation.projectId}
                  />
                )}
              </label>
              <label className="grid min-w-0 gap-[7px] text-xs font-semibold text-foreground">
                Hours per week
                <Input
                  className="h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm"
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
                      )?.weeklyHours ?? ""
                  }
                />
              </label>
              <label className="grid min-w-0 gap-[7px] text-xs font-semibold text-foreground">
                End date
                <Input
                  className="h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm"
                  name="endDate"
                  type="date"
                  min={week}
                  required
                  defaultValue={
                    staff
                      .find((s) => s.id === allocation.employeeId)
                      ?.assignments.find(
                        (a) => a.projectId === allocation.projectId,
                      )
                      ?.allocationEnd?.slice(0, 10) ?? week
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
                  disabled={busy}
                  onClick={() => setAllocation(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Confirm assignment"}
                </Button>
              </footer>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!assignmentPicker}
        onOpenChange={(open) => {
          if (!open) setAssignmentPicker(null)
        }}
      >
        <DialogContent
          overlayClassName="bg-[rgb(13_28_57_/_48%)]"
          className="max-h-[calc(100dvh-28px)] overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-6 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        >
          <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
            {assignmentPicker?.action === "reassign"
              ? "Choose assignment to reassign"
              : "Choose assignment to unassign"}
          </DialogTitle>
          <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
            Select a project assigned to {assignmentPicker?.staff.fullName} for
            the week of {week}.
          </DialogDescription>
          <div className="grid gap-2">
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
        </DialogContent>
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
