"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  cellClass,
  FiguresRow,
  headCellClass,
  InlineBar,
  RowsSkeleton,
  Section,
  tableClass,
} from "@/components/ui/overview-panel"
import { formatDateTime } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { personalAttendanceOverview } from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"
import { defaultRange } from "../model/attendance"

const activityLabels = {
  CLOCK_IN: "Clocked in",
  CLOCK_OUT: "Clocked out",
  BREAK_START: "Started break",
  BREAK_END: "Ended break",
}

export function AttendanceOverviewPage() {
  const [range, setRange] = useState(defaultRange)
  const result = useAsyncResource(
    (signal) => personalAttendanceOverview(range.from, range.to, signal),
    [range.from, range.to],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load check-in summaries.",
    },
  )
  const data = result.loading || result.error ? undefined : result.data
  const summary = data?.checkIns
  const totalSessions = summary?.total ?? 0
  const openSessions = (summary?.working ?? 0) + (summary?.onBreak ?? 0)
  const checkOutRate = totalSessions
    ? Math.round(((summary?.closed ?? 0) / totalSessions) * 100)
    : 0
  const sessionsPerDay =
    data && data.recordedDays > 0
      ? (data.checkIns.total / data.recordedDays).toFixed(1)
      : "—"
  const figuresUnavailable = Boolean(result.error)
  const statuses = [
    { id: "working", label: "Clocked in", value: summary?.working ?? 0 },
    {
      id: "break",
      label: "On unpaid break",
      value: summary?.onBreak ?? 0,
    },
    { id: "closed", label: "Clocked out", value: summary?.closed ?? 0 },
  ]

  return (
    <AttendanceShell
      tab="overview"
      actions={
        <>
          <Button
            variant="brandOutline"
            size="header"
            onClick={result.retry}
            disabled={result.loading}
          >
            Refresh
          </Button>
          <Button asChild variant="brandOutline" size="header">
            <Link href="/attendance/check-ins">Open Check-Ins</Link>
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <RangeFields
          {...range}
          onChange={(from, to) => setRange({ from, to })}
        />
      </div>
      <ResourceStatus
        loading={false}
        error={result.error}
        retry={result.retry}
      />

      <FiguresRow
        label="Attendance figures"
        loading={result.loading}
        items={[
          {
            label: "Attendance days",
            value: figuresUnavailable ? "—" : String(data?.recordedDays ?? 0),
          },
          {
            label: "Check-ins",
            value: figuresUnavailable ? "—" : String(totalSessions),
          },
          {
            label: "Check-outs",
            value: figuresUnavailable ? "—" : String(summary?.closed ?? 0),
            note: totalSessions ? `${checkOutRate}% completed` : undefined,
          },
          {
            label: "Still clocked in",
            value: figuresUnavailable ? "—" : String(openSessions),
            note: openSessions ? "Needs review" : undefined,
            tone: openSessions ? "warning" : undefined,
          },
        ]}
      />

      <Section title="Check-in status" className="mt-7">
        {result.loading ? (
          <RowsSkeleton rows={3} />
        ) : result.error ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Check-in summaries unavailable.
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
              {statuses.map((status) => (
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

      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section title="Personal attendance">
          {result.loading ? (
            <RowsSkeleton rows={3} />
          ) : (
            <dl className="m-0 grid gap-2 text-xs">
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-32 shrink-0 text-[#738096]">
                  Reporting scope
                </dt>
                <dd className="m-0 text-[#182235]">Personal</dd>
              </div>
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-32 shrink-0 text-[#738096]">
                  Attendance workdays
                </dt>
                <dd className="m-0 text-[#182235]">
                  {range.from} – {range.to}
                </dd>
              </div>
              <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                <dt className="w-32 shrink-0 text-[#738096]">
                  Sessions per day
                </dt>
                <dd className="m-0 text-[#182235]">{sessionsPerDay}</dd>
              </div>
              {data && (
                <div className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5">
                  <dt className="w-32 shrink-0 text-[#738096]">
                    Last refreshed (UTC)
                  </dt>
                  <dd className="m-0 text-[#182235]">
                    {formatDateTime(data.asOf, "UTC")}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Section>

        <Section title="Recent check-in activity">
          {result.loading ? (
            <RowsSkeleton rows={4} />
          ) : result.error ? (
            <p className="m-0 text-xs leading-5 text-[#65718a]">
              Recent activity unavailable.
            </p>
          ) : (summary?.recentActivity.length ?? 0) === 0 ? (
            <p className="m-0 text-xs text-[#8a94a6]">
              No check-in activity in this period.
            </p>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={headCellClass}>Action</th>
                  <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                    Timestamp (UTC)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(summary?.recentActivity ?? []).map((event) => (
                  <tr key={event.id}>
                    <td className={`${cellClass} pr-3 text-[#182235]`}>
                      {activityLabels[event.action]} – {event.employeeName}
                    </td>
                    <td
                      className={`${cellClass} text-right whitespace-nowrap text-[#8a94a6]`}
                    >
                      {formatDateTime(event.at, "UTC")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </AttendanceShell>
  )
}
