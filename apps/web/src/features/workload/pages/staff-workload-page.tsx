"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Plus, UsersRound, RefreshCw } from "lucide-react"
import { WorkloadButton as Button } from "../components/workload-button"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { WorkloadKpiCards } from "../components/workload-kpi-cards"
import { WorkloadSelect } from "../components/workload-select"
import { WorkloadTable } from "../components/workload-table"
import { SearchField } from "@/components/ui/search-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { contentClass } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { listWorkload, type Overview } from "../api/workload-api"
import { EmployeeWorkloadDialog } from "../components/employee-workload-dialog"
import { WorkForm } from "../components/work-form"
import { StaffingPanel } from "../components/staffing-panel"
import {
  Field,
  fieldClass,
  labelText,
  localDate,
} from "../components/workload-ui"

export function StaffWorkloadPage() {
  const [start, setStart] = useState(localDate)
  const [view, setView] = useState("week")
  const [search, setSearch] = useState("")
  const [skill, setSkill] = useState("")
  const [availability, setAvailability] = useState("")
  const [employmentType, setEmploymentType] = useState("")
  const [workload, setWorkload] = useState("")
  const [sort, setSort] = useState("name:asc")
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState("staff")
  const [revision, setRevision] = useState(0)
  const [resolved, setResolved] = useState("")
  const [error, setError] = useState("")
  const [result, setResult] = useState<Overview | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    crossDepartment: boolean
    employeeId?: string
  } | null>(null)
  const range = useMemo(() => {
    const monthStart = start.slice(0, 7) + "-01"
    return {
      start: view === "month" ? monthStart : start,
      days:
        view === "month"
          ? new Date(
              Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0),
            ).getUTCDate()
          : 7,
    }
  }, [start, view])
  const requestKey = JSON.stringify({ range, revision })
  const loading = requestKey !== resolved
  useEffect(() => {
    let active = true
    listWorkload(range)
      .then((data) => {
        if (active) {
          setResult(data)
          setError("")
          setResolved(requestKey)
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load staff workload",
          )
          setResolved(requestKey)
        }
      })
    return () => {
      active = false
    }
  }, [range, revision, requestKey])
  function changed() {
    setRevision((v) => v + 1)
  }
  const allEmployees = result?.employees ?? []
  const skills = [...new Set(allEmployees.flatMap((e) => e.skills))].sort()
  const rows = allEmployees
    .filter(
      (e) =>
        `${e.fullName} ${e.employeeId} ${e.position ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!skill || e.skills.includes(skill)) &&
        (!availability || e.status === availability) &&
        (!employmentType || e.employmentType === employmentType) &&
        (!workload || e.workload === workload),
    )
    .sort((a, b) => {
      const [key, direction] = sort.split(":")
      const comparison =
        key === "name"
          ? a.fullName.localeCompare(b.fullName)
          : key === "capacity"
            ? a.remainingHours - b.remainingHours
            : key === "assignments"
              ? a.assignmentCount - b.assignmentCount
              : (a.utilization ?? Infinity) - (b.utilization ?? Infinity)
      return (
        (Number.isNaN(comparison) ? 0 : comparison) *
          (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id)
      )
    })
  const pages = Math.max(1, Math.ceil(rows.length / 10)),
    currentPage = Math.min(page, pages)
  const visible = rows.slice((currentPage - 1) * 10, currentPage * 10)
  function resetFilters() {
    setSearch("")
    setSkill("")
    setAvailability("")
    setEmploymentType("")
    setWorkload("")
    setPage(1)
  }
  const filtered = Boolean(
    search || skill || availability || employmentType || workload,
  )
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
  }
  const statusOptions = (values: string[], allLabel: string) => [
    { value: "", label: allLabel },
    ...values.map((value) => ({ value, label: labelText(value) })),
  ]
  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Staff workload management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Staff Workload
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Review staff availability, balance workloads, and assign qualified
            personnel.
          </p>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!result || loading || !!error}
            onClick={() => setForm({ crossDepartment: true })}
          >
            <UsersRound size={14} aria-hidden="true" /> Request staffing
          </Button>
          <Button
            disabled={!result || loading || !!error}
            onClick={() => setForm({ crossDepartment: false })}
          >
            <Plus size={14} aria-hidden="true" /> Assign work
          </Button>
        </div>
      </header>
      <section
        aria-label="Reporting period"
        className="mt-[18px] flex flex-wrap items-end justify-between gap-3 max-[560px]:mt-[14px]"
      >
        <div className="flex flex-wrap items-end gap-[10px] max-[560px]:w-full [&>div]:max-[560px]:flex-1">
          <div className="grid min-w-0 gap-[7px]">
            <span className="text-xs font-[650]">Period</span>
            <WorkloadSelect
              label="Period"
              value={view}
              onChange={setView}
              className="w-[110px]"
              options={[
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
              ]}
            />
          </div>
          <Field
            label={view === "month" ? "Month containing" : "Week beginning"}
          >
            <input
              type="date"
              value={start}
              onChange={(event) => {
                if (event.target.value)
                  updateFilter(setStart, event.target.value)
              }}
              className={cn(
                fieldClass,
                "h-[34px] w-[155px] border-[#e1e4ea] text-xs max-[560px]:w-full",
              )}
            />
          </Field>
          <Button
            variant="outline"
            onClick={changed}
            disabled={loading}
            aria-label="Refresh workload"
          >
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </Button>
        </div>
        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#738096]">
          <CalendarDays size={14} aria-hidden="true" />{" "}
          {result ? result.department.name + " · " : ""}Asia/Manila ·{" "}
          {range.days} days
        </p>
      </section>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-[#f3d5dc] bg-[#fdf3f5] p-4 text-xs text-[#b4234d]"
        >
          {error}
          <Button variant="outline" className="ml-3" onClick={changed}>
            Retry
          </Button>
        </div>
      )}
      {loading && result && (
        <p role="status" className="mt-3 text-xs text-[#738096]">
          Updating capacity…
        </p>
      )}
      {loading && !result ? (
        <p role="status" className="py-12 text-center text-xs text-[#7183a2]">
          Loading staff capacity…
        </p>
      ) : (
        result &&
        !error && (
          <fieldset
            disabled={loading}
            aria-busy={loading}
            aria-label="Department workload"
            className="mt-4 min-w-0 space-y-4 border-0 p-0"
          >
            <WorkloadKpiCards employees={allEmployees} />
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-[34px] max-w-full [&>button]:px-2.5 [&>button]:text-xs">
                <TabsTrigger value="staff">Staff overview</TabsTrigger>
                <TabsTrigger value="staffing">
                  Staffing requests (
                  {
                    result.staffing.filter(
                      (request) => request.status === "PENDING",
                    ).length
                  }
                  )
                </TabsTrigger>
              </TabsList>
              <TabsContent value="staff" className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center gap-[10px] max-[560px]:flex-col max-[560px]:items-stretch">
                  <SearchField
                    label="Search staff"
                    value={search}
                    onChange={(event) =>
                      updateFilter(setSearch, event.target.value)
                    }
                    placeholder="Search name, ID or position…"
                  />
                  <WorkloadSelect
                    label="Department"
                    value={result.department.id}
                    onChange={() => undefined}
                    options={[
                      {
                        value: result.department.id,
                        label: result.department.name,
                      },
                    ]}
                  />
                  <WorkloadSelect
                    label="Skill"
                    value={skill}
                    onChange={(value) => updateFilter(setSkill, value)}
                    options={[
                      { value: "", label: "All skills" },
                      ...skills.map((value) => ({ value, label: value })),
                    ]}
                  />
                  <WorkloadSelect
                    label="Availability"
                    value={availability}
                    onChange={(value) => updateFilter(setAvailability, value)}
                    options={statusOptions(
                      [
                        "AVAILABLE",
                        "PARTIALLY_AVAILABLE",
                        "FULLY_ALLOCATED",
                        "UNAVAILABLE",
                      ],
                      "All availability",
                    )}
                  />
                  <WorkloadSelect
                    label="Employment type"
                    value={employmentType}
                    onChange={(value) => updateFilter(setEmploymentType, value)}
                    options={statusOptions(
                      ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"],
                      "All types",
                    )}
                  />
                  <WorkloadSelect
                    label="Workload"
                    value={workload}
                    onChange={(value) => updateFilter(setWorkload, value)}
                    options={statusOptions(
                      [
                        "AVAILABLE",
                        "MODERATE",
                        "HIGH",
                        "FULLY_ALLOCATED",
                        "OVER_CAPACITY",
                        "UNAVAILABLE",
                      ],
                      "All workloads",
                    )}
                  />
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    disabled={!filtered}
                  >
                    Clear filters
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#738096]">
                  <p>
                    {rows.length} employee{rows.length === 1 ? "" : "s"} ·
                    Capacity is calculated from recorded hours.
                  </p>
                  <WorkloadSelect
                    label="Sort employees"
                    value={sort}
                    onChange={(value) => updateFilter(setSort, value)}
                    className="w-[180px]"
                    options={[
                      { value: "name:asc", label: "Name: A to Z" },
                      { value: "name:desc", label: "Name: Z to A" },
                      {
                        value: "utilization:desc",
                        label: "Highest utilization",
                      },
                      { value: "utilization:asc", label: "Lowest utilization" },
                      { value: "capacity:desc", label: "Most capacity" },
                      { value: "assignments:desc", label: "Most assignments" },
                    ]}
                  />
                </div>
                <WorkloadTable
                  employees={visible}
                  hasEmployees={allEmployees.length > 0}
                  onView={setEmployeeId}
                />
                {rows.length > 0 && (
                  <footer className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#65718a]">
                    <span role="status" aria-live="polite">
                      Showing {(currentPage - 1) * 10 + 1}–
                      {Math.min(currentPage * 10, rows.length)} of {rows.length}
                    </span>
                    <NumberedPagination
                      page={currentPage}
                      totalPages={pages}
                      disabled={loading}
                      label="Staff workload pages"
                      onPageChange={setPage}
                    />
                  </footer>
                )}
              </TabsContent>
              <TabsContent value="staffing" className="pt-3">
                <StaffingPanel
                  requests={result.staffing}
                  departmentId={result.department.id}
                  employees={allEmployees}
                  onChanged={changed}
                />
              </TabsContent>
            </Tabs>
          </fieldset>
        )
      )}
      {employeeId && (
        <EmployeeWorkloadDialog
          employeeId={employeeId}
          range={range}
          onClose={() => setEmployeeId(null)}
          onChanged={changed}
          onAssign={(id) => {
            setEmployeeId(null)
            setForm({ crossDepartment: false, employeeId: id })
          }}
        />
      )}
      {form && (
        <WorkForm
          employees={allEmployees}
          crossDepartment={form.crossDepartment}
          initialEmployeeId={form.employeeId}
          onClose={() => setForm(null)}
          onSaved={changed}
        />
      )}
    </main>
  )
}
