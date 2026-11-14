"use client"
import Link from "next/link"
import { Files, CircleCheck, Archive, UsersRound } from "lucide-react"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
} from "@/components/ui/stat-strip"
import { Button } from "@/components/ui/button"
import {
  OverviewPanel,
  BreakdownList,
  ItemList,
  MiniStats,
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
      <div className="grid gap-4">
        <StatStrip
          label="Policy inventory"
          pending={result.loading}
          unavailable={Boolean(result.error)}
          items={[
            {
              icon: Files,
              tone: "bg-[#e8eef8] text-[#284f9e]",
              label: "Total policies",
              value: data?.summary.totalPolicies.toLocaleString() ?? "\u2014",
              caption: "Entire policy inventory",
              meter: (
                <SegmentMeter
                  label="Policy inventory status"
                  segments={[
                    {
                      label: "Active",
                      value: data?.summary.activePolicies ?? 0,
                      colorClass: "bg-[#29906b]",
                    },
                    {
                      label: "Archived",
                      value: data?.summary.archivedPolicies ?? 0,
                      colorClass: "bg-[#6552a6]",
                    },
                  ]}
                />
              ),
            },
            {
              icon: CircleCheck,
              tone: "bg-[#e6f4ee] text-[#25745b]",
              label: "Active policies",
              value: data?.summary.activePolicies.toLocaleString() ?? "\u2014",
              caption: "Available for new assignments",
              captionTone: data?.summary.activePolicies
                ? "text-[#25745b]"
                : undefined,
              meter: (
                <ProgressMeter
                  value={data?.summary.activePolicies ?? 0}
                  max={data?.summary.totalPolicies ?? 0}
                  label="Active attendance policies"
                  colorClass="bg-[#29906b]"
                />
              ),
            },
            {
              icon: Archive,
              tone: "bg-[#efebf8] text-[#6552a6]",
              label: "Archived policies",
              value:
                data?.summary.archivedPolicies.toLocaleString() ?? "\u2014",
              caption: "Retained for history",
              meter: (
                <ProgressMeter
                  value={data?.summary.archivedPolicies ?? 0}
                  max={data?.summary.totalPolicies ?? 0}
                  label="Archived attendance policies"
                  colorClass="bg-[#6552a6]"
                />
              ),
            },
            {
              icon: UsersRound,
              tone: "bg-[#fbf0e2] text-[#a45b12]",
              label: "Assignment periods",
              value:
                data?.summary.assignmentPeriods.toLocaleString() ?? "\u2014",
              caption: "Current, scheduled, and ended periods",
            },
          ]}
        />
        <MiniStats
          label="Policy preview figures"
          loading={result.loading}
          items={[
            {
              label: "With assignment history",
              value: data
                ? withHistory.length.toLocaleString("en-US")
                : "\u2014",
              hint: "Among the latest 200 policies",
            },
            {
              label: "Active without history",
              value: data
                ? withoutHistory.length.toLocaleString("en-US")
                : "\u2014",
              hint: "Among the latest 200 policies",
            },
            {
              label: "Time zones represented",
              value: data
                ? new Set(
                    policies.map((policy) => policy.timeZone),
                  ).size.toLocaleString("en-US")
                : "\u2014",
              hint: "Among the latest 200 policies",
            },
            {
              label: "Newest policy",
              value: policies[0]?.name ?? "\u2014",
              hint: policies[0]?.timeZone,
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Policy status"
            description="Active and archived versions across the entire policy inventory."
          >
            <BreakdownList
              loading={result.loading}
              rows={
                data?.summary.totalPolicies
                  ? [
                      {
                        id: "active",
                        label: "Active",
                        value: data.summary.activePolicies,
                      },
                      {
                        id: "archived",
                        label: "Archived",
                        value: data.summary.archivedPolicies,
                      },
                    ]
                  : []
              }
              total={data?.summary.totalPolicies}
              unit="policies"
              colorClass="bg-[#29906b]"
              empty={
                result.error
                  ? "Policy summaries unavailable."
                  : "No policies yet."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Assignment history by policy"
            description="The latest 200 policies, ranked by assignment periods. Includes current, scheduled, and ended history, not current employee coverage."
            action={
              <Button asChild variant="brandOutline" size="panel">
                <Link href="/attendance/policies/assignments">
                  View assignments
                </Link>
              </Button>
            }
          >
            <BreakdownList
              loading={result.loading}
              rows={withHistory.slice(0, 8).map((policy) => ({
                id: policy.id,
                label: policy.name,
                value: policy._count?.assignments ?? 0,
              }))}
              unit="assignment periods"
              colorClass="bg-[#6552a6]"
              empty={
                result.error
                  ? "Assignment history unavailable."
                  : "No assignment history among the latest policies."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Recent policy inventory"
            description="The eight most recently created policies and their assignment history."
          >
            <ItemList
              loading={result.loading}
              rows={policies.slice(0, 8).map((policy) => ({
                id: policy.id,
                label: policy.name,
                note:
                  (policy.archivedAt ? "Archived" : "Active") +
                  " - " +
                  (policy._count?.assignments ?? 0) +
                  " assignment periods",
                tone: "muted",
              }))}
              empty={
                result.error
                  ? "Policy inventory unavailable."
                  : "No policies. Open Management to create a policy."
              }
            />
          </OverviewPanel>
          <OverviewPanel
            title="Active policies without assignment history"
            description="Active versions among the latest 200 policies with no recorded assignment periods."
          >
            <ItemList
              loading={result.loading}
              rows={withoutHistory.map((policy) => ({
                id: policy.id,
                label: policy.name,
                note: "No assignment history",
                tone: "warning",
              }))}
              empty={
                result.error
                  ? "Policy summaries unavailable."
                  : "No active policies without assignment history in this preview."
              }
              emptyTone={data ? "success" : "muted"}
            />
          </OverviewPanel>
        </div>
      </div>
    </AttendanceShell>
  )
}
