"use client"
import { UsersRound, LogIn, Clock3, CalendarDays } from "lucide-react"
import { SegmentMeter, StatStrip } from "@/components/ui/stat-strip"
import { useState } from "react"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  OverviewPanel,
  BreakdownList,
  MiniStats,
} from "@/components/ui/overview-panel"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canConfigureAttendance } from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import { humanizeEnum } from "@/lib/format"
import {
  attendanceOverview,
  attendanceDepartments,
  attendanceAudit,
  attendanceRequestSummary,
  attendancePolicies,
} from "../api/attendance-api"
import { defaultRange } from "../model/attendance"
import { AttendanceShell } from "../components/attendance-shell"
import { RangeFields, ResourceStatus } from "../components/attendance-shared"

export function AttendanceDashboardPage() {
  const account = usePortalAccount()
  const [range, setRange] = useState(defaultRange)
  const [departmentId, setDepartmentId] = useState("")
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const summary = useAsyncResource(
    (signal) => attendanceOverview(range.from, range.to, departmentId, signal),
    [range.from, range.to, departmentId],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load attendance summaries.",
    },
  )
  const audit = useAsyncResource(
    (signal) =>
      attendanceAudit(range.from, range.to, 1, "", departmentId, signal, true),
    [range.from, range.to, departmentId],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load audit summaries.",
    },
  )
  const requests = useAsyncResource(
    (signal) => attendanceRequestSummary("team", signal),
    [],
    { fallbackError: "Couldn't load request summaries." },
  )
  const policies = useAsyncResource(attendancePolicies, [], {
    enabled: canConfigureAttendance(account),
    fallbackError: "Couldn't load policy summaries.",
  })
  const data = summary.loading || summary.error ? undefined : summary.data
  const history = audit.loading || audit.error ? undefined : audit.data
  const requestData =
    requests.loading || requests.error ? undefined : requests.data
  const policyData =
    policies.loading || policies.error ? undefined : policies.data
  const totalRequests = requestData?.groups.reduce(
    (sum, group) => sum + group.count,
    0,
  )
  const awaitingDecision = requestData?.groups
    .filter(
      (group) => group.status === "PENDING" || group.status === "VERIFIED",
    )
    .reduce((sum, group) => sum + group.count, 0)
  return (
    <AttendanceShell tab="dashboard">
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <RangeFields
          {...range}
          onChange={(from, to) => setRange({ from, to })}
        />
        <FilterSelect
          label="Dashboard department"
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
        error={summary.error}
        retry={summary.retry}
      />
      <div className="grid gap-4">
        <StatStrip
          label="Dashboard attendance figures"
          pending={summary.loading}
          unavailable={Boolean(summary.error)}
          items={[
            {
              icon: UsersRound,
              tone: "bg-[#e8eef8] text-[#284f9e]",
              label: "Employees recorded",
              value: data?.employees.toLocaleString("en-US") ?? "\u2014",
              caption: "Selected attendance workdays",
            },
            {
              icon: LogIn,
              tone: "bg-[#e6f4ee] text-[#25745b]",
              label: "Check-ins",
              value: data?.checkIns.total.toLocaleString("en-US") ?? "\u2014",
              caption: "Sessions in selected workdays",
              meter: (
                <SegmentMeter
                  label="Dashboard session status breakdown"
                  segments={[
                    {
                      label: "Clocked in",
                      value: data?.checkIns.working ?? 0,
                      colorClass: "bg-[#284f9e]",
                    },
                    {
                      label: "On unpaid break",
                      value: data?.checkIns.onBreak ?? 0,
                      colorClass: "bg-[#d69a24]",
                    },
                    {
                      label: "Clocked out",
                      value: data?.checkIns.closed ?? 0,
                      colorClass: "bg-[#29906b]",
                    },
                  ]}
                />
              ),
            },
            {
              icon: Clock3,
              tone: "bg-[#efebf8] text-[#6552a6]",
              label: "Worked hours",
              value: data?.workedHours.toFixed(2) ?? "\u2014",
              caption: "Unpaid breaks excluded",
            },
            {
              icon: CalendarDays,
              tone: "bg-[#fbf0e2] text-[#a45b12]",
              label: "Required hours",
              value: data?.requiredHours.toFixed(2) ?? "\u2014",
              caption: "Recorded workday requirements",
            },
          ]}
        />
        <MiniStats
          label="Dashboard summary figures"
          loading={summary.loading || audit.loading || requests.loading}
          items={[
            {
              label: "Attendance days",
              value: data?.recordedDays.toLocaleString("en-US") ?? "\u2014",
              hint: "Selected attendance workdays and department",
            },
            {
              label: "Check-outs",
              value: data?.checkIns.closed.toLocaleString("en-US") ?? "\u2014",
              hint: "Sessions in selected attendance workdays",
            },
            {
              label: "Record changes",
              value: history?.total.toLocaleString("en-US") ?? "\u2014",
              hint: "Selected UTC dates and department",
            },
            {
              label: "Awaiting a decision",
              value: awaitingDecision?.toLocaleString("en-US") ?? "\u2014",
              hint: "All request history in your permitted scope",
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Attendance and records"
            description="Selected workdays and department scope; overnight sessions retain their workday."
          >
            <BreakdownList
              loading={summary.loading}
              rows={
                data?.checkIns.total
                  ? [
                      {
                        id: "working",
                        label: "Clocked in",
                        value: data.checkIns.working,
                      },
                      {
                        id: "break",
                        label: "On unpaid break",
                        value: data.checkIns.onBreak,
                      },
                      {
                        id: "closed",
                        label: "Clocked out",
                        value: data.checkIns.closed,
                      },
                    ]
                  : []
              }
              unit="sessions"
              total={data?.checkIns.total}
              colorClass="bg-[#29906b]"
              empty={
                summary.error
                  ? "Attendance unavailable."
                  : "No recorded sessions."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Audit activity"
            description="Record changes in selected UTC dates and department scope."
          >
            <ResourceStatus
              loading={false}
              error={audit.error}
              retry={audit.retry}
            />
            <BreakdownList
              loading={audit.loading}
              rows={(history?.actionCounts ?? []).map((row) => ({
                id: row.action,
                label: humanizeEnum(row.action),
                value: row.count,
              }))}
              unit="events"
              total={history?.total}
              colorClass="bg-[#6552a6]"
              empty={
                audit.error
                  ? "Audit summaries unavailable."
                  : "No record changes in this period."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Requests and approvals"
            description="All request history in your organization or current department. The date and department filters above apply to attendance and audit summaries."
          >
            <ResourceStatus
              loading={false}
              error={requests.error}
              retry={requests.retry}
            />
            <BreakdownList
              loading={requests.loading}
              rows={(requestData?.groups ?? []).map((g) => ({
                id: g.type + g.status,
                label: humanizeEnum(g.type) + " - " + humanizeEnum(g.status),
                value: g.count,
              }))}
              unit="requests"
              total={totalRequests}
              colorClass="bg-[#d69a24]"
              empty={
                requests.error
                  ? "Request summaries unavailable."
                  : "No requests available."
              }
            />
          </OverviewPanel>
          {canConfigureAttendance(account) && (
            <OverviewPanel
              title="Policies and assignments"
              description="Current organization inventory. Assignment periods include current, scheduled, and ended history."
            >
              <ResourceStatus
                loading={false}
                error={policies.error}
                retry={policies.retry}
              />
              <BreakdownList
                loading={policies.loading}
                rows={
                  policyData
                    ? [
                        {
                          id: "active",
                          label: "Active policies",
                          value: policyData.summary.activePolicies,
                        },
                        {
                          id: "archived",
                          label: "Archived policies",
                          value: policyData.summary.archivedPolicies,
                        },
                        {
                          id: "assignments",
                          label: "Assignment periods",
                          value: policyData.summary.assignmentPeriods,
                        },
                      ]
                    : []
                }
                unit="records"
                empty={
                  policies.error
                    ? "Policy summaries unavailable."
                    : "No policies yet."
                }
              />
            </OverviewPanel>
          )}
        </div>
      </div>
    </AttendanceShell>
  )
}
