"use client"

import { useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { roleLabels } from "@/features/auth/model/roles"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import {
  getAuditLogs,
  type LogFilters,
  type AuditLog,
  type AuditLogChangeValue,
} from "../api/audit-logs-api"
import {
  matchesAuditLogSearch,
  AuditLogsTable,
} from "../components/audit-logs-table"

type TimeRange = "" | "24h" | "7d"

const outcomeOptions = [
  { value: "", label: "All outcomes" },
  { value: "SUCCESS", label: "Successful" },
  { value: "FAILURE", label: "Failed" },
]
const timeOptions = [
  { value: "", label: "Last 30 days" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
]

function fromForRange(range: TimeRange) {
  if (!range) return ""
  const hours = range === "24h" ? 24 : 24 * 7
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function logFilters(
  search: string,
  outcome: string,
  source: string,
  range: TimeRange,
): LogFilters {
  return {
    search: search.trim(),
    outcome,
    source,
    from: fromForRange(range),
    to: "",
    event: "",
    actorId: "",
    subjectId: "",
    requestId: "",
    correlationId: "",
  }
}

function LogDetails({
  log,
  sourceLabels,
  recordLink,
  onClose,
}: {
  log: AuditLog
  sourceLabels: Readonly<Record<string, string>>
  recordLink?: { href: string; label: string }
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const { formatDateTime } = useDatePreferences()
  const role = log.actor.role
    ? roleLabels[log.actor.role]
    : log.actor.attribution === "UNKNOWN"
      ? "Unknown"
      : "Automated process"
  const attributionNote =
    log.actor.attribution === "CURRENT"
      ? "Name resolved from the current account because this older log did not store a name snapshot."
      : log.actor.attribution === "UNAVAILABLE"
        ? "The account is no longer available, but its recorded identifier is retained."
        : log.actor.attribution === "SYSTEM"
          ? "This operation was performed by an automated process."
          : log.actor.attribution === "UNKNOWN"
            ? "The request did not identify an authenticated actor."
            : "Actor information was recorded when the operation occurred."
  const valueLabel = (value: AuditLogChangeValue) =>
    value === null
      ? "Not set"
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : String(value)
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Log details"
        description={log.message}
        closeLabel="Close log details"
        leading={
          <Avatar name={log.actor.name} className="size-11" fallback="S" />
        }
        meta={
          <Pill tone={log.outcome === "SUCCESS" ? "success" : "danger"}>
            {log.outcome === "SUCCESS" ? "Success" : "Failed"}
          </Pill>
        }
      />
      <SidePanelBody>
        <div
          className={cn(
            "rounded-lg border p-4",
            log.outcome === "FAILURE"
              ? "border-[#f4c9d3] bg-[#fff7f9]"
              : "border-[#e8ebef] bg-[#f8fafd]",
          )}
        >
          <p className="m-0 text-sm leading-6 font-medium text-foreground">
            {log.message}
          </p>
          {log.outcome === "FAILURE" && (
            <div className="mt-3 border-t border-[#f0d8de] pt-3">
              <p className="m-0 text-[11px] font-semibold text-[#8d2742]">
                Why it failed
              </p>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#5f2736]">
                {log.failureReason ??
                  "A safe cause was not captured for this incident."}
              </p>
            </div>
          )}
        </div>
        <SidePanelSection title="Performed by">
          <DetailList>
            <DetailItem label="Name">{log.actor.name}</DetailItem>
            <DetailItem label="Role">{role}</DetailItem>
            {log.actor.id && (
              <DetailItem label="Account ID">{log.actor.id}</DetailItem>
            )}
          </DetailList>
          <p className="m-0 text-[11px] leading-5 text-[#738096]">
            {attributionNote}
          </p>
        </SidePanelSection>
        {(log.target.type || log.target.label || log.target.id) && (
          <SidePanelSection title="Affected record">
            <DetailList>
              {log.target.type && (
                <DetailItem label="Record type">{log.target.type}</DetailItem>
              )}
              {log.target.label && (
                <DetailItem label="Record">{log.target.label}</DetailItem>
              )}
              {log.target.id && (
                <DetailItem label="Record ID">{log.target.id}</DetailItem>
              )}
              {log.projectName && (
                <DetailItem label="Project">{log.projectName}</DetailItem>
              )}
            </DetailList>
          </SidePanelSection>
        )}
        <SidePanelSection
          title={
            log.outcome === "SUCCESS" ? "What changed" : "What was attempted"
          }
        >
          {log.changes.length ? (
            <DetailList>
              {log.changes.map((change) => (
                <DetailItem key={change.field} label={change.field}>
                  <span className="text-[#667085]">
                    {valueLabel(change.before)}
                  </span>{" "}
                  <span aria-hidden="true">→</span>{" "}
                  <span className="font-medium text-foreground">
                    {valueLabel(change.after)}
                  </span>
                </DetailItem>
              ))}
            </DetailList>
          ) : (
            <p className="m-0 text-xs leading-5 text-[#738096]">
              {log.outcome === "SUCCESS"
                ? "This earlier log did not capture field-level changes."
                : "No field-level attempted change was available for this operation."}
            </p>
          )}
        </SidePanelSection>
        <SidePanelSection title="Operation">
          <DetailList>
            <DetailItem label="Area">
              {sourceLabels[log.source] ?? log.source}
            </DetailItem>
            <DetailItem label="Event">{log.event}</DetailItem>
            {log.action && <DetailItem label="Action">{log.action}</DetailItem>}
            {log.status && (
              <DetailItem label="HTTP status">{log.status}</DetailItem>
            )}
            {log.failureCode && (
              <DetailItem label="Diagnostic code">{log.failureCode}</DetailItem>
            )}
            {log.endpoint && (
              <DetailItem label="Endpoint">{log.endpoint}</DetailItem>
            )}
          </DetailList>
        </SidePanelSection>
        <SidePanelSection title="Trace information">
          <DetailList>
            <DetailItem label="Time">
              {formatDateTime(log.createdAt)}
            </DetailItem>
            {log.requestId && (
              <DetailItem label="Request ID">{log.requestId}</DetailItem>
            )}
            {log.projectId && (
              <DetailItem label="Project ID">{log.projectId}</DetailItem>
            )}
            {log.workspaceId && (
              <DetailItem label="Workspace ID">{log.workspaceId}</DetailItem>
            )}
            {log.subjectId && !log.target.id && (
              <DetailItem label="Subject ID">{log.subjectId}</DetailItem>
            )}
            <DetailItem label="Correlation ID">{log.correlationId}</DetailItem>
          </DetailList>
          {log.outcome === "FAILURE" && (
            <p className="m-0 text-[11px] leading-5 text-[#738096]">
              Search this correlation ID in the API server logs to find the raw
              developer error and stack trace for this request.
            </p>
          )}
        </SidePanelSection>
        {recordLink && (
          <Button variant="outline" asChild className="justify-self-start">
            <Link href={recordLink.href}>{recordLink.label}</Link>
          </Button>
        )}
      </SidePanelBody>
    </SidePanel>
  )
}

export function AuditLogsPage({
  title,
  endpoint,
  sourceLabels,
  searchPlaceholder,
  linkToRecord,
}: {
  title: string
  endpoint: Parameters<typeof getAuditLogs>[0]
  sourceLabels: Readonly<Record<string, string>>
  searchPlaceholder: string
  linkToRecord?: (log: AuditLog) => { href: string; label: string } | undefined
}) {
  const sourceOptions = [
    { value: "", label: "All areas" },
    ...Object.entries(sourceLabels).map(([value, label]) => ({ value, label })),
  ]
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [outcome, setOutcome] = useState("")
  const [source, setSource] = useState("")
  const [range, setRange] = useState<TimeRange>("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const list = usePaginatedList({
    params: { search: query, outcome, source, range },
    load: ({ page, signal }) =>
      getAuditLogs(
        endpoint,
        logFilters(query, outcome, source, range),
        page,
        signal,
      ),
    rows: (result) => result.events,
    matches: matchesAuditLogSearch,
    initial: null,
    refresh: "focus",
    fallbackError: `Couldn't load ${title}.`,
  })
  const { setPage } = list
  const selected = list.error
    ? undefined
    : list.rows.find(({ id }) => id === selectedId)

  function resetSelectionAndPage() {
    setSelectedId(null)
    setPage(1)
  }

  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <PageHeader
        title={title}
        description="Review 30 days of successful activity and system failures."
      />
      <section className="mt-[18px] min-w-0" aria-label={`${title} history`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-4 max-[700px]:grid-cols-1">
          <div className={`${filterBarClass} min-w-0`}>
            <SearchField
              label="Search logs"
              placeholder={searchPlaceholder}
              value={search}
              maxLength={80}
              onChange={(event) => {
                setSearch(event.target.value)
                resetSelectionAndPage()
              }}
            />
            <FilterSelect
              label="Filter by outcome"
              announceValue
              value={outcome}
              options={outcomeOptions}
              triggerClassName="min-w-[145px]"
              onChange={(value) => {
                setOutcome(value)
                resetSelectionAndPage()
              }}
            />
            <FilterSelect
              label="Filter by area"
              announceValue
              value={source}
              options={sourceOptions}
              triggerClassName="min-w-[150px]"
              onChange={(value) => {
                setSource(value)
                resetSelectionAndPage()
              }}
            />
            <FilterSelect
              label="Filter by time"
              announceValue
              value={range}
              options={timeOptions}
              triggerClassName="min-w-[145px]"
              onChange={(value) => {
                setRange(value as TimeRange)
                resetSelectionAndPage()
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-[34px] gap-2 text-xs max-[700px]:h-11 max-[700px]:justify-self-start"
            disabled={list.loading}
            onClick={() => {
              setSelectedId(null)
              list.retry()
            }}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <AuditLogsTable
          title={title}
          sourceLabels={sourceLabels}
          logs={list.rows}
          loading={list.loading}
          error={list.error}
          viewKey={list.tableViewKey}
          quickKey={query}
          onRowsSettled={list.onRowsSettled}
          onRetry={list.retry}
          onView={(log) => setSelectedId(log.id)}
        />
        <TableSearchStatus
          active={
            list.loading && list.previewing && Boolean(list.preview?.length)
          }
          label="logs"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label={`${title.replace(/s$/, "")} pages`}
            itemLabel="logs"
            onPageChange={(page) => {
              setSelectedId(null)
              setPage(page)
            }}
          />
        )}
      </section>
      {selected && (
        <LogDetails
          log={selected}
          sourceLabels={sourceLabels}
          recordLink={linkToRecord?.(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  )
}
