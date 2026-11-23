import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Eye } from "lucide-react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Avatar } from "@/components/ui/avatar"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { roleLabels } from "@/features/auth/model/roles"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import type { AuditLog, AuditLogActor } from "../api/audit-logs-api"

export function auditActorRole(actor: AuditLogActor) {
  if (actor.role) return roleLabels[actor.role]
  if (actor.attribution === "SYSTEM") return "Automated process"
  return actor.id ? "Role unavailable" : "Unknown"
}

const grid =
  "grid grid-cols-[minmax(220px,2fr)_minmax(145px,1.15fr)_100px_130px_78px_42px] items-center gap-3.5 @max-[850px]:grid-cols-[minmax(0,1fr)_auto]"

function rowClass(_log: AuditLog, _index: number, isLast: boolean) {
  return cn(
    grid,
    "h-[72px] border-b border-[#eceef1] bg-background px-4 py-[9px] text-xs text-foreground transition-colors hover:bg-[#e8eef2] @max-[850px]:h-[210px] @max-[850px]:content-center @max-[850px]:gap-x-3 @max-[850px]:gap-y-3 @max-[850px]:py-4",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

const logKey = (log: AuditLog) => log.id

function AuditLogSummaryCell({ log }: { log: AuditLog }) {
  const count = log.effects?.length ?? 0
  const changeCount = count > 1 ? `${count} recorded changes` : null
  const detail = [log.summaryDetail, changeCount].filter(Boolean).join(" · ")

  return (
    <ResponsiveDataTableCell className="grid min-w-0 gap-1 @max-[850px]:col-span-2">
      <strong
        className="line-clamp-2 min-w-0 font-medium wrap-anywhere text-foreground"
        title={log.message}
      >
        {log.message}
      </strong>
      {detail && (
        <span className="truncate text-[11px] text-[#738096]" title={detail}>
          {detail}
        </span>
      )}
    </ResponsiveDataTableCell>
  )
}

export function matchesAuditLogSearch(log: AuditLog, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return [
    log.message,
    log.summaryDetail,
    log.target.label,
    log.target.type,
    ...log.changes.flatMap(({ field, before, after }) => [
      field,
      before === null ? null : String(before),
      after === null ? null : String(after),
    ]),
    log.actor.name,
    log.actor.id,
    log.operationId,
    ...(log.effects?.flatMap(({ action, target, notes }) => [
      action,
      target.id,
      target.type,
      target.label,
      ...notes.map(({ value }) => value),
    ]) ?? []),
    log.event,
    log.action,
    log.source,
    log.endpoint,
    log.subjectId,
    log.requestId,
    log.projectId,
    log.projectName,
    log.workspaceId,
    log.correlationId,
    log.failureCode,
    log.failureReason,
  ].some((value) => value?.toLocaleLowerCase().includes(needle))
}

export function AuditLogsTable({
  title,
  sourceLabels,
  logs,
  loading,
  error,
  viewKey,
  quickKey,
  onRowsSettled,
  onRetry,
  onView,
}: {
  title: string
  sourceLabels: Readonly<Record<string, string>>
  logs: AuditLog[]
  loading: boolean
  error: string
  viewKey: string
  quickKey: string
  onRowsSettled?: () => void
  onRetry: () => void
  onView: (log: AuditLog) => void
}) {
  const { formatDateTime } = useDatePreferences()
  const initialLoading = loading && viewKey === ""
  return (
    <ResponsiveDataTable label={title} aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[850px]:hidden"
        rowClassName={grid}
      >
        <ResponsiveDataTableColumnHeader>
          What happened
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Performed by
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Area</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Time</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Status
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader className="text-right">
          View
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>
      {initialLoading || error ? (
        <ResponsiveDataTableBody className="relative min-w-0">
          {initialLoading ? (
            <DataTableSkeletonRows
              label={title}
              rows={6}
              rowClassName={cn(
                grid,
                "h-[72px] px-4 py-[9px] @max-[850px]:h-[210px]",
              )}
              cellClassNames={[
                "@max-[850px]:col-span-2",
                "@max-[850px]:col-start-1",
                "@max-[850px]:col-start-1",
                "@max-[850px]:col-start-1",
                "@max-[850px]:col-start-2 @max-[850px]:row-start-4 @max-[850px]:justify-self-end",
                "@max-[850px]:col-start-2 @max-[850px]:row-start-2",
              ]}
              cellSkeletonClassNames={[
                "h-9 w-4/5",
                "h-8 w-3/4",
                "h-4 w-20",
                "h-4 w-24",
                "h-4 w-12",
                "size-8",
              ]}
            />
          ) : (
            <DataTableErrorRow message={error} colSpan={6} onRetry={onRetry} />
          )}
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={logs}
          viewKey={viewKey}
          quickKey={quickKey}
          onRowsSettled={onRowsSettled}
          animateRows={false}
          getKey={logKey}
          rowClassName={rowClass}
          emptyContent="No logs match your search and filters."
          emptyHeight={170}
          defaultRowHeight={72}
          ariaBusy={loading}
          className="relative min-w-0"
          renderRow={(log) => (
            <>
              <AuditLogSummaryCell log={log} />
              <ResponsiveDataTableCell className="flex min-w-0 items-center gap-2.5 @max-[850px]:col-start-1">
                <Avatar name={log.actor.name} className="size-8" fallback="S" />
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{log.actor.name}</span>
                  <span className="text-[11px] text-[#738096]">
                    {auditActorRole(log.actor)}
                  </span>
                </div>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 @max-[850px]:col-start-1">
                <span className="mr-1.5 hidden text-[#738096] @max-[850px]:inline">
                  Area
                </span>
                <span>{sourceLabels[log.source] ?? log.source}</span>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 text-[11px] text-[#738096] @max-[850px]:col-start-1">
                <span className="mr-1.5 hidden @max-[850px]:inline">Time</span>
                {formatDateTime(log.createdAt)}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="@max-[850px]:col-start-2 @max-[850px]:row-start-4 @max-[850px]:justify-self-end">
                <Pill tone={log.outcome === "SUCCESS" ? "success" : "danger"}>
                  {log.outcome === "SUCCESS" ? "Success" : "Failed"}
                </Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="justify-self-end @max-[850px]:col-start-2 @max-[850px]:row-start-2">
                <button
                  type="button"
                  className={rowActionButton}
                  aria-label={`View log: ${log.message}`}
                  onClick={() => onView(log)}
                >
                  <Eye className="size-4" aria-hidden="true" />
                  <HoverTooltip>View log details</HoverTooltip>
                </button>
              </ResponsiveDataTableCell>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
