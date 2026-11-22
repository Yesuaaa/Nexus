"use client"
import { useEffect, useState } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import { TableSearchStatus } from "@/components/ui/table-search-status"
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
import { useAsyncResource } from "@/lib/use-async-resource"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import {
  attendanceAudit,
  attendanceDepartments,
  type AttendanceAuditEvent,
} from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import {
  RangeFields,
  ResourceStatus,
  AttendancePagination,
  AttendanceTableEmpty,
} from "../components/attendance-shared"
import { defaultRange } from "../model/attendance"

const grid =
  "grid grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(160px,1.3fr)_80px] items-center gap-3.5 @max-[900px]:grid-cols-1"

const snapshotFields = [
  ["type", "Request type"],
  ["status", "Status"],
  ["overtimeMinutes", "Overtime requested"],
  ["proposedStartedAt", "Proposed start"],
  ["proposedEndedAt", "Proposed end"],
  ["workDate", "Work date"],
  ["startedAt", "Started at"],
  ["endedAt", "Ended at"],
  ["cancelledAt", "Cancelled at"],
  ["createdAt", "Created at"],
  ["reviewedAt", "Reviewed at"],
  ["verifiedAt", "Verified at"],
  ["reviewNote", "Review note"],
  ["verificationNote", "Verification note"],
] as const

function isAuditSnapshot(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatSnapshotValue(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number" && key === "overtimeMinutes")
    return `${value} minutes`
  if (typeof value === "string") {
    if (key === "type" || key === "status") return humanizeEnum(value)
    if (key.endsWith("At")) return formatDateTime(value, "UTC")
    return value
  }
  return String(value)
}

function snapshotDetails(snapshot: unknown) {
  if (!isAuditSnapshot(snapshot)) return []
  return snapshotFields.flatMap(([key, label]) => {
    const value = snapshot[key]
    return value === null || value === undefined
      ? []
      : [{ label, value: formatSnapshotValue(key, value) }]
  })
}

function actorName(event: AttendanceAuditEvent) {
  return (
    event.actor?.fullName?.trim() ||
    (event.actorId ? "Name unavailable" : "No actor recorded")
  )
}

function affectedEmployeeName(event: AttendanceAuditEvent) {
  const name = event.employee?.fullName?.trim()
  if (name) return name
  if (
    event.entityType === "AttendancePolicy" ||
    event.entityType === "AttendancePolicyDay"
  )
    return "Not applicable (policy change)"
  return "Employee unavailable"
}

function auditEntityName(event: AttendanceAuditEvent) {
  const snapshot = isAuditSnapshot(event.after)
    ? event.after
    : isAuditSnapshot(event.before)
      ? event.before
      : undefined
  if (event.entityType === "AttendanceAdjustment") {
    const type = snapshot?.type
    if (type === "OVERTIME") return "overtime request"
    if (type === "CORRECTION") return "attendance correction"
    return "attendance adjustment"
  }
  const names: Record<string, string> = {
    AttendanceBreak: "attendance break",
    AttendancePolicy: "attendance policy",
    AttendancePolicyAssignment: "policy assignment",
    AttendancePolicyDay: "policy schedule",
    AttendanceWorkday: "attendance workday",
    AttendanceWorkSession: "attendance session",
  }
  return (
    names[event.entityType] ??
    humanizeEnum(event.entityType.replace(/([a-z])([A-Z])/g, "$1_$2"))
  ).toLowerCase()
}

function describeAuditChange(event: AttendanceAuditEvent) {
  const verbs: Record<string, string> = {
    INSERT: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
  }
  const verb = verbs[event.action] ?? humanizeEnum(event.action)
  const subject = auditEntityName(event)
  const article = /^[aeiou]/i.test(subject) ? "an" : "a"
  return `${verb} ${article} ${subject}`
}

export function AttendanceAuditPage() {
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState("")
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [settledQuery, setSettledQuery] = useState(query)
  const searchPending = query !== settledQuery
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => setSettledQuery(query), 200)
    return () => window.clearTimeout(timer)
  }, [query, searchPending])
  const [selected, setSelected] = useState<AttendanceAuditEvent | null>(null)
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const result = useAsyncResource(
    (signal) =>
      attendanceAudit(
        range.from,
        range.to,
        page,
        "",
        departmentId,
        signal,
        false,
        settledQuery,
      ),
    [range.from, range.to, page, departmentId, settledQuery],
    {
      enabled: Boolean(range.from && range.to) && !searchPending,
      fallbackError: "Couldn't load the attendance audit trail.",
    },
  )
  const data = result.error ? undefined : result.data
  return (
    <AttendanceShell tab="audit">
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <SearchField
          label="Search audit events"
          placeholder="Search employee, actor, event type or reason…"
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <RangeFields
          {...range}
          onChange={(from, to) => {
            setRange({ from, to })
            setPage(1)
          }}
        />
        <FilterSelect
          label="Audit department"
          value={departmentId}
          onChange={(value) => {
            setDepartmentId(value)
            setPage(1)
          }}
          disabled={departments.loading}
          options={[
            { value: "", label: "All permitted departments" },
            ...(departments.data?.departments ?? []).map((d) => ({
              value: d.id,
              label: d.name,
            })),
          ]}
        />
      </div>
      <p className="mb-4 text-xs text-[#738096]">
        Dates filter the event timestamp in UTC. This history records business
        changes and review decisions; it is not developer diagnostics.
      </p>
      <ResourceStatus
        loading={false}
        error={departments.error}
        retry={departments.retry}
      />
      <TableSearchStatus
        active={searchPending || (result.loading && Boolean(query))}
        label="attendance audit events"
      />
      <ResponsiveDataTable
        label="Attendance audit events"
        aria-busy={result.loading || searchPending}
      >
        <ResponsiveDataTableHeader
          className="@max-[900px]:sr-only"
          rowClassName={grid}
        >
          {["Recorded at (UTC)", "Actor", "Employee", "Change", "Actions"].map(
            (label) => (
              <ResponsiveDataTableColumnHeader key={label}>
                {label}
              </ResponsiveDataTableColumnHeader>
            ),
          )}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {result.loading && !data ? (
            <DataTableSkeletonRows
              label="audit events"
              rows={5}
              rowClassName={`${grid} min-h-[58px] px-4 py-3`}
              cellClassNames={[
                "",
                "",
                "",
                "",
                "@max-[900px]:justify-self-start",
              ]}
              cellSkeletonClassNames={[
                "h-3 w-28",
                "h-3 w-24",
                "h-3 w-32",
                "h-3 w-4/5",
                "size-8",
              ]}
            />
          ) : result.error ? (
            <DataTableErrorRow
              message={result.error}
              colSpan={5}
              onRetry={result.retry}
            />
          ) : !data?.events.length ? (
            <AttendanceTableEmpty
              colSpan={5}
              message={
                query ? (
                  <SearchEmptyState query={query} />
                ) : (
                  "No audit events in this period and scope."
                )
              }
            />
          ) : (
            data.events.map((event) => (
              <ResponsiveDataTableRow
                key={event.id}
                className={
                  grid +
                  " border-b border-[#eceef1] px-4 py-3 text-xs last:border-b-0"
                }
              >
                <ResponsiveDataTableCell>
                  {formatDateTime(event.createdAt, "UTC")}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {actorName(event)}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {affectedEmployeeName(event)}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <p className="m-0 break-words font-medium text-[#182235]">
                    {describeAuditChange(event)}
                  </p>
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Button
                    variant="outline"
                    size="panel"
                    className="size-8 p-0"
                    onClick={() => setSelected(event)}
                    aria-label={"View audit event " + event.id}
                    title="View audit event"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </Button>
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {data && !result.loading && !searchPending && (
        <AttendancePagination data={data} onChange={setPage} />
      )}
      {selected && (
        <AuditDetails event={selected} onClose={() => setSelected(null)} />
      )}
    </AttendanceShell>
  )
}

function AuditDetails({
  event,
  onClose,
}: {
  event: AttendanceAuditEvent
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const changeDetails = snapshotDetails(event.after ?? event.before)
  const previousValues = snapshotDetails(event.before)
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Audit event details"
        description={describeAuditChange(event)}
      />
      <SidePanelBody>
        <SidePanelSection title="Recorded change">
          <DetailList>
            <DetailItem label="Performed by">{actorName(event)}</DetailItem>
            <DetailItem label="Affected employee">
              {affectedEmployeeName(event)}
            </DetailItem>
            <DetailItem label="Change">{describeAuditChange(event)}</DetailItem>
            <DetailItem label="Recorded at (UTC)">
              {formatDateTime(event.createdAt, "UTC")}
            </DetailItem>
            <DetailItem label="Reason">
              {event.reason || "No reason recorded"}
            </DetailItem>
          </DetailList>
        </SidePanelSection>
        <SidePanelSection title="Change details">
          {changeDetails.length ? (
            <DetailList>
              {changeDetails.map((detail) => (
                <DetailItem key={detail.label} label={detail.label}>
                  {detail.value}
                </DetailItem>
              ))}
            </DetailList>
          ) : (
            <p className="m-0 text-xs text-[#65718a]">
              No additional event details were recorded.
            </p>
          )}
        </SidePanelSection>
        {previousValues.length > 0 && (
          <SidePanelSection title="Previous values">
            <DetailList>
              {previousValues.map((detail) => (
                <DetailItem key={detail.label} label={detail.label}>
                  {detail.value}
                </DetailItem>
              ))}
            </DetailList>
          </SidePanelSection>
        )}
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}
