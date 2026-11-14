"use client"
import Link from "next/link"
import { useState } from "react"
import { Clock3, LogIn, LogOut, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
  type ItemRow,
} from "@/components/ui/overview-panel"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import { formatDateTime } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"
import { personalAttendanceOverview } from "../api/attendance-api"
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
  const scopeLabel = "Personal"
  const metrics: StatStripItem[] = [
    {
      label: "Attendance days",
      value: data?.recordedDays.toLocaleString("en-US") ?? "0",
      caption: "Your recorded attendance workdays",
      icon: UsersRound,
      tone: "bg-[#e8eef8] text-[#284f9e]",
    },
    {
      label: "Check-ins",
      value: summary?.total.toLocaleString("en-US") ?? "0",
      caption: "Sessions started in selected workdays",
      icon: LogIn,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <SegmentMeter
          label="Check-in session status"
          segments={[
            {
              label: "Clocked in",
              value: summary?.working ?? 0,
              colorClass: "bg-[#284f9e]",
            },
            {
              label: "On unpaid break",
              value: summary?.onBreak ?? 0,
              colorClass: "bg-[#d69a24]",
            },
            {
              label: "Clocked out",
              value: summary?.closed ?? 0,
              colorClass: "bg-[#29906b]",
            },
          ]}
        />
      ),
    },
    {
      label: "Check-outs",
      value: summary?.closed.toLocaleString("en-US") ?? "0",
      caption: "Sessions with a recorded clock-out",
      captionTone: summary?.closed ? "text-[#25745b]" : undefined,
      icon: LogOut,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <ProgressMeter
          value={summary?.closed ?? 0}
          max={summary?.total ?? 0}
          label="Sessions with a recorded clock-out"
          colorClass="bg-[#29906b]"
        />
      ),
    },
    {
      label: "Still clocked in",
      value: summary
        ? (summary.working + summary.onBreak).toLocaleString("en-US")
        : "0",
      caption: "Open sessions, including unpaid breaks",
      captionTone:
        summary && summary.working + summary.onBreak > 0
          ? "text-[#9a5b00]"
          : undefined,
      icon: Clock3,
      tone: "bg-[#fbf0e2] text-[#a45b12]",
      meter: (
        <ProgressMeter
          value={(summary?.working ?? 0) + (summary?.onBreak ?? 0)}
          max={summary?.total ?? 0}
          label="Sessions still clocked in"
          colorClass="bg-[#d69a24]"
        />
      ),
    },
  ]
  const statuses = summary?.total
    ? [
        { id: "working", label: "Clocked in", value: summary.working },
        { id: "break", label: "On unpaid break", value: summary.onBreak },
        { id: "closed", label: "Clocked out", value: summary.closed },
      ]
    : []
  const context: ItemRow[] = [
    { id: "scope", label: "Reporting scope", note: scopeLabel },
    {
      id: "range",
      label: "Attendance workdays",
      note: range.from + " - " + range.to,
    },
    ...(data
      ? [
          {
            id: "asOf",
            label: "Last refreshed (UTC)",
            note: formatDateTime(data.asOf, "UTC"),
          },
        ]
      : []),
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
      <div className="grid gap-4">
        <StatStrip
          items={metrics}
          label="Attendance overview"
          pending={result.loading}
          unavailable={Boolean(result.error)}
        />
        <MiniStats
          label="Personal check-in figures"
          loading={result.loading}
          items={[
            {
              label: "Working now",
              value: summary?.working.toLocaleString("en-US") ?? "\u2014",
              hint: "Open sessions outside unpaid breaks",
            },
            {
              label: "On unpaid break",
              value: summary?.onBreak.toLocaleString("en-US") ?? "\u2014",
              hint: "Open sessions on a break",
            },
            {
              label: "Sessions per day",
              value:
                data && data.recordedDays > 0
                  ? (data.checkIns.total / data.recordedDays).toFixed(1)
                  : "\u2014",
              hint: "Across recorded attendance workdays",
            },
            {
              label: "Check-out rate",
              value: summary?.total
                ? `${Math.round((summary.closed / summary.total) * 100)}%`
                : "\u2014",
              hint: "Sessions with a recorded clock-out",
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Check-in status"
            description="Session status as of the last refresh, within the selected attendance workdays."
          >
            <BreakdownList
              rows={statuses}
              loading={result.loading}
              total={summary?.total}
              unit="sessions"
              empty={
                result.error
                  ? "Check-in summaries unavailable."
                  : "No check-ins in this period."
              }
              colorClass="bg-[#29906b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title={scopeLabel + " attendance"}
            description="Filters use the attendance workday. Overnight sessions retain their starting workday."
          >
            <ItemList
              rows={context}
              loading={result.loading}
              empty="No attendance context."
            />
          </OverviewPanel>
        </div>
        <OverviewPanel
          title="Recent check-in activity"
          description="Latest clock-in, clock-out, and break actions from the selected attendance workdays. Timestamps are shown in UTC."
        >
          <ItemList
            loading={result.loading}
            rows={(summary?.recentActivity ?? []).map((event) => ({
              id: event.id,
              label: activityLabels[event.action] + " - " + event.employeeName,
              note: formatDateTime(event.at, "UTC"),
            }))}
            empty={
              result.error
                ? "Recent activity unavailable."
                : "No check-in activity in this period."
            }
          />
        </OverviewPanel>
      </div>
    </AttendanceShell>
  )
}
