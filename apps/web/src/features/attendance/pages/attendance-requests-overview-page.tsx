"use client"

import Link from "next/link"
import { useState } from "react"
import { UserRound, UsersRound } from "lucide-react"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
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
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  canAccessPersonalAttendance,
  canManageAttendance,
} from "@/features/auth/model/permissions"
import { errorMessage } from "@/lib/error-message"
import { humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendanceRequestSummary } from "../api/attendance-api"
import { leaveOverview, type LeaveStatus } from "@/features/leave/api/leave-api"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"

const adjustmentStatuses = [
  "PENDING",
  "VERIFIED",
  "APPROVED",
  "REJECTED",
] as const

function useRequestSummary<T>(
  load: (signal: AbortSignal) => Promise<T>,
  fallbackError: string,
) {
  const resource = useAsyncResource(
    async (signal) => {
      try {
        return { data: await load(signal) }
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          return { denial: errorMessage(error, fallbackError) }
        throw error
      }
    },
    [],
    { fallbackError },
  )
  const current = resource.loading || resource.error ? undefined : resource.data
  return { ...resource, data: current?.data, denial: current?.denial }
}

export function AttendanceRequestsOverviewPage() {
  const account = usePortalAccount()
  const manager = canManageAttendance(account)
  const selfService = canAccessPersonalAttendance(account)
  const [mine, setMine] = useState(!manager)
  const scope = manager && (!selfService || !mine) ? "team" : "mine"

  return (
    <AttendanceShell tab="requests-overview">
      {manager && selfService && (
        <div className="mb-4 flex flex-wrap justify-end">
          <ManagementViewToggle
            active={mine}
            onChange={setMine}
            ariaLabel="Request summary view"
            views={[
              {
                value: false,
                label:
                  account.role !== "STAFF"
                    ? "Organization requests"
                    : "Department requests",
                icon: UsersRound,
              },
              { value: true, label: "My requests", icon: UserRound },
            ]}
          />
        </div>
      )}
      {/* Revisiting a scope requires a fresh authorization check. */}
      <RequestSummaries
        key={JSON.stringify([
          account.id,
          account.role,
          account.headOf?.id,
          scope,
        ])}
        scope={scope}
      />
    </AttendanceShell>
  )
}

function RequestSummaries({ scope }: { scope: "mine" | "team" }) {
  const result = useRequestSummary(
    (signal) => attendanceRequestSummary(scope, signal),
    "Couldn't load request summaries.",
  )
  const leaveResult = useRequestSummary(
    (signal) => leaveOverview(scope, signal),
    "Couldn't load leave request summaries.",
  )
  const denial = result.denial || leaveResult.denial
  const error = denial || result.error || leaveResult.error
  const loading = !error && (result.loading || leaveResult.loading)
  const data = denial ? undefined : result.data
  const leaveData = denial ? undefined : leaveResult.data
  const complete = Boolean(data && leaveData)
  const groups = data?.groups ?? []
  const leaveGroups = leaveData?.groups ?? []
  const leaveCounts: Record<LeaveStatus, number> = {
    SUBMITTED: 0,
    VERIFIED: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    REVERSED: 0,
  }
  for (const { status, count } of leaveGroups) leaveCounts[status] += count
  const leaveRows = Object.entries(leaveCounts).filter(([, count]) => count > 0)
  const leaveCount = leaveRows.reduce((sum, [, count]) => sum + count, 0)
  const requestCounts = {
    PENDING: leaveCounts.SUBMITTED,
    VERIFIED: leaveCounts.VERIFIED,
    APPROVED: leaveCounts.APPROVED,
    REJECTED: leaveCounts.REJECTED,
    CANCELLED: leaveCounts.CANCELLED,
    REVERSED: leaveCounts.REVERSED,
  }
  for (const { status, count } of groups) requestCounts[status] += count
  const statusRows = Object.entries(requestCounts)
  const total = statusRows.reduce((sum, [, count]) => sum + count, 0)
  const overtimeCount = groups
    .filter((group) => group.type === "OVERTIME")
    .reduce((sum, group) => sum + group.count, 0)
  const correctionCount = groups
    .filter((group) => group.type === "CORRECTION")
    .reduce((sum, group) => sum + group.count, 0)
  const awaiting = groups.filter(
    (group) => group.status === "PENDING" || group.status === "VERIFIED",
  )
  const leaveAwaiting = (["SUBMITTED", "VERIFIED"] as const)
    .map((status) => ({ type: "LEAVE", status, count: leaveCounts[status] }))
    .filter(({ count }) => count > 0)
  const attention = [...awaiting, ...leaveAwaiting]
  const awaitingCount = attention.reduce((sum, group) => sum + group.count, 0)
  const pending = complete ? requestCounts.PENDING : 0
  const rejected = complete ? requestCounts.REJECTED : 0

  return (
    <>
      <ResourceStatus
        loading={false}
        error={error}
        retry={() => {
          if (denial || result.error) result.retry()
          if (denial || leaveResult.error) leaveResult.retry()
        }}
      />

      <FiguresRow
        label="Request figures"
        loading={loading}
        items={[
          {
            label: "Pending",
            value: complete ? String(pending) : "—",
            note: pending ? "Needs review" : undefined,
            tone: pending ? "warning" : undefined,
          },
          {
            label: "Awaiting HR",
            value: complete ? String(requestCounts.VERIFIED) : "—",
          },
          {
            label: "Approved",
            value: complete ? String(requestCounts.APPROVED) : "—",
          },
          {
            label: "Rejected",
            value: complete ? String(rejected) : "—",
            tone: rejected ? "danger" : undefined,
          },
        ]}
      />

      <Section
        title="Request status"
        aside={complete ? `${total} total` : undefined}
        className="mt-7"
      >
        {loading ? (
          <RowsSkeleton rows={statusRows.length} />
        ) : !complete ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Request summaries unavailable.
          </p>
        ) : total === 0 ? (
          <p className="m-0 text-xs text-[#8a94a6]">
            No requests in this scope.
          </p>
        ) : (
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCellClass}>Status</th>
                <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                  Requests
                </th>
                <th className="w-[45%] border-b border-[#e3e7ed] pb-2 pl-5 text-left text-[11px] font-medium text-[#738096]">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {statusRows.map(([status, count]) => (
                <tr key={status}>
                  <td className={`${cellClass} font-medium text-[#182235]`}>
                    {humanizeEnum(status)}
                  </td>
                  <td className={`${cellClass} text-right tabular-nums`}>
                    {count}
                  </td>
                  <td className={`${cellClass} pl-5`}>
                    <span className="flex items-center gap-3">
                      <InlineBar
                        value={count}
                        max={total}
                        label={`${humanizeEnum(status)}: ${count} requests`}
                        className="min-w-12 flex-1"
                      />
                      <span className="w-8 text-right text-[#8a94a6] tabular-nums">
                        {Math.round((count / total) * 100)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-2">
        {(
          [
            {
              type: "OVERTIME" as const,
              title: "Overtime",
              description:
                "Submitted at clock-out, verified by the department, then finalized by HR.",
              href: "/attendance/requests/overtime",
              count: overtimeCount,
            },
            {
              type: "CORRECTION" as const,
              title: "Corrections",
              description:
                "Missing or incorrect attendance; approval updates the underlying record.",
              href: "/attendance/requests/corrections",
              count: correctionCount,
            },
          ] as const
        ).map(({ type, title, description, href, count }) => {
          const rows = adjustmentStatuses.map((status) => ({
            status,
            count: groups
              .filter((group) => group.type === type && group.status === status)
              .reduce((sum, group) => sum + group.count, 0),
          }))
          return (
            <Section
              key={type}
              title={title}
              aside={data ? `${count} total` : undefined}
            >
              <p className="m-0 text-xs leading-5 text-[#65718a]">
                {description}
              </p>
              <Button
                asChild
                variant="brandOutline"
                size="panel"
                className="mt-3"
              >
                <Link href={href}>View requests</Link>
              </Button>
              {!denial && result.loading ? (
                <div className="mt-4">
                  <RowsSkeleton rows={3} />
                </div>
              ) : !data ? (
                <p className="mt-4 mb-0 text-xs leading-5 text-[#65718a]">
                  Request summaries unavailable.
                </p>
              ) : count === 0 ? (
                <p className="mt-4 mb-0 text-xs text-[#8a94a6]">
                  No requests in this scope.
                </p>
              ) : (
                <table className={`${tableClass} mt-4`}>
                  <thead>
                    <tr>
                      <th className={headCellClass}>Status</th>
                      <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                        Requests
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((row) => row.count > 0)
                      .map((row) => (
                        <tr key={row.status}>
                          <td className={`${cellClass} text-[#182235]`}>
                            {humanizeEnum(row.status)}
                          </td>
                          <td
                            className={`${cellClass} text-right tabular-nums`}
                          >
                            {row.count}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </Section>
          )
        })}
      </div>

      <Section
        title="Leave"
        aside={leaveData ? `${leaveCount} total` : undefined}
        className="mt-9"
      >
        <p className="m-0 text-xs leading-5 text-[#65718a]">
          Whole-day leave verified by the department and finalized by HR.
        </p>
        <Button asChild variant="brandOutline" size="panel" className="mt-3">
          <Link href="/attendance/requests/leave">View leave requests</Link>
        </Button>
        {!denial && leaveResult.loading ? (
          <div className="mt-4">
            <RowsSkeleton rows={3} />
          </div>
        ) : !leaveData ? (
          <p className="mt-4 mb-0 text-xs text-[#65718a]">
            Leave request summaries unavailable.
          </p>
        ) : leaveCount === 0 ? (
          <p className="mt-4 mb-0 text-xs text-[#8a94a6]">
            No leave requests in this scope.
          </p>
        ) : (
          <table className={`${tableClass} mt-4`}>
            <thead>
              <tr>
                <th className={headCellClass}>Status</th>
                <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                  Requests
                </th>
              </tr>
            </thead>
            <tbody>
              {leaveRows.map(([status, count]) => (
                <tr key={status}>
                  <td className={`${cellClass} text-[#182235]`}>
                    {humanizeEnum(status)}
                  </td>
                  <td className={`${cellClass} text-right tabular-nums`}>
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Needs attention"
        aside={complete ? `${awaitingCount} awaiting` : undefined}
        description="Requests awaiting department review or a final decision within the selected scope."
        className="mt-9"
      >
        {loading ? (
          <RowsSkeleton rows={2} />
        ) : !complete ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Request summaries unavailable.
          </p>
        ) : attention.length === 0 ? (
          <p className="m-0 text-xs text-[#25745b]">
            No requests are awaiting a decision in this scope.
          </p>
        ) : (
          <dl className="m-0 grid gap-2 text-xs">
            {attention.map((group) => (
              <div
                key={`${group.type}-${group.status}`}
                className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5"
              >
                <dt className="w-32 shrink-0 text-[#805316]">
                  {humanizeEnum(group.type)}
                </dt>
                <dd className="m-0 text-[#182235]">
                  {group.count}{" "}
                  {group.status === "VERIFIED" ? "awaiting HR" : "pending"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
    </>
  )
}
