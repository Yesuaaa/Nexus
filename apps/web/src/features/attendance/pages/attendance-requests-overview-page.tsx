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
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  canAccessPersonalAttendance,
  canManageAttendance,
} from "@/features/auth/model/permissions"
import { humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendanceRequestSummary } from "../api/attendance-api"
import { leaveOverview } from "@/features/leave/api/leave-api"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"

const requestStatuses = ["PENDING", "VERIFIED", "APPROVED", "REJECTED"] as const

export function AttendanceRequestsOverviewPage() {
  const account = usePortalAccount()
  const manager = canManageAttendance(account)
  const selfService = canAccessPersonalAttendance(account)
  const [mine, setMine] = useState(!manager)
  const scope = manager && (!selfService || !mine) ? "team" : "mine"
  const result = useAsyncResource(
    (signal) => attendanceRequestSummary(scope, signal),
    [scope],
    { fallbackError: "Couldn't load request summaries." },
  )
  const leaveResult = useAsyncResource(
    (signal) => leaveOverview(scope, signal),
    [scope],
    { fallbackError: "Couldn't load leave request summaries." },
  )
  const data = result.loading || result.error ? undefined : result.data
  const groups = data?.groups ?? []
  const leaveGroups = leaveResult.data?.groups ?? []
  const leaveCount = leaveGroups.reduce((sum, group) => sum + group.count, 0)
  const total = groups.reduce((sum, group) => sum + group.count, 0) + leaveCount
  const countLeave = (status: (typeof leaveGroups)[number]["status"]) =>
    leaveGroups
      .filter((group) => group.status === status)
      .reduce((sum, group) => sum + group.count, 0)
  const countRequests = (status: (typeof requestStatuses)[number]) =>
    groups
      .filter((group) => group.status === status)
      .reduce((sum, group) => sum + group.count, 0) +
    (status === "PENDING" ? countLeave("SUBMITTED") : countLeave(status))
  const overtimeCount = groups
    .filter((group) => group.type === "OVERTIME")
    .reduce((sum, group) => sum + group.count, 0)
  const correctionCount = groups
    .filter((group) => group.type === "CORRECTION")
    .reduce((sum, group) => sum + group.count, 0)
  const awaiting = groups.filter(
    (group) => group.status === "PENDING" || group.status === "VERIFIED",
  )
  const leaveAwaiting = leaveGroups
    .filter(
      (group) => group.status === "SUBMITTED" || group.status === "VERIFIED",
    )
    .map((group) => ({ ...group, type: "LEAVE" as const }))
  const attention = [...awaiting, ...leaveAwaiting]
  const awaitingCount = attention.reduce((sum, group) => sum + group.count, 0)
  const unavailable = Boolean(result.error || leaveResult.error)

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
      <ResourceStatus
        loading={false}
        error={result.error || leaveResult.error}
        retry={() => {
          result.retry()
          leaveResult.retry()
        }}
      />

      <FiguresRow
        label="Request figures"
        loading={result.loading}
        items={[
          {
            label: "Pending",
            value: unavailable ? "—" : String(countRequests("PENDING")),
            note: countRequests("PENDING") ? "Needs review" : undefined,
            tone: countRequests("PENDING") ? "warning" : undefined,
          },
          {
            label: "Awaiting HR",
            value: unavailable ? "—" : String(countRequests("VERIFIED")),
          },
          {
            label: "Approved",
            value: unavailable ? "—" : String(countRequests("APPROVED")),
          },
          {
            label: "Rejected",
            value: unavailable ? "—" : String(countRequests("REJECTED")),
            tone: countRequests("REJECTED") ? "danger" : undefined,
          },
        ]}
      />

      <Section
        title="Request status"
        aside={data ? `${total} total` : undefined}
        className="mt-7"
      >
        {result.loading ? (
          <RowsSkeleton rows={4} />
        ) : result.error ? (
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
              {requestStatuses.map((status) => {
                const count = countRequests(status)
                return (
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
                )
              })}
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
          const rows = requestStatuses.map((status) => ({
            status,
            count: groups
              .filter((group) => group.type === type && group.status === status)
              .reduce((sum, group) => sum + group.count, 0),
          }))
          return (
            <Section key={type} title={title} aside={`${count} total`}>
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
              {result.loading ? (
                <div className="mt-4">
                  <RowsSkeleton rows={3} />
                </div>
              ) : result.error ? (
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

      <Section title="Leave" aside={`${leaveCount} total`} className="mt-9">
        <p className="m-0 text-xs leading-5 text-[#65718a]">
          Whole-day leave verified by the department and finalized by HR.
        </p>
        <Button asChild variant="brandOutline" size="panel" className="mt-3">
          <Link href="/attendance/requests/leave">View leave requests</Link>
        </Button>
        {leaveResult.loading ? (
          <div className="mt-4">
            <RowsSkeleton rows={3} />
          </div>
        ) : leaveResult.error ? (
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
              {leaveGroups.map((group) => (
                <tr key={`${group.type}-${group.status}`}>
                  <td className={`${cellClass} text-[#182235]`}>
                    {humanizeEnum(group.status)}
                  </td>
                  <td className={`${cellClass} text-right tabular-nums`}>
                    {group.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Needs attention"
        aside={data ? `${awaitingCount} awaiting` : undefined}
        description="Requests awaiting department review or a final decision within the selected scope."
        className="mt-9"
      >
        {result.loading ? (
          <RowsSkeleton rows={2} />
        ) : result.error ? (
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
                key={group.type + group.status}
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
    </AttendanceShell>
  )
}
