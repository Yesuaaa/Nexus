"use client"

import {
  ArrowRight,
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
  workspaceName,
  readOnly = false,
}: {
  workspace: ProjectWorkspaceDetail
  sectionHref: (section: ProjectOverviewSection) => string
  departmentName?: string | null
  workspaceName?: string | null
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
      value:
        summary.deliverables.sentToClient +
        " / " +
        summary.deliverables.total +
        " sent to client",
      caption:
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
      value: summary.notes.total + " unique notes",
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
      value: summary.requests.total + " requests",
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
    ["Client", workspace.client.fullName || "Client"],
    ["Service", serviceNames.length ? serviceNames.join(", ") : "Unavailable"],
    ["Started", streamDates[0] ? formatDate(streamDates[0]) : "Not started"],
    ["Department", departmentName ?? account.department?.name],
    ["Workspace", workspaceName],
  ].filter((item): item is [string, string] => Boolean(item[1]))

  return (
    <div className="min-w-0">
      <dl
        aria-label="Project details"
        className="m-0 flex flex-wrap gap-x-7 gap-y-3 rounded-xl border border-[#dfe5ec] bg-white px-4 py-3.5"
      >
        {metadata.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-[#738096]">
              {label}
            </dt>
            <dd className="m-0 mt-1 max-w-[280px] text-xs font-medium text-[#26364e] [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <StatStrip
        items={items}
        label="Project overview summary"
        pending={false}
        unavailable={false}
        compact
        variant="cards"
        className="mt-4"
      />

      <section
        aria-label={attention.heading}
        className="mt-5 rounded-xl border border-[#dfe5ec] bg-white p-4 sm:p-5"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#f2f5fa] text-[#415b83]">
              <ClipboardList size={15} aria-hidden="true" />
            </span>
            <h2 className="m-0 text-sm font-semibold">{attention.heading}</h2>
          </div>
          {account.role === "SUPERADMIN" && (
            <Pill tone="neutral">Read only</Pill>
          )}
        </header>
        {attention.items.length ? (
          <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
            {attention.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-10 w-full justify-between gap-3 whitespace-normal px-3 py-2 text-left"
                >
                  <Link href={sectionHref(item.section)}>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <ArrowRight
                      size={14}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            role="status"
            title={
              account.role === "SUPERADMIN"
                ? "No outstanding oversight items"
                : "Nothing needs your attention"
            }
            description={
              account.role === "SUPERADMIN"
                ? "No current reviews, escalations, or requests are available to inspect."
                : "Your current review and revision queues are clear."
            }
            size="xs"
            className="mt-2 border-0 bg-transparent"
          />
        )}
      </section>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-[#dfe5ec] bg-white p-4 sm:p-5">
          <header className="border-b border-[#e9edf2] pb-3">
            <h2 className="m-0 text-sm font-semibold">Project brief</h2>
          </header>
          {workspace.workstreams.length ? (
            <div className="divide-y divide-[#edf0f4]">
              {workspace.workstreams.map((stream) => {
                const description = stream.description?.trim()
                return (
                  <article key={stream.id} className="py-3.5 last:pb-0">
                    {workspace.workstreams.length > 1 && (
                      <h3 className="m-0 mb-1.5 text-xs font-semibold">
                        {stream.serviceName}
                      </h3>
                    )}
                    <p className="m-0 whitespace-pre-wrap text-xs leading-5 text-[#5f718b] [overflow-wrap:anywhere]">
                      {description
                        ? stream.description
                        : "No project goals have been provided."}
                    </p>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="mb-0 mt-3 text-xs leading-5 text-[#65718a]">
              No project goals have been provided.
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[#dfe5ec] bg-white p-4 sm:p-5">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf2] pb-3">
            <div>
              <h2 className="m-0 text-sm font-semibold">Assigned team</h2>
              <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                {staff.length} {staff.length === 1 ? "person" : "people"}{" "}
                assigned
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={sectionHref("team")}>View team</Link>
            </Button>
          </header>
          {staff.length ? (
            <ul className="m-0 mt-1 list-none divide-y divide-[#edf0f4] p-0">
              {staff.map((person) => (
                <li key={person.id} className="py-3">
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
              className="mt-3"
            />
          )}
        </section>
      </div>
    </div>
  )
}
