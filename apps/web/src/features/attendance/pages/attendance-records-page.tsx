"use client"
import { useState } from "react"
import { PageHeaderButton } from "@/components/layout/page-header"
import { FilterSelect } from "@/components/ui/filter-select"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import {
  EmployeePicker,
  RangeFields,
  ResourceStatus,
  AttendancePagination,
} from "../components/attendance-shared"
import { AttendanceHistoryTable } from "../components/attendance-history"
import {
  attendanceMonitoring,
  attendanceDepartments,
} from "../api/attendance-api"
import { defaultRange } from "../model/attendance"

export function AttendanceRecordsPage() {
  const [employeeId, setEmployeeId] = useState("")
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState("")
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const history = useAsyncResource(
    (signal) =>
      attendanceMonitoring(
        range.from,
        range.to,
        page,
        employeeId,
        departmentId,
        signal,
      ),
    [employeeId, departmentId, range.from, range.to, page],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load attendance records.",
    },
  )
  // Keys prevent briefly showing another employee's cached rows after selection.
  const matching = !history.loading ? history.data : undefined
  function exportPage() {
    if (!matching) return
    const rows = [
      [
        "Workday",
        "Employee",
        "Department",
        "Timezone",
        "Clock in timestamps",
        "Clock out timestamps",
        "Worked hours",
        "Required hours",
        "Review excess",
      ],
      ...matching.workdays.map((day) => [
        day.workDate,
        day.employee?.fullName ?? "",
        day.employee?.department?.name ?? "",
        day.timeZone,
        day.sessions.map((session) => session.startedAt).join("; "),
        day.sessions.map((session) => session.endedAt ?? "Open").join("; "),
        String(day.workedHours),
        String(day.requiredMinutes / 60),
        String(day.excessRequiresReview),
      ]),
    ]
    const blob = new Blob(
      [
        rows
          .map((row) =>
            row
              .map(
                (cell) =>
                  `"${(/^[=+\-@\t\r]/.test(cell) ? "'" + cell : cell).replaceAll('"', '""')}"`,
              )
              .join(","),
          )
          .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    )
    const url = URL.createObjectURL(blob),
      link = document.createElement("a")
    link.href = url
    link.download = `attendance-${range.from}-${range.to}-page-${page}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <AttendanceShell
      tab="records"
      actions={
        <PageHeaderButton
          disabled={!matching?.workdays.length || history.loading}
          onClick={exportPage}
        >
          Export this page
        </PageHeaderButton>
      }
    >
      <div className="mb-4">
        <EmployeePicker
          key={departmentId}
          departmentId={departmentId}
          allowAll
          value={employeeId}
          onChange={(value) => {
            setEmployeeId(value)
            setPage(1)
          }}
        >
          <FilterSelect
            label="Attendance department"
            value={departmentId}
            disabled={departments.loading}
            triggerClassName="h-[34px] w-[210px] max-[560px]:w-full"
            options={[
              { value: "", label: "All permitted departments" },
              ...(departments.data?.departments ?? []).map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
            onChange={(value) => {
              setDepartmentId(value)
              setEmployeeId("")
              setPage(1)
            }}
          />
          <RangeFields
            {...range}
            onChange={(from, to) => {
              setRange({ from, to })
              setPage(1)
            }}
          />
        </EmployeePicker>
      </div>
      <ResourceStatus
        loading={false}
        error={departments.error}
        retry={departments.retry}
      />
      <section aria-label="Employee attendance records">
        <AttendanceHistoryTable
          days={matching?.workdays ?? []}
          asOf={matching ? Date.parse(matching.asOf) : 0}
          loading={history.loading && !matching}
          error={history.error}
          onRetry={history.retry}
        />
        {matching && (
          <AttendancePagination
            data={matching}
            disabled={history.loading}
            onChange={setPage}
          />
        )}
      </section>
    </AttendanceShell>
  )
}
