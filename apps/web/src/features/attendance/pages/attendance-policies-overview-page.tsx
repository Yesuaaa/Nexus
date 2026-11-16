"use client"

import Link from "next/link"
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
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendancePolicies } from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"

export function AttendancePoliciesOverviewPage() {
  const result = useAsyncResource(attendancePolicies, [], {
    fallbackError: "Couldn't load policy summaries.",
  })
  const data = result.loading || result.error ? undefined : result.data
  const policies = data?.policies ?? []
  const totalPolicies = data?.summary.totalPolicies ?? 0
  const activePolicies = data?.summary.activePolicies ?? 0
  const archivedPolicies = data?.summary.archivedPolicies ?? 0
  const assignmentPeriods = data?.summary.assignmentPeriods ?? 0
  const withHistory = policies
    .filter((policy) => (policy._count?.assignments ?? 0) > 0)
    .sort(
      (a, b) =>
        (b._count?.assignments ?? 0) - (a._count?.assignments ?? 0) ||
        a.name.localeCompare(b.name),
    )
  const withoutHistory = policies
    .filter(
      (policy) => !policy.archivedAt && (policy._count?.assignments ?? 0) === 0,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const maxAssignments = Math.max(
    1,
    ...withHistory.map((policy) => policy._count?.assignments ?? 0),
  )
  const unavailable = Boolean(result.error)

  return (
    <AttendanceShell
      tab="policies-overview"
      actions={
        <Button asChild variant="brandOutline" size="header">
          <Link href="/attendance/policies/management">Manage policies</Link>
        </Button>
      }
    >
      <ResourceStatus
        loading={false}
        error={result.error}
        retry={result.retry}
      />

      <FiguresRow
        label="Policy figures"
        loading={result.loading}
        items={[
          {
            label: "Policies",
            value: unavailable ? "—" : String(totalPolicies),
          },
          {
            label: "Active",
            value: unavailable ? "—" : String(activePolicies),
          },
          {
            label: "Archived",
            value: unavailable ? "—" : String(archivedPolicies),
          },
          {
            label: "Assignment periods",
            value: unavailable ? "—" : String(assignmentPeriods),
          },
        ]}
      />

      <Section
        title="Policy status"
        aside={data ? `${totalPolicies} total` : undefined}
        className="mt-7"
      >
        {result.loading ? (
          <RowsSkeleton rows={2} />
        ) : result.error ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Policy summaries unavailable.
          </p>
        ) : totalPolicies === 0 ? (
          <p className="m-0 text-xs text-[#8a94a6]">No policies yet.</p>
        ) : (
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCellClass}>Status</th>
                <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                  Policies
                </th>
                <th className="w-[45%] border-b border-[#e3e7ed] pb-2 pl-5 text-left text-[11px] font-medium text-[#738096]">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Active", value: activePolicies },
                { label: "Archived", value: archivedPolicies },
              ].map((status) => (
                <tr key={status.label}>
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
                        max={totalPolicies}
                        label={`${status.label}: ${status.value} policies`}
                        className="min-w-12 flex-1"
                      />
                      <span className="w-8 text-right text-[#8a94a6] tabular-nums">
                        {Math.round((status.value / totalPolicies) * 100)}%
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
        <Section
          title="Assignment history by policy"
          aside={`${withHistory.length} policies`}
        >
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            The latest 200 policies, ranked by current, scheduled, and ended
            assignment periods.
          </p>
          <Button asChild variant="brandOutline" size="panel" className="mt-3">
            <Link href="/attendance/policies/management">
              Open policy management
            </Link>
          </Button>
          {result.loading ? (
            <div className="mt-4">
              <RowsSkeleton rows={5} />
            </div>
          ) : result.error ? (
            <p className="mt-4 mb-0 text-xs leading-5 text-[#65718a]">
              Assignment history unavailable.
            </p>
          ) : withHistory.length === 0 ? (
            <p className="mt-4 mb-0 text-xs text-[#8a94a6]">
              No assignment history among the latest policies.
            </p>
          ) : (
            <table className={`${tableClass} mt-4`}>
              <thead>
                <tr>
                  <th className={headCellClass}>Policy</th>
                  <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                    Periods
                  </th>
                  <th className="w-[45%] border-b border-[#e3e7ed] pb-2 pl-5 text-left text-[11px] font-medium text-[#738096]">
                    Relative
                  </th>
                </tr>
              </thead>
              <tbody>
                {withHistory.slice(0, 8).map((policy) => {
                  const count = policy._count?.assignments ?? 0
                  return (
                    <tr key={policy.id}>
                      <td
                        className={`${cellClass} pr-3 font-medium text-[#182235]`}
                      >
                        {policy.name}
                      </td>
                      <td className={`${cellClass} text-right tabular-nums`}>
                        {count}
                      </td>
                      <td className={`${cellClass} pl-5`}>
                        <InlineBar
                          value={count}
                          max={maxAssignments}
                          label={`${policy.name}: ${count} assignment periods`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Recent policy inventory"
          aside={`${policies.length} shown`}
        >
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            The latest eight policies and their assignment history.
          </p>
          {result.loading ? (
            <div className="mt-4">
              <RowsSkeleton rows={5} />
            </div>
          ) : result.error ? (
            <p className="mt-4 mb-0 text-xs leading-5 text-[#65718a]">
              Policy inventory unavailable.
            </p>
          ) : policies.length === 0 ? (
            <p className="mt-4 mb-0 text-xs text-[#8a94a6]">
              No policies. Open Management to create a policy.
            </p>
          ) : (
            <table className={`${tableClass} mt-4`}>
              <thead>
                <tr>
                  <th className={headCellClass}>Policy</th>
                  <th className="border-b border-[#e3e7ed] pb-2 text-left text-[11px] font-medium text-[#738096] max-[560px]:hidden">
                    Time zone
                  </th>
                  <th className="border-b border-[#e3e7ed] pb-2 text-right text-[11px] font-medium text-[#738096]">
                    History
                  </th>
                </tr>
              </thead>
              <tbody>
                {policies.slice(0, 8).map((policy) => (
                  <tr key={policy.id}>
                    <td className={`${cellClass} pr-3`}>
                      <span className="font-medium text-[#182235]">
                        {policy.name}
                      </span>
                      <span className="ml-2 text-[11px] text-[#8a94a6]">
                        {policy.archivedAt ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td
                      className={`${cellClass} text-[#3b4658] max-[560px]:hidden`}
                    >
                      {policy.timeZone}
                    </td>
                    <td className={`${cellClass} text-right tabular-nums`}>
                      {policy._count?.assignments ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section
        title="Active policies without assignment history"
        aside={data ? `${withoutHistory.length} policies` : undefined}
        description="Active versions among the latest 200 policies with no recorded assignment periods."
        className="mt-9"
      >
        {result.loading ? (
          <RowsSkeleton rows={3} />
        ) : result.error ? (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            Policy summaries unavailable.
          </p>
        ) : withoutHistory.length === 0 ? (
          <p className="m-0 text-xs text-[#25745b]">
            No active policies without assignment history in this preview.
          </p>
        ) : (
          <dl className="m-0 grid gap-2 text-xs">
            {withoutHistory.map((policy) => (
              <div
                key={policy.id}
                className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5"
              >
                <dt className="w-48 shrink-0 text-[#805316]">{policy.name}</dt>
                <dd className="m-0 text-[#182235]">No assignment history</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
    </AttendanceShell>
  )
}
