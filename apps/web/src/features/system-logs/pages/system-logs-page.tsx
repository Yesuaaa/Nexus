"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ErrorLogsView } from "../components/error-logs-view"
import { SystemHealthView } from "../components/system-health-view"
import { Input } from "@/components/ui/input"
import { FilterSelect } from "@/components/ui/filter-select"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import {
  ResponsiveDataTable,
  ResponsiveDataTableHeader,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableBody,
  ResponsiveDataTableRow,
  ResponsiveDataTableCell,
  DataTableErrorRow,
} from "@/components/ui/responsive-data-table"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelSection,
  SidePanelFooter,
  SidePanelButton,
  DetailList,
  DetailItem,
  useSidePanel,
} from "@/components/ui/side-panel"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { useAsyncResource } from "@/lib/use-async-resource"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { moduleRegistry } from "@/features/workspaces/model/module-registry"
import { useWorkspaceModuleId } from "@/features/workspaces/providers/workspace-provider"
import { loadHistory, loadHistoryEvent } from "../api/system-logs-api"
import {
  incompatibleHistoryFilters,
  clearIncompatibleHistoryFilters,
  compatibilityFilterLabels,
} from "../model/history-filter-compatibility"
import {
  canReadSystemLogs,
  defaultHistoryFilters,
  initialHistoryFilters,
  historyModuleCoverage,
  historyModuleOptions,
  investigateHistoryOperation,
  historyQuery,
  historySources,
  historyActions,
  attendanceSubjectTypes,
  canAdvanceHistory,
  type HistoryFilters,
  type HistoryEvent,
} from "../model/management-history"

const grid =
  "grid grid-cols-[minmax(130px,1fr)_minmax(150px,1.3fr)_minmax(130px,1fr)_minmax(130px,1fr)_90px] items-center gap-3 @max-[900px]:grid-cols-1"
const labelClass = "grid min-w-0 gap-1.5 text-xs font-medium text-[#52627a]"
const moduleLabels: Record<string, string> = Object.fromEntries(
  Object.entries(moduleRegistry).map(([id, m]) => [id, m.title]),
)
function eventLabel(e: HistoryEvent) {
  return humanizeEnum(e.eventName.replaceAll(".", "_"))
}

function EventPanel({
  event,
  filters,
  onClose,
  onInvestigate,
}: {
  event: HistoryEvent
  filters: HistoryFilters
  onClose: () => void
  onInvestigate: (id: string) => void
}) {
  const panel = useSidePanel(onClose)
  const result = useAsyncResource(
    (signal) => loadHistoryEvent(event, filters, signal),
    [event.eventId, filters.from, filters.to],
    { fallbackError: "Event details are unavailable." },
  )
  const details = !result.loading && !result.error ? result.data : undefined
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() => document.getElementById("history-heading")}
    >
      <SidePanelHeader
        title="Audit event details"
        description="Historical audit evidence. Current names and roles are not inferred."
        closeLabel="Close event details"
      />
      <SidePanelBody>
        {result.loading ? (
          <p role="status">Loading event details…</p>
        ) : result.error ? (
          <div role="alert">
            <p>{result.error}</p>
            <Button variant="outline" onClick={result.retry}>
              Retry details
            </Button>
          </div>
        ) : (
          details && (
            <>
              <SidePanelSection title={eventLabel(details)}>
                <DetailList layout="stacked">
                  <DetailItem label="Event ID">{details.eventId}</DetailItem>
                  <DetailItem label="Source">{details.source}</DetailItem>
                  <DetailItem label="Module">
                    {moduleLabels[details.moduleId]}
                  </DetailItem>
                  <DetailItem label="Timestamp (UTC)">
                    {formatDateTime(details.occurredAt, "UTC")}
                  </DetailItem>
                  <DetailItem label="Historical actor ID">
                    {details.actorId ?? "No actor recorded"}
                  </DetailItem>
                  <DetailItem label="Role at time">
                    {details.roleAtTime
                      ? humanizeEnum(details.roleAtTime)
                      : "Not recorded"}
                  </DetailItem>
                  <DetailItem label="Affected resource">
                    {humanizeEnum(details.subjectType)} · {details.subjectId}
                  </DetailItem>
                  <DetailItem label="Operation ID">
                    {details.operationId ?? "Not recorded"}
                  </DetailItem>
                </DetailList>
                <p className="mt-3 text-xs text-[#738096]">
                  Identity IDs remain evidence when an account or resource is no
                  longer available. No current identity lookup is performed.
                </p>
              </SidePanelSection>
              {details.kind === "attendance" ? (
                <SidePanelSection title="Attendance record change">
                  <p className="text-xs leading-relaxed">
                    This records a committed database row change, not an
                    approval outcome or complete attendance history. Snapshots,
                    reasons, work times and private employee values are
                    excluded. Historical role and shared operation ID were not
                    recorded.
                  </p>
                </SidePanelSection>
              ) : details.kind === "project" ? (
                <SidePanelSection title="Project event metadata">
                  <p className="text-xs leading-relaxed">
                    Recorded milestone or staffing event only. Summaries,
                    confidential project content, allocations and deliverables
                    are excluded. Historical role and shared operation ID were
                    not recorded. This is not complete project auditing.
                  </p>
                </SidePanelSection>
              ) : details.kind === "service" ? (
                <SidePanelSection title="Service request event metadata">
                  <p className="text-xs leading-relaxed">
                    Selected recorded request workflow event only. The subject
                    is the historical service request ID; consultation,
                    quotation and approval identities and values are excluded.
                    Summaries, communications, documents and payment details are
                    never shown. Historical role and shared operation ID were
                    not recorded. This is partial Service Operations coverage.
                  </p>
                </SidePanelSection>
              ) : (
                <SidePanelSection title="Recorded changes">
                  <p className="text-xs">
                    Changed fields:{" "}
                    {details.changedFields
                      .map((field) => humanizeEnum(field))
                      .join(", ") || "No field changes recorded"}
                  </p>
                  {details.transitions.length ? (
                    <DetailList layout="stacked">
                      {details.transitions.map((t) => (
                        <DetailItem key={t.field} label={humanizeEnum(t.field)}>
                          {t.before} → {t.after}
                        </DetailItem>
                      ))}
                    </DetailList>
                  ) : (
                    <p className="text-xs text-[#738096]">
                      Personal field values are not included in this history.
                    </p>
                  )}
                  {details.sessionsRevoked !== null && (
                    <p className="mt-3 text-xs">
                      Sessions revoked: {details.sessionsRevoked ? "Yes" : "No"}
                    </p>
                  )}
                </SidePanelSection>
              )}
            </>
          )
        )}
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
        {details?.operationId && (
          <SidePanelButton
            onClick={() =>
              panel.close(() => {
                if (details.operationId) onInvestigate(details.operationId)
              })
            }
          >
            Investigate operation
          </SidePanelButton>
        )}
      </SidePanelFooter>
    </SidePanel>
  )
}

function HistoryFilterPanel({
  draft,
  update,
  onApply,
  validation,
  conflict,
  onClose,
}: {
  draft: HistoryFilters
  update: (field: keyof HistoryFilters, value: string) => void
  onApply: () => boolean
  validation: string
  conflict: ReactNode
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() => document.getElementById("history-filter-options")}
    >
      <SidePanelHeader
        title="Investigation filters"
        description="Optional scope, source and exact identifiers. Changes apply only when you choose Apply filters."
        closeLabel="Close investigation filters"
      />
      <SidePanelBody>
        <form
          id="history-investigation-filters"
          onSubmit={(event) => {
            event.preventDefault()
            if (onApply()) panel.close()
          }}
          className="grid gap-4"
        >
          <div className={labelClass}>
            <span>Module override</span>
            <FilterSelect
              label="Module filter"
              value={draft.moduleId}
              onChange={(v) => update("moduleId", v)}
              options={historyModuleOptions()}
              triggerClassName="w-full"
            />
          </div>
          <div className={labelClass}>
            <span>Source</span>
            <FilterSelect
              label="Source filter"
              value={draft.source}
              onChange={(v) => update("source", v)}
              options={[
                { value: "", label: "Integrated sources" },
                ...historySources.map((source) => ({
                  value: source,
                  label:
                    source === "audit.attendance"
                      ? "Attendance audit"
                      : source === "audit.workflow"
                        ? "Workflow audit — selected request/project events"
                        : source === historySources[0]
                          ? "Account management"
                          : "Workforce management",
                })),
              ]}
              triggerClassName="w-full"
            />
          </div>
          <div className={labelClass}>
            <span>Action</span>
            <FilterSelect
              label="Action filter"
              value={draft.action}
              onChange={(v) => update("action", v)}
              options={[
                { value: "", label: "All actions" },
                ...historyActions.map((action) => ({
                  value: action,
                  label: humanizeEnum(action),
                })),
              ]}
              triggerClassName="w-full"
            />
          </div>
          {(
            [
              ["actorId", "Actor ID"],
              ["subjectId", "Subject ID"],
              ["operationId", "Operation ID"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className={labelClass}>
              {label}
              <Input
                value={draft[field]}
                onChange={(e) => update(field, e.target.value)}
                maxLength={field === "operationId" ? 36 : 80}
              />
            </label>
          ))}
          <div className={labelClass}>
            <span>Subject type</span>
            <FilterSelect
              label="Subject type filter"
              value={draft.subjectType}
              onChange={(v) => update("subjectType", v)}
              options={[
                { value: "", label: "All resource types" },
                ...[
                  "account",
                  "employee",
                  "department",
                  "team",
                  "project",
                  "service_request",
                  ...attendanceSubjectTypes,
                ].map((type) => ({ value: type, label: humanizeEnum(type) })),
              ]}
              triggerClassName="w-full"
            />
          </div>
          {validation && (
            <p role="alert" className="text-xs text-destructive">
              {validation}
            </p>
          )}
          {conflict}
        </form>
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
        <SidePanelButton type="submit" form="history-investigation-filters">
          Apply filters
        </SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}

export function SystemLogsPage() {
  const account = usePortalAccount()
  const origin = useWorkspaceModuleId()
  const allowed = canReadSystemLogs(account)
  const [draft, setDraft] = useState(() => initialHistoryFilters(origin))
  const [filters, setFilters] = useState(draft)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [validation, setValidation] = useState("")
  const [pendingFilters, setPendingFilters] = useState<{
    draft: HistoryFilters
    filters: HistoryFilters
  } | null>(null)
  const [selected, setSelected] = useState<HistoryEvent | null>(null)
  const [filterOptionsOpen, setFilterOptionsOpen] = useState(false)
  const [investigationBack, setInvestigationBack] = useState<{
    draft: HistoryFilters
    filters: HistoryFilters
    cursors: (string | null)[]
  } | null>(null)
  const coverage = historyModuleCoverage(filters.moduleId)
  const draftCoverage = historyModuleCoverage(draft.moduleId)
  const cursor = cursors[cursors.length - 1]
  const specialized = [
    "source",
    "action",
    "actorId",
    "subjectId",
    "subjectType",
    "operationId",
  ] as const
  const advancedApplied = specialized.filter((field) => filters[field]).length
  const advancedPending = specialized.some(
    (field) => draft[field] !== filters[field],
  )
  const key = JSON.stringify(filters)
  const result = useAsyncResource(
    (signal) => loadHistory(filters, cursor, signal),
    [key, cursor],
    {
      enabled: allowed && coverage.readable,
      fallbackError: "Management history could not be loaded.",
    },
  )
  const data =
    coverage.readable && !result.loading && !result.error
      ? result.data
      : undefined
  function applyFilters() {
    try {
      historyQuery(draft)
      if (incompatibleHistoryFilters(draft).length) {
        setPendingFilters({ draft, filters: draft })
        setValidation("")
        return false
      }
      setPendingFilters(null)
      setFilters({ ...draft })
      setCursors([null])
      setValidation("")
      setSelected(null)
      if (JSON.stringify(draft) === key) result.retry()
      return true
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check the date range.",
      )
      return false
    }
  }
  function apply(event: FormEvent) {
    event.preventDefault()
    applyFilters()
  }
  function setModuleScope(moduleId: string) {
    const next = {
      draft: { ...draft, moduleId },
      filters: { ...filters, moduleId },
    }
    if (
      incompatibleHistoryFilters(next.draft).length ||
      incompatibleHistoryFilters(next.filters).length
    ) {
      setPendingFilters(next)
      setValidation("")
      return
    }
    setPendingFilters(null)
    setDraft(next.draft)
    setFilters(next.filters)
    setCursors([null])
    setSelected(null)
    setValidation("")
  }
  function investigate(id: string) {
    setPendingFilters(null)
    setInvestigationBack((current) => current ?? { draft, filters, cursors })
    const next = investigateHistoryOperation(filters, id)
    setDraft(next)
    setFilters(next)
    setCursors([null])
    setSelected(null)
    setValidation("")
  }
  const update = (field: keyof HistoryFilters, value: string) => {
    setPendingFilters(null)
    setDraft((current) => ({ ...current, [field]: value }))
  }
  const draftConflicts = pendingFilters
    ? incompatibleHistoryFilters(pendingFilters.draft)
    : []
  const appliedConflicts = pendingFilters
    ? incompatibleHistoryFilters(pendingFilters.filters)
    : []
  const conflict = pendingFilters && (
    <Alert
      as="div"
      aria-label="Incompatible audit filters"
      className="mb-4 break-words"
    >
      <p className="font-semibold">
        Filters conflict with{" "}
        {moduleLabels[pendingFilters.filters.moduleId] ?? "All Modules"}.
      </p>
      <p className="mt-1">
        These retained selections cannot be combined in that scope:
      </p>
      <ul className="my-2 list-inside list-disc">
        {[...new Set([...draftConflicts, ...appliedConflicts])].map((field) => (
          <li key={field}>
            {compatibilityFilterLabels[field]}:{" "}
            {[
              ...new Set([
                ...(draftConflicts.includes(field)
                  ? [pendingFilters.draft[field]]
                  : []),
                ...(appliedConflicts.includes(field)
                  ? [pendingFilters.filters[field]]
                  : []),
              ]),
            ].join("; ")}
          </li>
        ))}
      </ul>
      <p>
        Nothing has been cleared. Results still use{" "}
        {moduleLabels[filters.moduleId] ?? "All Modules"}. Clear only the listed
        filters to continue. Compatible selections and dates will be kept.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const nextDraft = clearIncompatibleHistoryFilters(
              pendingFilters.draft,
              draftConflicts,
            )
            const nextFilters = clearIncompatibleHistoryFilters(
              pendingFilters.filters,
              appliedConflicts,
            )
            setDraft(nextDraft)
            setFilters(nextFilters)
            setCursors([null])
            setSelected(null)
            setValidation("")
            setPendingFilters(null)
            if (JSON.stringify(nextFilters) === key) result.retry()
          }}
        >
          Clear incompatible filters and apply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPendingFilters(null)}
        >
          Keep current filters
        </Button>
      </div>
    </Alert>
  )
  if (!allowed) return null
  return (
    <section className={contentClass}>
      <div className="px-[clamp(16px,2.1vw,32px)] py-5">
        <PageHeader
          title="System Logs & Diagnostics"
          headingId="history-heading"
          description="Read-only diagnostics"
        />
        <details className="group my-4 rounded-lg border border-[#e1e4ea] bg-[#f6f8fb] text-xs leading-relaxed">
          <summary
            className={`flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <Pill tone="warning">Offline only</Pill>
            <strong>Unavailable for production release.</strong>
            <span className="ml-auto flex items-center gap-2 text-[#52627a]">
              Release details
              <ChevronDown
                size={14}
                aria-hidden="true"
                className="shrink-0 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <p className="border-t border-[#e1e4ea] px-4 py-3 text-[#52627a]">
            Access remains disabled until database protections and durable
            access evidence are verified. Account, Workforce and limited
            Attendance, Project and Service Operations audit history are
            supported. Errors &amp; Exceptions provides limited instance-local
            diagnostics in offline testing. System Health provides
            instance-local offline observations. Security views are not
            available.
          </p>
        </details>
        <Tabs defaultValue="activity">
          <TabsList
            aria-label="System Logs views"
            className="mb-4 h-auto flex-wrap"
          >
            <TabsTrigger value="activity">Activity &amp; Audit</TabsTrigger>
            <TabsTrigger value="errors">Errors &amp; Exceptions</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>
          <TabsContent value="activity">
            <h2 className="mb-3 text-sm font-semibold">Activity & Audit</h2>
            {investigationBack && (
              <Button
                variant="outline"
                className="mb-4"
                onClick={() => {
                  setDraft(investigationBack.draft)
                  setFilters(investigationBack.filters)
                  setCursors(investigationBack.cursors)
                  setSelected(null)
                  setValidation("")
                  setPendingFilters(null)
                  setInvestigationBack(null)
                }}
              >
                Back to filtered history
              </Button>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#738096]">Module</span>
              <Pill aria-label="Current audit module">
                {filters.moduleId
                  ? moduleLabels[filters.moduleId]
                  : "All Modules"}
              </Pill>
              {filters.moduleId && coverage.readable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModuleScope("")}
                >
                  All Modules
                </Button>
              )}
              {!filters.moduleId && origin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModuleScope(origin)}
                >
                  Workspace only
                </Button>
              )}
            </div>
            <form
              onSubmit={apply}
              aria-label="Filter audit history"
              className="mb-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_2fr]">
                <label className={labelClass}>
                  From date (UTC)
                  <Input
                    type="date"
                    value={draft.from}
                    onChange={(e) => update("from", e.target.value)}
                    required
                  />
                </label>
                <label className={labelClass}>
                  To date (UTC)
                  <Input
                    type="date"
                    value={draft.to}
                    onChange={(e) => update("to", e.target.value)}
                    required
                  />
                </label>
                <label className={labelClass + " col-span-2 lg:col-span-1"}>
                  Event search (optional)
                  <Input
                    value={draft.eventName}
                    onChange={(e) => update("eventName", e.target.value)}
                    placeholder="Exact name: account.role_changed"
                    maxLength={100}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="brand">
                  Apply filters
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = {
                      ...defaultHistoryFilters(),
                      moduleId: filters.moduleId,
                    }
                    setDraft(next)
                    setFilters(next)
                    setCursors([null])
                    setValidation("")
                    setPendingFilters(null)
                    setSelected(null)
                    setInvestigationBack(null)
                  }}
                >
                  Reset filters
                </Button>
                <Button
                  id="history-filter-options"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterOptionsOpen(true)}
                >
                  Filter options
                  {advancedApplied > 0 && (
                    <Pill>{advancedApplied} applied</Pill>
                  )}
                </Button>
                {advancedPending && (
                  <Pill tone="warning">Pending filter changes</Pill>
                )}
              </div>
              {validation && (
                <p role="alert" className="text-xs text-destructive">
                  {validation}
                </p>
              )}
              {!filterOptionsOpen && conflict}
            </form>
            {filterOptionsOpen && (
              <HistoryFilterPanel
                draft={draft}
                update={update}
                onApply={applyFilters}
                validation={validation}
                conflict={conflict}
                onClose={() => setFilterOptionsOpen(false)}
              />
            )}

            {(coverage.readable || draft.moduleId !== filters.moduleId) && (
              <div
                role="note"
                aria-label="Module history coverage"
                className="mb-3 text-xs leading-relaxed"
              >
                <details className="group">
                  <summary
                    className={`flex cursor-pointer list-none flex-wrap items-center gap-2 py-1 [&::-webkit-details-marker]:hidden ${focusRing}`}
                  >
                    <Pill tone="info">{draftCoverage.label}</Pill>
                    <span className="text-[#738096]">History coverage</span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-2 text-[#52627a]">
                    {draftCoverage.explanation}
                  </p>
                </details>
                {draft.moduleId !== filters.moduleId && (
                  <p className="mt-1">
                    Apply filters to change the displayed history.
                  </p>
                )}
              </div>
            )}
            {coverage.readable && (
              <p className="mb-3 text-xs text-[#738096]">
                Up to 31 UTC days. Integrated audit records only.
              </p>
            )}
            {data && (
              <div className="mb-4 space-y-2 text-xs" aria-live="polite">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill className="text-xs">
                    {data.eventCount}{" "}
                    {data.eventCount === 1 ? "event" : "events"}
                  </Pill>
                  <Pill tone="info" className="text-xs">
                    {data.operationCount}{" "}
                    {data.operationCount === 1 ? "operation" : "operations"} on
                    this page
                  </Pill>
                  {data.ungroupedEventCount > 0 && (
                    <Pill tone="neutral" className="text-xs">
                      {data.ungroupedEventCount}{" "}
                      {data.ungroupedEventCount === 1 ? "event" : "events"}{" "}
                      without recorded operation
                    </Pill>
                  )}
                  <span className="text-[#738096]">
                    Snapshot: {formatDateTime(data.snapshotBoundary, "UTC")} UTC
                  </span>
                </div>
                <p>
                  Operation groups are page-scoped and may continue across
                  pages. They are never globally complete.
                  {data.ungroupedEventCount > 0 &&
                    " Records without a shared operation ID remain ungrouped."}
                </p>
                {!data.complete && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#e7cf9e] bg-[#fffaf0] p-3"
                  >
                    <strong>Incomplete history on this page.</strong> Records
                    may be omitted or a source unavailable. Retry replaces this
                    page; it does not append results.
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={result.retry}
                    >
                      Retry this page
                    </Button>
                  </div>
                )}
                <ul aria-label="History source coverage" className="space-y-1">
                  {data.sources.map((s) => (
                    <li key={s.source}>
                      {s.source}:{" "}
                      {s.status === "available" ? "Available" : "Unavailable"}
                      {s.omittedCount !== null
                        ? ` · ${s.omittedCount} omitted`
                        : " · omitted count unknown"}
                      {s.reasonCode === "SCAN_CAP"
                        ? " · Scan limit reached; continue to inspect the next window."
                        : s.reasonCode === "INVALID_RECORD"
                          ? " · Malformed records omitted."
                          : s.reasonCode === "SOURCE_UNAVAILABLE"
                            ? " · Source could not be read."
                            : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ResponsiveDataTable
              label="Management audit events"
              aria-busy={result.loading}
            >
              {coverage.readable && (
                <ResponsiveDataTableHeader
                  rowClassName={`${grid} @max-[900px]:hidden`}
                >
                  {[
                    "Timestamp (UTC)",
                    "Event / module",
                    "Historical actor",
                    "Affected resource",
                    "Details",
                  ].map((h) => (
                    <ResponsiveDataTableColumnHeader key={h}>
                      {h}
                    </ResponsiveDataTableColumnHeader>
                  ))}
                </ResponsiveDataTableHeader>
              )}
              <ResponsiveDataTableBody>
                {result.loading ? (
                  <DataTableSkeletonRows
                    label="management history"
                    rowClassName={`${grid} p-4`}
                    cellClassNames={["", "", "", "", ""]}
                    rows={5}
                  />
                ) : !coverage.readable ? (
                  <ResponsiveDataTableRow>
                    <ResponsiveDataTableCell
                      aria-colspan={5}
                      className="p-8 text-center text-sm"
                    >
                      <EmptyState
                        size="sm"
                        title="No integrated history source for this module"
                        description={
                          <>
                            {moduleLabels[filters.moduleId]}: {coverage.label}.{" "}
                            {coverage.explanation}
                          </>
                        }
                        action={
                          <Button
                            variant="outline"
                            onClick={() => setModuleScope("")}
                          >
                            Show All Modules
                          </Button>
                        }
                      />
                    </ResponsiveDataTableCell>
                  </ResponsiveDataTableRow>
                ) : result.error ? (
                  <DataTableErrorRow
                    colSpan={5}
                    message={result.error}
                    onRetry={result.retry}
                  />
                ) : !data?.events.length ? (
                  <ResponsiveDataTableRow>
                    <ResponsiveDataTableCell
                      aria-colspan={5}
                      className="p-8 text-center text-sm"
                    >
                      <EmptyState
                        size="sm"
                        title={
                          data && !data.complete
                            ? "No verified events in this incomplete window."
                            : "No audit events match this date range and filters."
                        }
                        description={
                          data && !data.complete
                            ? "Review source warnings before continuing."
                            : "Adjust the date range or filters to inspect other recorded management changes."
                        }
                      />
                    </ResponsiveDataTableCell>
                  </ResponsiveDataTableRow>
                ) : (
                  data.events.map((e) => (
                    <ResponsiveDataTableRow
                      key={e.eventId}
                      className={`${grid} border-b border-[#eceef1] p-4 text-xs last:border-0`}
                    >
                      <ResponsiveDataTableCell>
                        {formatDateTime(e.occurredAt, "UTC")} UTC
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <strong>{eventLabel(e)}</strong>
                        <p className="mt-1 text-[#738096]">
                          {moduleLabels[e.moduleId]}
                        </p>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="[overflow-wrap:anywhere]">
                        {e.actorId ?? "No actor recorded"}
                        <p className="mt-1 text-[#738096]">
                          Role at time:{" "}
                          {e.roleAtTime
                            ? humanizeEnum(e.roleAtTime)
                            : "Not recorded"}
                        </p>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="[overflow-wrap:anywhere]">
                        {humanizeEnum(e.subjectType)} · {e.subjectId}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <Button
                          variant="outline"
                          className="w-full px-2"
                          aria-label={`View event ${e.sourceEventId} from ${e.source}`}
                          onClick={() => setSelected(e)}
                        >
                          View event
                        </Button>
                      </ResponsiveDataTableCell>
                    </ResponsiveDataTableRow>
                  ))
                )}
              </ResponsiveDataTableBody>
            </ResponsiveDataTable>
            {coverage.readable && (
              <nav
                aria-label="Audit history pagination"
                className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <span>Page {cursors.length} · No global total</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={result.loading || cursors.length === 1}
                    onClick={() => {
                      setCursors((c) => c.slice(0, -1))
                      setSelected(null)
                    }}
                  >
                    Previous page
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      result.loading || !data || !canAdvanceHistory(data)
                    }
                    onClick={() => {
                      if (data?.nextCursor) {
                        setCursors((c) => [...c, data.nextCursor])
                        setSelected(null)
                      }
                    }}
                  >
                    Next page
                  </Button>
                </div>
              </nav>
            )}
            {selected && (
              <EventPanel
                key={selected.eventId}
                event={selected}
                filters={filters}
                onClose={() => setSelected(null)}
                onInvestigate={investigate}
              />
            )}
          </TabsContent>
          <TabsContent value="errors">
            <ErrorLogsView />
          </TabsContent>
          <TabsContent value="health">
            <SystemHealthView />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
