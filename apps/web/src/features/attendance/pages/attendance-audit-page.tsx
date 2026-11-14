"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
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

export function AttendanceAuditPage() {
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState("")
  const [selected, setSelected] = useState<AttendanceAuditEvent | null>(null)
  const departments = useAsyncResource(attendanceDepartments, [], {
    fallbackError: "Couldn't load departments.",
  })
  const result = useAsyncResource(
    (signal) =>
      attendanceAudit(range.from, range.to, page, "", departmentId, signal),
    [range.from, range.to, page, departmentId],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load the attendance audit trail.",
    },
  )
  const data = result.loading || result.error ? undefined : result.data
  return (
    <AttendanceShell tab="audit">
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
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
      <ResponsiveDataTable
        label="Attendance audit events"
        aria-busy={result.loading}
      >
        <ResponsiveDataTableHeader
          className="@max-[900px]:sr-only"
          rowClassName={grid}
        >
          {["Recorded at (UTC)", "Actor", "Employee", "Change", "Details"].map(
            (label) => (
              <ResponsiveDataTableColumnHeader key={label}>
                {label}
              </ResponsiveDataTableColumnHeader>
            ),
          )}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {result.loading ? (
            <DataTableSkeletonRows
              label="audit events"
              rows={5}
              rowClassName={grid}
              cellClassNames={["", "", "", "", ""]}
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
              message="No audit events in this period and scope."
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
                  {event.actor?.fullName ?? "System / unavailable actor"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {event.employee?.fullName ?? "Policy or configuration"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Pill tone="neutral">{humanizeEnum(event.action)}</Pill>
                  <p className="mt-1 mb-0 break-words text-[#738096]">
                    {humanizeEnum(
                      event.entityType.replace(/([a-z])([A-Z])/g, "$1_$2"),
                    )}
                  </p>
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Button
                    variant="outline"
                    size="panel"
                    onClick={() => setSelected(event)}
                    aria-label={"View audit event " + event.id}
                  >
                    Details
                  </Button>
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {data && <AttendancePagination data={data} onChange={setPage} />}
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
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Audit event details"
        description={
          humanizeEnum(event.entityType.replace(/([a-z])([A-Z])/g, "$1_$2")) +
          " - " +
          humanizeEnum(event.action)
        }
      />
      <SidePanelBody>
        <SidePanelSection title="Recorded change">
          <DetailList>
            <DetailItem label="Actor">
              {event.actor?.fullName ?? event.actorId ?? "System"}
            </DetailItem>
            <DetailItem label="Employee">
              {event.employee?.fullName ?? "Policy or configuration"}
            </DetailItem>
            <DetailItem label="Recorded at (UTC)">
              {formatDateTime(event.createdAt, "UTC")}
            </DetailItem>
            <DetailItem label="Reason">
              {event.reason || "No reason recorded"}
            </DetailItem>
          </DetailList>
        </SidePanelSection>
        {(["before", "after"] as const).map((key) => (
          <SidePanelSection
            key={key}
            title={key === "before" ? "Before" : "After"}
          >
            <pre className="m-0 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(event[key], null, 2) ?? "No snapshot"}
            </pre>
          </SidePanelSection>
        ))}
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}
