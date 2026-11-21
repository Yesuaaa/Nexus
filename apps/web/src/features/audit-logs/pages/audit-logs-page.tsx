"use client"

import { Fragment, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import Link from "next/link"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
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
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import {
  getAuditLogs,
  type LogFilters,
  type AuditLog,
  type AuditLogChangeValue,
  type AuditLogEffect,
} from "../api/audit-logs-api"
import {
  matchesAuditLogSearch,
  auditActorRole,
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
  { value: "7d", label: "Last 7 days" },
  { value: "24h", label: "Last 24 hours" },
]

function fromForRange(range: TimeRange, includeDefault: boolean) {
  if (!range && !includeDefault) return ""
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

const valueLabel = (value: AuditLogChangeValue) =>
  value === null
    ? "Not set"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value)

function ChangeValues({
  before,
  after,
}: {
  before: AuditLogChangeValue
  after: AuditLogChangeValue
}) {
  return (
    <>
      <span className="text-[#667085]">{valueLabel(before)}</span>{" "}
      <span aria-hidden="true">→</span>{" "}
      <span className="font-medium text-foreground">{valueLabel(after)}</span>
    </>
  )
}

function OperationEffects({ effects }: { effects: AuditLogEffect[] }) {
  const records = new Map<string, AuditLogEffect[]>()
  for (const effect of effects) {
    const key = JSON.stringify([effect.target.type, effect.target.id])
    const entries = records.get(key)
    if (entries) entries.push(effect)
    else records.set(key, [effect])
  }
  return (
    <SidePanelSection title="Recorded changes">
      {Array.from(records, ([key, entries]) => {
        const { target } = entries[0]
        return (
          <section key={key} className="grid min-w-0 gap-2">
            <h4 className="text-xs font-medium">{target.type}</h4>
            <DetailList>
              {target.label && (
                <DetailItem label="Current record name">
                  {target.label}
                </DetailItem>
              )}
              <DetailItem label="Record ID">{target.id}</DetailItem>
              {entries.map(({ id, action, changes, notes }) => (
                <Fragment key={id}>
                  <DetailItem label="Action">{action}</DetailItem>
                  {changes.map((change) => (
                    <DetailItem key={change.field} label={change.field}>
                      {"before" in change ? (
                        <ChangeValues {...change} />
                      ) : (
                        "Changed"
                      )}
                    </DetailItem>
                  ))}
                  {notes.map(({ label, value }) => (
                    <DetailItem key={label} label={label}>
                      {value}
                    </DetailItem>
                  ))}
                </Fragment>
              ))}
            </DetailList>
          </section>
        )
      })}
    </SidePanelSection>
  )
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
  const attributionNote =
    log.actor.attribution === "CURRENT"
      ? log.operationId && log.actor.role
        ? "The name comes from the current account. The role is the one recorded at the time."
        : "Name resolved from the current account because this older log did not store a name snapshot."
      : log.actor.attribution === "UNAVAILABLE"
        ? "The current account name is unavailable. The recorded account ID is shown."
        : log.actor.attribution === "SYSTEM"
          ? "This operation was performed by an automated process."
          : log.actor.attribution === "UNKNOWN"
            ? "The request did not identify an authenticated actor."
            : "Actor information was recorded when the operation occurred."
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
            <DetailItem label="Role">{auditActorRole(log.actor)}</DetailItem>
            {log.actor.id && (
              <DetailItem label="Account ID">{log.actor.id}</DetailItem>
            )}
          </DetailList>
          <p className="m-0 text-[11px] leading-5 text-[#738096]">
            {attributionNote}
          </p>
        </SidePanelSection>
        {!log.effects &&
          (log.target.type || log.target.label || log.target.id) && (
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
        {log.effects ? (
          <OperationEffects effects={log.effects} />
        ) : (
          <SidePanelSection
            title={
              log.outcome === "SUCCESS" ? "What changed" : "What was attempted"
            }
          >
            {log.changes.length ? (
              <DetailList>
                {log.changes.map((change) => (
                  <DetailItem key={change.field} label={change.field}>
                    <ChangeValues {...change} />
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
        )}
        <SidePanelSection title="Operation">
          <DetailList>
            <DetailItem label="Area">
              {sourceLabels[log.source] ?? log.source}
            </DetailItem>
            {!log.effects && <DetailItem label="Event">{log.event}</DetailItem>}
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
            {log.operationId && (
              <DetailItem label="Operation ID">{log.operationId}</DetailItem>
            )}
            {log.correlationId && (
              <DetailItem label="Correlation ID">
                {log.correlationId}
              </DetailItem>
            )}
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
  description = "Review 30 days of successful activity and system failures.",
  endpoint,
  sourceLabels,
  searchPlaceholder,
  linkToRecord,
  operationActions,
}: {
  title: string
  description?: string
  endpoint: Parameters<typeof getAuditLogs>[0]
  sourceLabels: Readonly<Record<string, string>>
  searchPlaceholder: string
  linkToRecord?: (log: AuditLog) => { href: string; label: string } | undefined
  operationActions?: Readonly<Record<string, string>>
}) {
  const sourceOptions = [
    { value: "", label: "All areas" },
    ...Object.entries(sourceLabels).map(([value, label]) => ({ value, label })),
  ]
  const activityOptions = operationActions
    ? [
        { value: "", label: "All actions" },
        ...Object.entries(operationActions).map(([value, label]) => ({
          value,
          label,
        })),
      ]
    : outcomeOptions
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [activity, setActivity] = useState("")
  const [source, setSource] = useState("")
  const [range, setRange] = useState<TimeRange>("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fixedWindow = endpoint === "/api/workforce-compliance-logs"
  const windowKey = JSON.stringify([query, activity, source, range])
  const logWindow = useRef<{ key: string; asOf: string; snapshot?: string } | null>(null)
  const list = usePaginatedList({
    params: { search: query, activity, source, range },
    load: ({ page, signal }) => {
      const filters: LogFilters = {
        search: query,
        outcome: operationActions ? "" : activity,
        source,
        from: fixedWindow
          ? ""
          : fromForRange(range, endpoint === "/api/people-hr-logs"),
        to: "",
        event: operationActions ? activity : "",
        actorId: "",
        subjectId: "",
        requestId: "",
        correlationId: "",
      }
      const previous = logWindow.current
      return getAuditLogs(
        endpoint,
        filters,
        page,
        signal,
        fixedWindow
          ? {
              snapshot: previous?.key === windowKey ? previous.snapshot : undefined,
              asOf: previous?.key === windowKey ? previous.asOf : undefined,
              range: range || undefined,
            }
          : undefined,
      )
    },
    rows: (result) => result.events,
    matches: matchesAuditLogSearch,
    initial: null,
    refresh: fixedWindow ? false : "focus",
    onLoaded: (result) => {
      if (fixedWindow) logWindow.current = { key: windowKey, asOf: result.asOf, snapshot: result.snapshot }
    },
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
        description={description}
        actions={
          fixedWindow && (
            <PageHeaderButton
              disabled={list.loading}
              onClick={() => {
                logWindow.current = null
                resetSelectionAndPage()
                list.retry()
              }}
            >
              <RefreshCw aria-hidden="true" />
              Refresh logs
            </PageHeaderButton>
          )
        }
      />
      <section className="mt-[18px] min-w-0" aria-label={`${title} history`}>
        <div className="pb-4">
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
              label={
                operationActions ? "Filter by action" : "Filter by outcome"
              }
              announceValue
              value={activity}
              options={activityOptions}
              triggerClassName="min-w-[145px]"
              onChange={(value) => {
                setActivity(value)
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
