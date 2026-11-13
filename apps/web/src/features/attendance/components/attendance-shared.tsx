"use client"
import { useState, type ReactNode } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DateInput } from "@/components/ui/date-input"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendanceEmployees, type Paging } from "../api/attendance-api"

export function ResourceStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error: string
  retry: () => void
}) {
  if (error)
    return (
      <Alert className="my-4">
        <span>{error}</span>
        <Button
          variant="brandOutline"
          size="sm"
          className="ml-3"
          onClick={retry}
        >
          Retry
        </Button>
      </Alert>
    )
  return loading ? (
    <div
      role="status"
      aria-label="Loading attendance"
      className="my-4 grid gap-2"
    >
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  ) : null
}

/** Plain table-body empty row shared by attendance directory tables. */
export function AttendanceTableEmpty({
  message,
  colSpan,
}: {
  message: string
  colSpan: number
}) {
  return (
    <div role="row">
      <div
        role="cell"
        aria-colspan={colSpan}
        className="grid min-h-[150px] place-content-center p-6 text-center text-xs text-[#7183a2]"
      >
        {message}
      </div>
    </div>
  )
}
export function AttendancePagination({
  data,
  onChange,
  disabled = false,
}: {
  data: Paging
  onChange: (page: number) => void
  disabled?: boolean
}) {
  return (
    <TablePaginationFooter
      {...pageRange(data.page, data.pageSize, data.total)}
      total={data.total}
      page={data.page}
      totalPages={Math.ceil(data.total / data.pageSize)}
      label="Attendance pages"
      disabled={disabled}
      onPageChange={onChange}
    />
  )
}
export function RangeFields({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-[10px] max-[560px]:w-full">
      <label className="flex min-w-0 items-center gap-2 text-[11px] text-[#738096] max-[560px]:flex-1">
        From
        <DateInput
          aria-label="Attendance from date"
          value={from}
          max={to}
          onChange={(event) => onChange(event.target.value, to)}
          className="h-[34px] w-[140px] text-xs max-[560px]:w-full"
        />
      </label>
      <label className="flex min-w-0 items-center gap-2 text-[11px] text-[#738096] max-[560px]:flex-1">
        Through
        <DateInput
          aria-label="Attendance through date"
          value={to}
          min={from}
          onChange={(event) => onChange(from, event.target.value)}
          className="h-[34px] w-[140px] text-xs max-[560px]:w-full"
        />
      </label>
    </div>
  )
}
export function EmployeePicker({
  value,
  onChange,
  departmentId = "",
  allowAll = false,
  children,
}: {
  value: string
  onChange: (id: string) => void
  departmentId?: string
  allowAll?: boolean
  children?: ReactNode
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const list = useAsyncResource(
    (signal) => attendanceEmployees(search, page, signal, departmentId),
    [search, page, departmentId],
    { fallbackError: "Couldn't load employees." },
  )
  return (
    <section aria-label="Attendance employee selection" className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-[10px] max-[560px]:flex-col max-[560px]:items-stretch">
        <SearchField
          label="Search attendance employees"
          placeholder="Search employee name or ID"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Select attendance employee"
          value={value}
          onChange={onChange}
          disabled={list.loading}
          placeholder="Select an employee"
          options={[
            ...(allowAll
              ? [{ value: "", label: "All permitted employees" }]
              : []),
            ...(list.data?.employees ?? []).map((employee) => ({
              value: employee.id,
              label: `${employee.fullName} · ${employee.employeeId}`,
            })),
          ]}
          triggerClassName="h-[34px] w-[220px] max-[560px]:w-full"
        />
        {children}
      </div>
      <ResourceStatus
        loading={list.loading && !list.data}
        error={list.error}
        retry={list.retry}
      />
      {list.data && !list.loading && !list.data.total && (
        <p className="text-xs text-[#738096]">
          No employees match your search.
        </p>
      )}
      {list.data && list.data.total > list.data.pageSize && (
        <AttendancePagination
          data={list.data}
          onChange={setPage}
          disabled={list.loading}
        />
      )}
    </section>
  )
}
