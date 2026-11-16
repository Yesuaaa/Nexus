"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
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
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { moduleRegistry } from "@/features/workspaces/model/module-registry"
import { loadErrors } from "../api/error-logs-api"
import {
  defaultErrorFilters,
  errorQuery,
  errorModules,
  type ErrorFilters,
  type ErrorEvent,
} from "../model/error-logs"

const grid =
  "grid grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_minmax(190px,1.5fr)_minmax(110px,1fr)_70px_70px] items-center gap-3 @max-[900px]:grid-cols-1"
const labelClass = "grid min-w-0 gap-1.5 text-xs font-medium text-[#52627a]"
const moduleLabels: Record<string, string> = {
  platform: "Platform",
  ...Object.fromEntries(
    Object.entries(moduleRegistry).map(([id, m]) => [id, m.title]),
  ),
}
function ErrorPanel({
  event,
  onClose,
}: {
  event: ErrorEvent
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() => document.getElementById("errors-heading")}
    >
      <SidePanelHeader
        title="Error details"
        description="Sanitized record from this API instance. This snapshot may expire or be evicted from the buffer."
        closeLabel="Close error details"
      />
      <SidePanelBody>
        <SidePanelSection title={event.code}>
          <DetailList layout="stacked">
            {Object.entries({
              "Error ID": event.errorId,
              "Timestamp (UTC)": `${formatDateTime(event.occurredAt, "UTC")} UTC`,
              Module: moduleLabels[event.moduleId],
              Category: humanizeEnum(event.category),
              Severity: "Error",
              Operation: event.operation,
              "Safe message": event.message,
              "HTTP method": event.method ?? "Internal operation",
              "Route template": event.routeTemplate ?? "Not recorded",
              "HTTP status": event.status ?? "Not applicable",
              "Correlation ID": event.requestId,
              "Verified actor ID": event.actorId ?? "Not recorded",
            }).map(([label, value]) => (
              <DetailItem key={label} label={label}>
                {value}
              </DetailItem>
            ))}
          </DetailList>
        </SidePanelSection>
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}
export function ErrorLogsView() {
  const [draft, setDraft] = useState(defaultErrorFilters)
  const [filters, setFilters] = useState(draft)
  const [validation, setValidation] = useState("")
  const [selected, setSelected] = useState<ErrorEvent | null>(null)
  const key = JSON.stringify(filters)
  const result = useAsyncResource(
    (signal) => loadErrors(filters, signal),
    [key],
    { fallbackError: "Error logs could not be loaded." },
  )
  const data = !result.loading && !result.error ? result.data : undefined
  const update = (field: keyof ErrorFilters, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      errorQuery(draft)
      setValidation("")
      setSelected(null)
      setFilters({ ...draft })
      if (JSON.stringify(draft) === key) result.retry()
    } catch {
      setValidation("Choose valid UTC times with from time before to time.")
    }
  }
  return (
    <>
      <h2
        id="errors-heading"
        className="mb-3 text-sm font-semibold"
        tabIndex={-1}
      >
        Errors &amp; Exceptions
      </h2>
      <div
        role="note"
        aria-label="Error log coverage"
        className="mb-4 rounded-lg border border-[#e1e4ea] bg-[#f6f8fb] p-4 text-xs leading-relaxed"
      >
        <strong>Instance-local coverage only.</strong> Up to 1,000 records,
        24-hour retention, newest 100 matching records per response. Records are
        lost on restart; replicas have separate buffers. This is not complete
        historical or cross-replica coverage.
      </div>
      <form
        onSubmit={apply}
        aria-label="Filter error logs"
        className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {(
          [
            ["moduleId", "Module", errorModules],
            ["category", "Category", ["application", "database", "internal"]],
            ["severity", "Severity", ["error"]],
          ] as const
        ).map(([field, label, options]) => (
          <div key={field} className={labelClass}>
            <span>{label}</span>
            <FilterSelect
              label={`Error ${label.toLowerCase()} filter`}
              value={draft[field]}
              onChange={(v) => update(field, v)}
              options={[
                { value: "", label: `All ${label.toLowerCase()} values` },
                ...options.map((value) => ({
                  value,
                  label:
                    field === "moduleId"
                      ? moduleLabels[value]
                      : humanizeEnum(value),
                })),
              ]}
              triggerClassName="w-full"
            />
          </div>
        ))}
        <label className={labelClass}>
          HTTP status
          <Input
            type="number"
            min={100}
            max={599}
            value={draft.status}
            onChange={(e) => update("status", e.target.value)}
            placeholder="Any status"
          />
        </label>
        {(["from", "to"] as const).map((field) => (
          <label key={field} className={labelClass}>
            {field === "from" ? "From time (UTC)" : "To time (UTC)"}
            <Input
              type="datetime-local"
              value={draft[field]}
              onChange={(e) => update(field, e.target.value)}
            />
          </label>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" variant="brand">
            Apply error filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = defaultErrorFilters()
              setDraft(next)
              setFilters(next)
              setSelected(null)
              setValidation("")
              result.retry()
            }}
          >
            Reset error filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelected(null)
              result.retry()
            }}
          >
            Refresh errors
          </Button>
        </div>
        {validation && (
          <p role="alert" className="text-xs text-destructive">
            {validation}
          </p>
        )}
      </form>
      {data && (
        <div className="mb-4 space-y-2 text-xs" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="text-xs">
              {data.returnedCount}{" "}
              {data.returnedCount === 1 ? "error" : "errors"} shown
            </Pill>
            <span>
              {data.matchedRetainedCount} matching retained records in this
              instance
            </span>
          </div>
          <p>
            Retention cutoff: {formatDateTime(data.retentionCutoff, "UTC")} UTC.
            Counters below are since this process started; expired matches
            cannot be reconstructed.
          </p>
          {data.truncated && (
            <p role="alert">
              Response truncated to 100 errors. Narrow the filters to
              investigate more retained matches.
            </p>
          )}
          <p
            role={
              data.evictedCount || data.droppedCount || data.expiredCount
                ? "alert"
                : "note"
            }
          >
            {data.evictedCount} evicted · {data.droppedCount} dropped ·{" "}
            {data.expiredCount} expired records
          </p>
        </div>
      )}
      <ResponsiveDataTable
        label="Application error records"
        aria-busy={result.loading}
      >
        <ResponsiveDataTableHeader rowClassName={`${grid} @max-[900px]:hidden`}>
          {[
            "Timestamp (UTC)",
            "Module / category",
            "Code",
            "Operation",
            "HTTP",
            "Details",
          ].map((label) => (
            <ResponsiveDataTableColumnHeader key={label}>
              {label}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {result.loading ? (
            <DataTableSkeletonRows
              label="error logs"
              rowClassName={`${grid} p-4`}
              cellClassNames={["", "", "", "", "", ""]}
              rows={5}
            />
          ) : result.error ? (
            <DataTableErrorRow
              message={result.error}
              onRetry={result.retry}
              colSpan={6}
            />
          ) : !data?.events.length ? (
            <ResponsiveDataTableRow>
              <ResponsiveDataTableCell aria-colspan={6} className="p-5">
                <EmptyState
                  size="sm"
                  title={
                    data?.windowExpired
                      ? "Selected time window has expired"
                      : "No retained errors match these filters."
                  }
                  description={
                    data?.windowExpired
                      ? "Outside the 24-hour buffer. Historical matches are unknown."
                      : "Adjust the filters to inspect other retained records. This does not prove that no failures occurred."
                  }
                />
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ) : (
            data.events.map((event) => (
              <ResponsiveDataTableRow
                key={event.errorId}
                className={`${grid} border-b border-[#eceef1] p-4 text-xs leading-5 last:border-0`}
              >
                <ResponsiveDataTableCell aria-label="Timestamp (UTC)">
                  {formatDateTime(event.occurredAt, "UTC")}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell aria-label="Module / category">
                  <strong>{moduleLabels[event.moduleId]}</strong>
                  <p className="mt-1 text-[#738096]">
                    {humanizeEnum(event.category)}
                  </p>
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell aria-label="Code">
                  {event.code}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell aria-label="Operation">
                  {event.operation}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell aria-label="HTTP">
                  {event.status ?? "—"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell aria-label="Details">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(event)}
                  >
                    Details
                  </Button>
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {selected && (
        <ErrorPanel
          key={selected.errorId}
          event={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
