"use client"

import { HoverTooltip } from "@/components/ui/hover-tooltip"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eye, Plus } from "lucide-react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { MemberIdentity } from "@/components/ui/member-identity"
import { Pill } from "@/components/ui/pill"
import {
  DataTableEmptyRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import { TeamMemberPanel, type TeamMember } from "./team-member-panel"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import { ProjectStaffingDialog } from "@/features/request-workflow/components/project-staffing-dialog"
import {
  notifyProjectWorkspaceListChanged,
  type ProjectWorkspaceDetail,
} from "../api/project-workspace-api"

const teamGrid =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(88px,.8fr)_56px] items-center gap-3 @max-[640px]:grid-cols-[minmax(0,1fr)_auto]"
const teamCells = [
  "min-w-0 @max-[640px]:col-start-1 @max-[640px]:row-start-1",
  "min-w-0 @max-[640px]:col-span-2",
  "min-w-0 @max-[640px]:col-span-2",
  "min-w-0 @max-[640px]:col-span-2",
  "justify-self-end @max-[640px]:col-start-2 @max-[640px]:row-start-1",
] as const

function AssignStaff({
  requestId,
  onChanged,
}: {
  requestId: string
  onChanged: () => void
}) {
  const controls = useRequestWorkflow(requestId)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const allowed =
    controls.workflow?.permissions.manage &&
    [
      "AGREEMENT_PAYMENT_PENDING",
      "READY_FOR_ACTIVATION",
      "ACTIVE_PROJECT",
    ].includes(controls.workflow.state)
  return (
    <>
      <Button
        ref={trigger}
        variant="brand"
        className="text-xs"
        disabled={!allowed || controls.loading}
        onClick={() => setOpen(true)}
      >
        <Plus size={15} />
        Assign staff
      </Button>
      {controls.error && <Alert variant="text">{controls.error}</Alert>}
      {open && controls.workflow && (
        <ProjectStaffingDialog
          workflow={controls.workflow}
          controls={controls}
          mode="staffing"
          onMutationSuccess={notifyProjectWorkspaceListChanged}
          onClose={() => {
            setOpen(false)
            onChanged()
          }}
          onReturnFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  )
}

export function WorkspaceTeam({
  workspace,
  onChanged,
  onUpdated,
}: {
  workspace: ProjectWorkspaceDetail
  onChanged: () => void
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
}) {
  const { formatDate } = useDatePreferences()
  const [search, setSearch] = useState("")
  const [settledSearch, setSettledSearch] = useState("")
  const searchPending = search.trim() !== settledSearch
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => {
      setSettledSearch(search.trim())
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search, searchPending])
  const [streamId, setStreamId] = useState("all")
  const [detailId, setDetailId] = useState<string | null>(null)
  const rows = useMemo(
    () =>
      workspace.workstreams
        .flatMap((stream) =>
          (stream.staff ?? []).map((person): TeamMember => ({
            id: `${stream.id}-${person.id}`,
            person,
            stream,
          })),
        )
        .sort(
          (a, b) => Number(b.person.isTeamLead) - Number(a.person.isTeamLead),
        ),
    [workspace.workstreams],
  )
  const visible = useMemo(
    () =>
      rows.filter(
        ({ person, stream }) =>
          (streamId === "all" || stream.id === streamId) &&
          `${person.fullName} ${person.position ?? ""} ${person.profileSpecialties.join(" ")}`
            .toLowerCase()
            .includes(settledSearch.toLowerCase()),
      ),
    [rows, streamId, settledSearch],
  )
  const manageable = workspace.workstreams.filter(
    (stream) =>
      stream.canAssign &&
      stream.requestId &&
      (streamId === "all" || stream.id === streamId),
  )
  const detail = rows.find(({ id }) => id === detailId)
  const teamLead = rows.find(({ person }) => person.isTeamLead)
  const serviceOptions = [
    { value: "all", label: "All services" },
    ...workspace.workstreams.map((stream) => ({
      value: stream.id,
      label: stream.serviceName,
    })),
  ]
  return (
    <section aria-label="Project team">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold">
          Project team{" "}
          <span className="ml-2 font-normal text-[#65718a]">
            {new Set(rows.map(({ person }) => person.id)).size} assigned staff
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {manageable.map((stream) => (
            <div key={stream.id} className="flex items-center gap-2">
              {manageable.length > 1 && (
                <span className="text-xs text-[#65718a]">
                  {stream.serviceName}
                </span>
              )}
              <AssignStaff
                requestId={stream.requestId!}
                onChanged={onChanged}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={cn("mb-4", filterBarClass)}>
        <SearchField
          label="Search assigned staff"
          placeholder="Search name, position, or skills..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label="Filter team by service"
          value={streamId}
          options={serviceOptions}
          triggerClassName="w-[190px]"
          onChange={setStreamId}
        />
      </div>
      <div>
        <ResponsiveDataTable label="Assigned staff" aria-busy={searchPending}>
          <ResponsiveDataTableHeader
            className="@max-[640px]:sr-only"
            rowClassName={teamGrid}
          >
            {["Staff", "Position", "Service", "Assigned on", "Actions"].map(
              (label) => (
                <ResponsiveDataTableColumnHeader key={label}>
                  {label}
                </ResponsiveDataTableColumnHeader>
              ),
            )}
          </ResponsiveDataTableHeader>
          {searchPending ? (
            <ResponsiveDataTableBody>
              <DataTableSkeletonRows
                label="assigned staff"
                rows={5}
                rowClassName={cn(teamGrid, "min-h-[58px] px-4 py-3")}
                cellClassNames={[...teamCells]}
              />
            </ResponsiveDataTableBody>
          ) : rows.length === 0 ? (
            <ResponsiveDataTableBody>
              <DataTableEmptyRow colSpan={5}>
                No staff assigned yet
              </DataTableEmptyRow>
            </ResponsiveDataTableBody>
          ) : (
            <AnimatedSlotGridBody
              items={visible}
              getKey={(row) => row.id}
              viewKey={JSON.stringify([settledSearch, streamId])}
              quickKey={settledSearch}
              animateRows={false}
              autoRowHeight
              rowClassName={(_person, _index, isLast) =>
                cn(
                  teamGrid,
                  "min-h-[58px] px-4 py-3 text-xs hover:bg-[#f8fafd]",
                  !isLast && "border-b border-[#eceef1]",
                )
              }
              emptyContent="No staff match these filters."
              renderRow={({ id, person, stream }) => (
                <>
                  <ResponsiveDataTableCell className={teamCells[0]}>
                    <MemberIdentity
                      member={person}
                      secondaryText={null}
                      nameAdornment={
                        person.isTeamLead && <Pill>Team lead</Pill>
                      }
                    />
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell
                    className={cn(teamCells[1], "break-words text-[#60718c]")}
                  >
                    <span className="hidden font-medium @max-[640px]:inline">
                      Position:{" "}
                    </span>
                    {person.position || "Staff"}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className={teamCells[2]}>
                    <span className="mr-1 hidden font-medium text-[#60718c] @max-[640px]:inline">
                      Service:
                    </span>
                    <Pill
                      className="max-w-full align-middle"
                      title={stream.serviceName}
                    >
                      {stream.serviceName}
                    </Pill>
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell
                    className={cn(teamCells[3], "text-[#60718c]")}
                  >
                    <span className="hidden font-medium @max-[640px]:inline">
                      Assigned on:{" "}
                    </span>
                    <time dateTime={person.approvedAt}>
                      {formatDate(person.approvedAt)}
                    </time>
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className={teamCells[4]}>
                    <button
                      type="button"
                      id={`team-member-view-${id}`}
                      className={rowActionButton}
                      aria-label={`View ${person.fullName}`}
                      onClick={() => setDetailId(id)}
                    >
                      <Eye size={16} aria-hidden="true" />
                      <HoverTooltip>View team member</HoverTooltip>
                    </button>
                  </ResponsiveDataTableCell>
                </>
              )}
            />
          )}
        </ResponsiveDataTable>
        {!searchPending && rows.length > 0 && (
          <p className="m-0 px-1 py-3 text-[11px] text-[#738096]">
            Showing {visible.length} of {rows.length} assignments
          </p>
        )}
      </div>
      {detail && (
        <TeamMemberPanel
          key={detail.id}
          workspace={workspace}
          member={detail}
          teamLead={teamLead}
          onUpdated={onUpdated}
          onClose={() => setDetailId(null)}
        />
      )}
    </section>
  )
}
