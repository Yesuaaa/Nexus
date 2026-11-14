"use client"
import Link from "next/link"
import { ProgressMeter, StatStrip } from "@/components/ui/stat-strip"
import { useState } from "react"
import {
  UserRound,
  UsersRound,
  Clock3,
  BadgeCheck,
  CircleCheck,
  CircleX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  OverviewPanel,
  BreakdownList,
  ItemList,
  MiniStats,
} from "@/components/ui/overview-panel"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canManageAttendance } from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import { humanizeEnum } from "@/lib/format"
import { attendanceRequestSummary } from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"

export function AttendanceRequestsOverviewPage() {
  const account = usePortalAccount()
  const manager = canManageAttendance(account)
  const [mine, setMine] = useState(!manager)
  const scope = !manager || mine ? "mine" : "team"
  const result = useAsyncResource(
    (signal) => attendanceRequestSummary(scope, signal),
    [scope],
    { fallbackError: "Couldn't load request summaries." },
  )
  const data = result.loading || result.error ? undefined : result.data
  const groups = data?.groups ?? []
  const total = groups.reduce((sum, group) => sum + group.count, 0)
  const awaiting = groups.filter(
    (group) => group.status === "PENDING" || group.status === "VERIFIED",
  )
  return (
    <AttendanceShell tab="requests-overview">
      {manager && (
        <div className="mb-4 flex flex-wrap justify-end">
          <ManagementViewToggle
            active={mine}
            onChange={setMine}
            ariaLabel="Request summary view"
            views={[
              {
                value: false,
                label:
                  account.role === "ADMIN"
                    ? "Organization requests"
                    : "Department requests",
                icon: UsersRound,
              },
              { value: true, label: "My requests", icon: UserRound },
            ]}
          />
        </div>
      )}
      <ResourceStatus
        loading={false}
        error={result.error}
        retry={result.retry}
      />
      <div className="grid gap-4">
        <StatStrip
          label="Request totals"
          pending={result.loading}
          unavailable={Boolean(result.error)}
          items={["PENDING", "VERIFIED", "APPROVED", "REJECTED"].map(
            (status, index) => {
              const count = groups
                .filter((group) => group.status === status)
                .reduce((sum, group) => sum + group.count, 0)
              return {
                icon:
                  [Clock3, BadgeCheck, CircleCheck, CircleX][index] ?? Clock3,
                tone:
                  status === "APPROVED"
                    ? "bg-[#e6f4ee] text-[#25745b]"
                    : status === "REJECTED"
                      ? "bg-[#fbe9ee] text-[#b4234d]"
                      : status === "PENDING"
                        ? "bg-[#fbf0e2] text-[#a45b12]"
                        : "bg-[#efebf8] text-[#6552a6]",
                label: humanizeEnum(status),
                value: data ? count.toLocaleString("en-US") : "\u2014",
                caption:
                  status === "VERIFIED"
                    ? "Overtime awaiting HR"
                    : "All history within selected scope",
                captionTone:
                  count > 0
                    ? status === "APPROVED"
                      ? "text-[#25745b]"
                      : status === "REJECTED"
                        ? "text-[#b4234d]"
                        : status === "PENDING"
                          ? "text-[#9a5b00]"
                          : undefined
                    : undefined,
                meter: (
                  <ProgressMeter
                    value={count}
                    max={total}
                    label={`${humanizeEnum(status)} attendance requests`}
                    colorClass={
                      status === "APPROVED"
                        ? "bg-[#29906b]"
                        : status === "REJECTED"
                          ? "bg-[#c94a6a]"
                          : status === "PENDING"
                            ? "bg-[#d69a24]"
                            : "bg-[#6552a6]"
                    }
                  />
                ),
              }
            },
          )}
        />
        <MiniStats
          label="Request figures"
          loading={result.loading}
          items={[
            {
              label: "Total requests",
              value: data ? total.toLocaleString("en-US") : "\u2014",
              hint: "All history within selected scope",
            },
            {
              label: "Overtime requests",
              value: data
                ? groups
                    .filter((group) => group.type === "OVERTIME")
                    .reduce((sum, group) => sum + group.count, 0)
                    .toLocaleString("en-US")
                : "\u2014",
              hint: "Across all decision statuses",
            },
            {
              label: "Correction requests",
              value: data
                ? groups
                    .filter((group) => group.type === "CORRECTION")
                    .reduce((sum, group) => sum + group.count, 0)
                    .toLocaleString("en-US")
                : "\u2014",
              hint: "Across all decision statuses",
            },
            {
              label: "Awaiting a decision",
              value: data
                ? awaiting
                    .reduce((sum, group) => sum + group.count, 0)
                    .toLocaleString("en-US")
                : "\u2014",
              hint: "Pending and verified requests",
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {(["OVERTIME", "CORRECTION"] as const).map((type) => (
            <OverviewPanel
              key={type}
              title={type === "OVERTIME" ? "Overtime" : "Corrections"}
              description={
                type === "OVERTIME"
                  ? "Submitted at clock-out, verified by the department, then finalized by HR."
                  : "Missing or incorrect attendance; approval updates the underlying record."
              }
              action={
                <Button asChild variant="brandOutline" size="panel">
                  <Link
                    href={
                      type === "OVERTIME"
                        ? "/attendance/requests/overtime"
                        : "/attendance/requests/corrections"
                    }
                  >
                    View requests
                  </Link>
                </Button>
              }
            >
              <BreakdownList
                loading={result.loading}
                rows={groups
                  .filter((g) => g.type === type)
                  .map((g) => ({
                    id: g.status,
                    label: humanizeEnum(g.status),
                    value: g.count,
                  }))}
                unit="requests"
                total={groups
                  .filter((group) => group.type === type)
                  .reduce((sum, group) => sum + group.count, 0)}
                colorClass={
                  type === "OVERTIME" ? "bg-[#6552a6]" : "bg-[#284f9e]"
                }
                empty={
                  result.error
                    ? "Request summaries unavailable."
                    : "No requests in this scope."
                }
              />
            </OverviewPanel>
          ))}
        </div>
        <OverviewPanel
          title="Needs attention"
          description="Requests still awaiting department review or a final decision within the selected scope."
        >
          <ItemList
            loading={result.loading}
            rows={awaiting.map((group) => ({
              id: group.type + group.status,
              label: humanizeEnum(group.type),
              note:
                group.count.toLocaleString("en-US") +
                (group.status === "VERIFIED" ? " awaiting HR" : " pending"),
              tone: "warning",
            }))}
            empty={
              result.error
                ? "Request summaries unavailable."
                : "No requests are awaiting a decision in this scope."
            }
            emptyTone={data ? "success" : "muted"}
          />
        </OverviewPanel>
      </div>
    </AttendanceShell>
  )
}
