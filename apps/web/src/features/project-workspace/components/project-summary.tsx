"use client"

import {
  ClipboardList,
  FileText,
  ListChecks,
  MessageSquareText,
} from "lucide-react"
import Link from "next/link"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { MemberIdentity } from "@/components/ui/member-identity"
import {
  ItemList,
  MiniStats,
  OverviewPanel,
  Section,
} from "@/components/ui/overview-panel"
import { Pill } from "@/components/ui/pill"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  ProgressMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"
import {
  getProjectOverviewAttention,
  summarizeProjectOverview,
  type ProjectOverviewSection,
} from "../model/project-overview-summary"

export function ProjectSummary({
  workspace,
  sectionHref,
  departmentName,
  readOnly = false,
}: {
  workspace: ProjectWorkspaceDetail
  sectionHref: (section: ProjectOverviewSection) => string
  departmentName?: string | null
  readOnly?: boolean
}) {
  const account = usePortalAccount()
  const { formatDate } = useDatePreferences()
  const summary = summarizeProjectOverview(workspace)
  const attention = getProjectOverviewAttention(
    workspace,
    account.id,
    account.role,
  )
  const percent = summary.tasks.total
    ? Math.round((summary.tasks.completed / summary.tasks.total) * 100)
    : 0
  const streamDates = workspace.workstreams
    .flatMap((stream) => (stream.startDate ? [stream.startDate] : []))
    .sort()
  const serviceNames = [
    ...new Set(workspace.workstreams.map((stream) => stream.serviceName)),
  ]
  const staff = [
    ...new Map(
      workspace.workstreams.flatMap((stream) =>
        (stream.staff ?? []).map((person) => [
          person.id,
          {
            ...person,
            isTeamLead: person.isTeamLead || false,
          },
        ]),
      ),
    ).values(),
  ]
  const items: StatStripItem[] = [
    {
      label: "Task Progress",
      value: summary.tasks.total ? percent + "%" : "No tasks",
      caption: summary.tasks.total
        ? summary.tasks.completed +
          " of " +
          summary.tasks.total +
          " tasks complete"
        : "No tasks are recorded",
      icon: ListChecks,
      tone: "bg-[#e7eefb] text-[#294c96]",
      href: sectionHref("work"),
      ariaLabel: "View task progress",
      meter: summary.tasks.total ? (
        <ProgressMeter
          value={summary.tasks.completed}
          max={summary.tasks.total}
          label="Overall task progress"
          colorClass="bg-[#294c96]"
        />
      ) : undefined,
    },
    {
      label: "Deliverables",
      value: `${summary.deliverables.sentToClient} / ${summary.deliverables.total}`,
      caption:
        "Sent to client · " +
        summary.deliverables.pendingReview +
        " internal reviews pending · " +
        summary.deliverables.revisionRequired +
        " needs changes",
      icon: ClipboardList,
      tone: "bg-[#e8f3ed] text-[#267449]",
      href: sectionHref("deliverables"),
      ariaLabel: "View deliverables",
      unavailable: !summary.deliverables.available,
    },
    {
      label: "Project Notes",
      value: summary.notes.total.toLocaleString(),
      caption:
        summary.notes.awaitingReview +
        " awaiting review · " +
        summary.notes.published +
        " published",
      icon: FileText,
      tone: "bg-[#f2ecfb] text-[#7044a4]",
      href: sectionHref("notes"),
      ariaLabel: "View project notes",
      unavailable: !summary.notes.available,
    },
    {
      label: "Client Requests",
      value: summary.requests.total.toLocaleString(),
      caption:
        account.role === "SUPERADMIN"
          ? summary.requests.pending + " pending · read-only project inspection"
          : summary.requests.actionable
            ? summary.requests.pending +
              " pending · " +
              summary.requests.actionable +
              " need your decision"
            : summary.requests.pending +
              " pending · no decisions assigned to you",
      icon: MessageSquareText,
      tone: "bg-[#fff2e2] text-[#986018]",
      href: sectionHref("requests"),
      ariaLabel: "View client requests",
      unavailable: !summary.requests.available,
    },
  ]
  const metadata = [
    { label: "Client", value: workspace.client.fullName || "Client" },
    { label: "Service", value: serviceNames.join(", ") || "Unavailable" },
    {
      label: "Started",
      value: streamDates[0] ? formatDate(streamDates[0]) : "Not started",
    },
    {
      label: "Department",
      value: departmentName ?? account.department?.name ?? "Unavailable",
    },
  ]

  return (
    <div className="grid min-w-0 gap-4">
      <StatStrip
        items={items}
        label="Project overview summary"
        pending={false}
        unavailable={false}
        wrapCaption
      />
      <MiniStats
        label="Project details"
        loading={false}
        items={metadata}
        wrapValues
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <OverviewPanel title={attention.heading}>
          <ItemList
            loading={false}
            rows={attention.items.map(({ id, label, section }) => ({
              id,
              label,
              href: sectionHref(section),
            }))}
            limit={attention.items.length}
            empty={
              <span role="status">
                {readOnly
                  ? "No outstanding oversight items"
                  : "Nothing needs your attention"}
              </span>
            }
          />
        </OverviewPanel>

        <OverviewPanel
          title="Assigned team"
          description={`${staff.length} ${staff.length === 1 ? "person" : "people"} assigned`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={sectionHref("team")}>View team</Link>
            </Button>
          }
        >
          {staff.length ? (
            <ul className="m-0 list-none divide-y divide-[#edf0f4] p-0">
              {staff.map((person) => (
                <li key={person.id} className="py-3 first:pt-0 last:pb-0">
                  <MemberIdentity
                    member={{ fullName: person.fullName }}
                    secondaryText={person.position || "Staff"}
                    nameAdornment={
                      person.isTeamLead ? (
                        <Pill tone="brand">Team Lead</Pill>
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No assigned personnel"
              description={
                readOnly
                  ? "No team members are listed in the available project data."
                  : "The department head can approve staffing from Team."
              }
              size="sm"
            />
          )}
        </OverviewPanel>
      </div>

      <Section title="Project brief">
        {workspace.workstreams.length ? (
          <div className="max-w-prose divide-y divide-[#eceef1]">
            {workspace.workstreams.map((stream) => (
              <article key={stream.id} className="py-3 first:pt-0 last:pb-0">
                {workspace.workstreams.length > 1 && (
                  <h3 className="m-0 mb-1 text-xs font-semibold">
                    {stream.serviceName}
                  </h3>
                )}
                <p className="m-0 whitespace-pre-wrap text-xs leading-5 text-[#65718a] [overflow-wrap:anywhere]">
                  {stream.description?.trim() ||
                    "No project goals have been provided."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs leading-5 text-[#65718a]">
            No project goals have been provided.
          </p>
        )}
      </Section>
    </div>
  )
}
