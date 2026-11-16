"use client"
import { useState } from "react"
import { Download } from "lucide-react"
import { PageHeaderButton } from "@/components/layout/page-header"
import { FilterSelect } from "@/components/ui/filter-select"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import {
  RangeFields,
  ResourceStatus,
  AttendancePagination,
} from "../components/attendance-shared"
import { AttendanceHistoryTable } from "../components/attendance-history"
import {
  attendanceMonitoring,
  attendanceDepartments,
  attendanceEmployees,
  type AttendanceEmployee,
} from "../api/attendance-api"
import { EmployeeTable } from "@/features/employees/components/employee-table"
import { SearchField } from "@/components/ui/search-field"
import { Button } from "@/components/ui/button"
import { defaultRange } from "../model/attendance"

function matchesAttendanceEmployee(item: AttendanceEmployee, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return [item.fullName, item.employeeId].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  )
}

export function AttendanceRecordsPage() {
  const [view, setView] = useState<"employees" | "logs">("employees")
  const [selected, setSelected] = useState<{
    id: string
    fullName: string
  } | null>(null)
  const employeeId = selected?.id ?? ""
  const [search, setSearch] = useState("")
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState("")
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const employees = usePaginatedList({
    params: { search, departmentId },
    load: ({ page, signal }) =>
      attendanceEmployees(search, page, signal, departmentId),
    rows: (result) => result.employees,
    matches: matchesAttendanceEmployee,
    initial: null,
    fallbackError: "Couldn't load employees.",
  })
  const { setPage: setEmployeePage } = employees
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
      enabled: view === "logs" && Boolean(range.from && range.to),
      fallbackError: "Couldn't load attendance records.",
    },
  )
  // Keys prevent briefly showing another employee's cached rows after selection.
  const matching =
    view === "logs" && !history.loading && !history.error
      ? history.data
      : undefined
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

  const departmentFilter = (
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
      onChange={(value) => {
        setDepartmentId(value)
        setEmployeePage(1)
        setPage(1)
      }}
    />
  )
  return (
    <AttendanceShell
      tab="records"
      title={
        view === "logs" && selected
          ? `Time Logs for ${selected.fullName}`
          : undefined
      }
      actions={
        view === "employees" ? (
          <PageHeaderButton
            onClick={() => {
              setSelected(null)
              setPage(1)
              setView("logs")
            }}
          >
            All logs
          </PageHeaderButton>
        ) : (
          <PageHeaderButton onClick={() => setView("employees")}>
            Employees
          </PageHeaderButton>
        )
      }
    >
      <ResourceStatus
        loading={false}
        error={departments.error}
        retry={departments.retry}
      />
      {view === "employees" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-[10px]">
            <SearchField
              label="Search attendance employees"
              placeholder="Search employee name or ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setEmployeePage(1)
              }}
            />
            {departmentFilter}
          </div>
          <EmployeeTable
            mode="attendance"
            employees={employees.rows.map((employee) => ({
              ...employee,
              departmentName: employee.departmentId
                ? (departments.data?.departments.find(
                    (department) => department.id === employee.departmentId,
                  )?.name ?? "Department unavailable")
                : "Unassigned",
            }))}
            initialLoading={
              employees.searchSkeleton ||
              (employees.loading &&
                !employees.hasCurrentData &&
                !employees.previewing)
            }
            loading={employees.loading}
            previewing={employees.previewing}
            error={employees.error}
            onRetry={employees.retry}
            emptyMessage="No employees match your search."
            onView={(employee) => {
              setSelected(employee)
              setPage(1)
              setView("logs")
            }}
          />
          <TableSearchStatus
            active={
              employees.loading &&
              employees.previewing &&
              Boolean(employees.preview?.length)
            }
            label="attendance employees"
          />
          {employees.data &&
            employees.hasCurrentData &&
            !employees.previewing &&
            !employees.error && (
              <AttendancePagination
                data={employees.data}
                disabled={employees.loading}
                onChange={setEmployeePage}
              />
            )}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-[10px]">
            {!selected && departmentFilter}
            <RangeFields
              {...range}
              onChange={(from, to) => {
                setRange({ from, to })
                setPage(1)
              }}
            />
            {selected && (
              <Button
                variant="outline"
                size="panel"
                onClick={() => {
                  setSelected(null)
                  setPage(1)
                }}
              >
                All logs
              </Button>
            )}
            <Button
              variant="outline"
              size="panel"
              className="ml-auto"
              disabled={!matching?.workdays.length || history.loading}
              onClick={exportPage}
            >
              <Download size={15} aria-hidden="true" />
              Export
            </Button>
          </div>
          <AttendanceHistoryTable
            days={matching?.workdays ?? []}
            asOf={matching ? Date.parse(matching.asOf) : 0}
            loading={history.loading}
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
        </>
      )}
    </AttendanceShell>
  )
}
