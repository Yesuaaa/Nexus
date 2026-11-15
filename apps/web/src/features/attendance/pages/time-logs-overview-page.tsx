"use client"
import Link from "next/link"
import { LogIn, LogOut, Clock3, History } from "lucide-react"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
} from "@/components/ui/stat-strip"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  OverviewPanel,
  BreakdownList,
  ItemList,
  MiniStats,
} from "@/components/ui/overview-panel"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"
import {
  attendanceOverview,
  attendanceDepartments,
  attendanceAudit,
} from "../api/attendance-api"
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
  const audit = useAsyncResource(
    (signal) =>
      attendanceAudit(range.from, range.to, 1, "", departmentId, signal, true),
    [range.from, range.to, departmentId],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load record-change activity.",
    },
  )
  const data = result.loading || result.error ? undefined : result.data
  const sessions = data?.checkIns
  const history = audit.loading || audit.error ? undefined : audit.data
  return (
    <AttendanceShell
      tab="logs-overview"
      actions={
        <>
          <Button
            variant="brandOutline"
            size="header"
            disabled={result.loading || audit.loading}
            onClick={() => {
              result.retry()
              audit.retry()
            }}
          >
            Refresh
          </Button>
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
            ...(departments.data?.departments ?? []).map((d) => ({
              value: d.id,
              label: d.name,
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
      <ResourceStatus loading={false} error={audit.error} retry={audit.retry} />
      <div className="grid gap-4">
        <StatStrip
          label="Record activity figures"
          pending={result.loading || audit.loading}
          unavailable={Boolean(result.error && audit.error)}
          items={[
            {
              icon: LogIn,
              tone: "bg-[#e8eef8] text-[#284f9e]",
              label: "Check-ins",
              value: sessions?.total.toLocaleString("en-US") ?? "\u2014",
              caption: result.error
                ? "Data unavailable"
                : "Sessions in selected attendance workdays",
              meter: sessions && (
                <SegmentMeter
                  label="Recorded session status breakdown"
                  segments={[
                    {
                      label: "Clocked in",
                      value: sessions.working,
                      colorClass: "bg-[#284f9e]",
                    },
                    {
                      label: "On unpaid break",
                      value: sessions.onBreak,
                      colorClass: "bg-[#d69a24]",
                    },
                    {
                      label: "Clocked out",
                      value: sessions.closed,
                      colorClass: "bg-[#29906b]",
                    },
                  ]}
                />
              ),
            },
            {
              icon: LogOut,
              tone: "bg-[#e6f4ee] text-[#25745b]",
              label: "Check-outs",
              value: sessions?.closed.toLocaleString("en-US") ?? "\u2014",
              caption: result.error
                ? "Data unavailable"
                : "Sessions with a recorded clock-out",
              captionTone: sessions?.closed ? "text-[#25745b]" : undefined,
              meter: sessions && (
                <ProgressMeter
                  value={sessions.closed}
                  max={sessions.total}
                  label="Recorded sessions with a clock-out"
                  colorClass="bg-[#29906b]"
                />
              ),
            },
            {
              icon: Clock3,
              tone: "bg-[#fbf0e2] text-[#a45b12]",
              label: "Still clocked in",
              value: sessions
                ? (sessions.working + sessions.onBreak).toLocaleString("en-US")
                : "\u2014",
              caption: result.error
                ? "Data unavailable"
                : "Open sessions, including unpaid breaks",
              captionTone:
                sessions && sessions.working + sessions.onBreak > 0
                  ? "text-[#9a5b00]"
                  : undefined,
              meter: sessions && (
                <ProgressMeter
                  value={sessions.working + sessions.onBreak}
                  max={sessions.total}
                  label="Recorded sessions still clocked in"
                  colorClass="bg-[#d69a24]"
                />
              ),
            },
            {
              icon: History,
              tone: "bg-[#efebf8] text-[#6552a6]",
              label: "Record changes",
              value: history?.total.toLocaleString("en-US") ?? "\u2014",
              caption: audit.error
                ? "Data unavailable"
                : "Audit events in selected UTC dates",
            },
          ]}
        />
        <MiniStats
          label="Time log figures"
          loading={result.loading || audit.loading}
          items={[
            {
              label: "Employees recorded",
              value: sessions?.employees.toLocaleString("en-US") ?? "\u2014",
              hint: "Employees with recorded sessions",
            },
            {
              label: "Attendance days",
              value: data?.recordedDays.toLocaleString("en-US") ?? "\u2014",
              hint: "Recorded employee workdays",
            },
            {
              label: "Sessions per employee",
              value: sessions?.employees
                ? (sessions.total / sessions.employees).toFixed(1)
                : "\u2014",
              hint: "Across employees with recorded sessions",
            },
            {
              label: "Change types",
              value:
                history?.actionCounts.length.toLocaleString("en-US") ??
                "\u2014",
              hint: "Distinct actions in selected UTC dates",
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Recorded session status"
            description="Status as of the last refresh, within the selected attendance workdays. Overnight sessions retain their starting workday."
          >
            <BreakdownList
              loading={result.loading}
              rows={
                sessions?.total
                  ? [
                      {
                        id: "working",
                        label: "Clocked in",
                        value: sessions.working,
                      },
                      {
                        id: "break",
                        label: "On unpaid break",
                        value: sessions.onBreak,
                      },
                      {
                        id: "closed",
                        label: "Clocked out",
                        value: sessions.closed,
                      },
                    ]
                  : []
              }
              unit="sessions"
              total={sessions?.total}
              empty={
                result.error
                  ? "Record summaries unavailable."
                  : "No check-ins in this period."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Record-change summary"
            description="Recorded changes to attendance workdays, sessions, and breaks. Dates filter UTC event timestamps."
            action={
              <Button asChild variant="brandOutline" size="panel">
                <Link href="/attendance/time-logs/audit">Open audit trail</Link>
              </Button>
            }
          >
            <BreakdownList
              loading={audit.loading}
              rows={(history?.actionCounts ?? []).map((row) => ({
                id: row.action,
                label: humanizeEnum(row.action),
                value: row.count,
              }))}
              unit="events"
              total={history?.total}
              empty={
                audit.error
                  ? "Record-change summaries unavailable."
                  : "No record changes in this period."
              }
            />
          </OverviewPanel>
        </div>
        <OverviewPanel
          title="Recent record activity"
          description="Latest attendance record changes in the selected UTC dates and permitted scope. Times are shown in UTC."
        >
          <ItemList
            loading={audit.loading}
            rows={(history?.events ?? []).slice(0, 8).map((event) => ({
              id: event.id,
              label:
                humanizeEnum(event.action) +
                " - " +
                humanizeEnum(
                  event.entityType.replace(/([a-z])([A-Z])/g, "$1_$2"),
                ) +
                " - " +
                (event.employee?.fullName ?? "Employee unavailable"),
              note: formatDateTime(event.createdAt, "UTC"),
            }))}
            empty={
              audit.error
                ? "Recent record activity unavailable."
                : "No record changes in this period."
            }
          />
        </OverviewPanel>
      </div>
    </AttendanceShell>
  )
}
