"use client"
import Link from "next/link"
import { useState } from "react"
import { CircleCheck, Clock3, TriangleAlert, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
  type ItemRow,
} from "@/components/ui/overview-panel"
import {
  ProgressMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import { formatDateTime } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"
import {
  attendanceDepartments,
  attendanceOverview,
  type AttendanceWorkday,
} from "../api/attendance-api"
import { attendanceStatusLabels, defaultRange } from "../model/attendance"

function hours(value: number | undefined) {
  return value === undefined ? "—" : `${value.toFixed(2)} h`
}

export function AttendanceOverviewPage() {
  const [range, setRange] = useState(defaultRange)
  const [departmentId, setDepartmentId] = useState("")
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const result = useAsyncResource(
    (signal) => attendanceOverview(range.from, range.to, departmentId, signal),
    [range.from, range.to, departmentId],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load attendance summaries.",
    },
  )
  const data = result.data
  const pending = result.loading && !data
  const unavailable = Boolean(result.error) && !data
  const scopeLabel =
    data?.scope === "DEPARTMENT"
      ? "Department"
      : data?.scope === "ORGANIZATION"
        ? "Organization"
        : "Permitted scope"
  const averageWorkedHours =
    data && data.recordedDays > 0
      ? data.workedHours / data.recordedDays
      : undefined
  const coveragePercent =
    data && data.requiredHours > 0
      ? Math.round((data.workedHours / data.requiredHours) * 100)
      : undefined
  const coverageRows =
    data && (data.recordedDays > 0 || data.requiredHours > 0)
      ? [
          {
            id: "required-hours",
            label: "Required hours",
            value: data.requiredHours,
          },
          {
            id: "worked-hours",
            label: "Net worked hours",
            value: data.workedHours,
          },
        ]
      : []
  const attentionRows: ItemRow[] = []
  if (data?.activeSessions) {
    attentionRows.push({
      id: "active-sessions",
      label: "Active sessions",
      note: `${data.activeSessions} still open`,
      tone: "warning",
    })
  }
  if (data?.excessDays) {
    attentionRows.push({
      id: "excess-days",
      label: "Excess-hour workdays",
      note: `${data.excessDays} require review`,
      tone: "warning",
    })
  }
  if (data?.pendingCorrections) {
    attentionRows.push({
      id: "pending-corrections",
      label: "Pending corrections",
      note: `${data.pendingCorrections} awaiting review`,
      tone: "warning",
    })
  }
  if (data?.overnightReviews) {
    attentionRows.push({
      id: "overnight-reviews",
      label: "Overnight reviews",
      note: `${data.overnightReviews} require review`,
      tone: "warning",
    })
  }
  const statusOrder: AttendanceWorkday["status"][] = [
    "COMPLETE",
    "HOURS_MET",
    "IN_PROGRESS",
    "INCOMPLETE",
    "NOT_STARTED",
    "NOT_REQUIRED",
  ]
  const statusRows = statusOrder.map((status) => ({
    id: status,
    label: attendanceStatusLabels[status],
    value: data?.statusBreakdown[status] ?? 0,
  }))
  const selectedDepartment = departments.data?.departments.find(
    (department) => department.id === departmentId,
  )
  const contextRows: ItemRow[] = [
    {
      id: "scope",
      label: "Reporting scope",
      note: scopeLabel,
      tone: "muted",
    },
    {
      id: "department",
      label: "Department filter",
      note: selectedDepartment?.name ?? "All permitted departments",
      tone: "muted",
    },
    {
      id: "range",
      label: "Date range",
      note: `${range.from} → ${range.to}`,
      tone: "muted",
    },
    {
      id: "missing-days",
      label: "Missing days",
      note: "Not classified as absences",
      tone: "muted",
    },
    ...(data?.asOf
      ? [
          {
            id: "updated",
            label: "Last refreshed",
            note: `${formatDateTime(data.asOf, "UTC")} UTC`,
            tone: "muted" as const,
          },
        ]
      : []),
  ]
  const metrics: StatStripItem[] = [
    {
      label: "Employees recorded",
      value: data?.employees.toLocaleString("en-US") ?? "0",
      caption: "Employees with recorded workdays",
      icon: UsersRound,
      tone: "bg-[#e8eef8] text-[#284f9e]",
    },
    {
      label: "Net worked hours",
      value: data?.workedHours.toFixed(2) ?? "0.00",
      caption: "Unpaid breaks excluded",
      icon: Clock3,
      tone: "bg-[#e6f4ee] text-[#25745b]",
    },
    {
      label: "Completed workdays",
      value: data?.completeDays.toLocaleString("en-US") ?? "0",
      caption: "Daily required hours met",
      icon: CircleCheck,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <ProgressMeter
          value={data?.completeDays ?? 0}
          max={data?.recordedDays ?? 0}
          label="Completed workdays"
          colorClass="bg-[#29906b]"
        />
      ),
    },
    {
      label: "Excess-hour workdays",
      value: data?.excessDays.toLocaleString("en-US") ?? "0",
      caption: "Review required; overtime unapproved",
      captionTone: "text-[#a45b12]",
      icon: TriangleAlert,
      tone: "bg-[#fbf0e2] text-[#a45b12]",
    },
  ]

  return (
    <AttendanceShell
      tab="overview"
      actions={
        <Button asChild variant="brandOutline" size="header">
          <Link href="/attendance/records">View time logs</Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <RangeFields
          {...range}
          onChange={(from, to) => setRange({ from, to })}
        />
        <FilterSelect
          label="Attendance department"
          value={departmentId}
          disabled={departments.loading}
          triggerClassName="w-[210px]"
          options={[
            { value: "", label: "All permitted departments" },
            ...(departments.data?.departments ?? []).map((department) => ({
              value: department.id,
              label: department.name,
            })),
          ]}
          onChange={setDepartmentId}
        />
      </div>
      <ResourceStatus
        loading={false}
        error={result.error}
        retry={result.retry}
      />
      <div className="grid gap-4">
        <StatStrip
          items={metrics}
          label="Attendance overview"
          pending={pending}
          unavailable={unavailable}
        />
        <MiniStats
          label="Attendance figures"
          loading={pending}
          items={[
            {
              label: "Recorded workdays",
              value: data?.recordedDays.toLocaleString("en-US") ?? "—",
              hint: "Attendance days in range",
            },
            {
              label: "Required hours",
              value: hours(data?.requiredHours),
              hint: "From assigned policies",
            },
            {
              label: "Average net hours",
              value: hours(averageWorkedHours),
              hint: "Per recorded workday",
            },
            {
              label: "Active sessions",
              value: data?.activeSessions.toLocaleString("en-US") ?? "—",
              hint: "Currently open",
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Attendance requirement coverage"
            description="Net worked time against policy-required hours; this is not a productivity measure."
          >
            <BreakdownList
              rows={coverageRows}
              loading={pending}
              unit="hours"
              empty={
                unavailable
                  ? "Attendance data unavailable."
                  : "No recorded workdays in this range."
              }
              colorClass="bg-[#284f9e]"
            />
            {data && (
              <p className="mt-4 mb-0 text-xs text-[#738096]">
                {coveragePercent === undefined
                  ? "No required hours are assigned for this range."
                  : `Net worked time covers ${coveragePercent}% of required hours. Excess hours remain review flags.`}
              </p>
            )}
          </OverviewPanel>
          <OverviewPanel
            title="Workday status"
            description="Recorded workdays grouped by their current attendance status."
          >
            <BreakdownList
              rows={statusRows}
              loading={pending}
              total={data?.recordedDays ?? 0}
              unit="workdays"
              empty={
                unavailable
                  ? "Attendance data unavailable."
                  : "No recorded workdays in this range."
              }
              colorClass="bg-[#29906b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title={`${scopeLabel} attendance`}
            description="Figures cover recorded attendance only; missing days are not classified as absences."
          >
            <ItemList
              rows={contextRows}
              loading={pending}
              empty={
                unavailable
                  ? "Attendance data unavailable."
                  : "No attendance context for this range."
              }
            />
          </OverviewPanel>
        </div>
        <OverviewPanel
          title="Needs attention"
          description="Attendance signals that may need follow-up before records are finalized."
        >
          <ItemList
            rows={attentionRows}
            loading={pending}
            empty={
              data?.recordedDays
                ? "No attendance signals require follow-up in this range."
                : "No recorded workdays in this range."
            }
            emptyTone={data?.recordedDays ? "success" : "muted"}
          />
        </OverviewPanel>
      </div>
    </AttendanceShell>
  )
}
