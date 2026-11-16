"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  cellClass,
  FiguresRow,
  headCellClass,
  InlineBar,
  RowsSkeleton,
  Section,
  tableClass,
} from "@/components/ui/overview-panel"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  attendanceDepartments,
  attendanceOverview,
} from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"
import { defaultRange } from "../model/attendance"

export function TimeLogsOverviewPage() {
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
      fallbackError: "Couldn't load record summaries.",
    },
  )
  const data = result.loading || result.error ? undefined : result.data
  const sessions = data?.checkIns
  const totalSessions = sessions?.total ?? 0
  const openSessions = (sessions?.working ?? 0) + (sessions?.onBreak ?? 0)
  const sessionStatuses = [
    { id: "working", label: "Clocked in", value: sessions?.working ?? 0 },
    {
      id: "break",
      label: "On unpaid break",
      value: sessions?.onBreak ?? 0,
    },
    { id: "closed", label: "Clocked out", value: sessions?.closed ?? 0 },
  ]
  const unavailable = Boolean(result.error)

  return (
    <AttendanceShell
      tab="logs-overview"
      actions={
        <>
          <Button asChild variant="brandOutline" size="header">
            <Link href="/attendance/time-logs/records">View records</Link>
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <RangeFields
          {...range}
          onChange={(from, to) => setRange({ from, to })}
        />
        <FilterSelect
          label="Time logs department"
          value={departmentId}
          onChange={setDepartmentId}
          disabled={departments.loading}
          options={[
            { value: "", label: "All permitted departments" },
            ...(departments.data?.departments ?? []).map((department) => ({
              value: department.id,
              label: department.name,
            })),
          ]}
        />
      </div>
      <ResourceStatus
        loading={false}
        error={departments.error}
        retry={departments.retry}
      />
      <ResourceStatus
        loading={false}
        error={result.error}
        retry={result.retry}
      />

      <FiguresRow
        label="Time log figures"
        loading={result.loading}
        items={[
          {
            label: "Employees recorded",
            value: unavailable ? "—" : String(sessions?.employees ?? 0),
          },
          {
            label: "Check-ins",
            value: unavailable ? "—" : String(totalSessions),
          },
          {
            label: "Check-outs",
            value: unavailable ? "—" : String(sessions?.closed ?? 0),
          },
          {
            label: "Still clocked in",
            value: unavailable ? "—" : String(openSessions),
            note: openSessions ? "Needs review" : undefined,
            tone: openSessions ? "warning" : undefined,
          },
        ]}
      />

      <Section title="Recorded session status" className="mt-7">
        {result.loading ? (
          <RowsSkeleton rows={3} />
        ) : result.error ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Record summaries unavailable.
          </p>
        ) : totalSessions === 0 ? (
          <p className="m-0 text-xs text-[#8a94a6]">
            No check-ins in this period.
          </p>
        ) : (
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCellClass}>Status</th>
                <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                  Sessions
                </th>
                <th className="w-[45%] border-b border-[#e3e7ed] pb-2 pl-5 text-left text-[11px] font-medium text-[#738096]">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {sessionStatuses.map((status) => (
                <tr key={status.id}>
                  <td className={`${cellClass} font-medium text-[#182235]`}>
                    {status.label}
                  </td>
                  <td className={`${cellClass} text-right tabular-nums`}>
                    {status.value}
                  </td>
                  <td className={`${cellClass} pl-5`}>
                    <span className="flex items-center gap-3">
                      <InlineBar
                        value={status.value}
                        max={totalSessions}
                        label={`${status.label}: ${status.value} sessions`}
                        className="min-w-12 flex-1"
                      />
                      <span className="w-8 text-right text-[#8a94a6] tabular-nums">
                        {Math.round((status.value / totalSessions) * 100)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="mt-9">
        <Section title="Coverage">
          {result.loading ? (
            <RowsSkeleton rows={4} />
          ) : (
            <dl className="m-0 grid gap-2 text-xs">
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-40 shrink-0 text-[#738096]">
                  Employees recorded
                </dt>
                <dd className="m-0 text-[#182235]">
                  {result.error ? "—" : (sessions?.employees ?? 0)}
                </dd>
              </div>
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-40 shrink-0 text-[#738096]">
                  Attendance days
                </dt>
                <dd className="m-0 text-[#182235]">
                  {result.error ? "—" : (data?.recordedDays ?? 0)}
                </dd>
              </div>
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-40 shrink-0 text-[#738096]">
                  Sessions per employee
                </dt>
                <dd className="m-0 text-[#182235]">
                  {sessions?.employees
                    ? (sessions.total / sessions.employees).toFixed(1)
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
        </Section>
      </div>
    </AttendanceShell>
  )
}
