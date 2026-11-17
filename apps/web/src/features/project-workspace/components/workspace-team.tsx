"use client"

import { useMemo, useRef, useState } from "react"
import { Eye, Plus, UsersRound } from "lucide-react"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { TeamMemberPanel, type TeamMember } from "./team-member-panel"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import { ProjectStaffingDialog } from "@/features/request-workflow/components/project-staffing-dialog"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"

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
  const [search, setSearch] = useState("")
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
            .includes(search.trim().toLowerCase()),
      ),
    [rows, streamId, search],
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
          <span className="ml-2 font-normal text-[#738096]">
            {new Set(rows.map(({ person }) => person.id)).size} assigned staff
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {manageable.map((stream) => (
            <div key={stream.id} className="flex items-center gap-2">
              {manageable.length > 1 && (
                <span className="text-xs text-[#738096]">
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
      <div className="mb-4 flex flex-wrap gap-2.5">
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
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-[#dfe5ec]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#edf1f5]">
              <tr>
                {["Staff", "Position", "Service", "Assigned on", "Actions"].map(
                  (label) => (
                    <th key={label} className="px-4 py-3 font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <AnimatedTableBody
              items={visible}
              viewKey={JSON.stringify([search, streamId])}
              quickKey={search}
              columns={5}
              rowClassName="border-t border-[#edf0f4]"
              emptyContent="No staff match these filters."
              renderRow={({ id, person, stream }) => (
                <>
                  {" "}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={person.fullName} className="size-8" />
                      <span className="font-medium">{person.fullName}</span>
                      {person.isTeamLead && (
                        <span className="rounded-md bg-[#e9effc] px-2 py-1 text-[11px] text-[#294c96]">
                          Team lead
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#60718c]">
                    {person.position || "Staff"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-[#e9effc] px-2 py-1 text-[11px] text-[#294c96]">
                      {stream.serviceName}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[#60718c]">
                    {new Date(person.approvedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      id={`team-member-view-${id}`}
                      className={rowActionButton}
                      aria-label={`View ${person.fullName}`}
                      onClick={() => setDetailId(id)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </>
              )}
            />
          </table>
          <p className="m-0 border-t border-[#edf0f4] px-4 py-3 text-[11px] text-[#738096]">
            Showing {visible.length} of {rows.length} assignments
          </p>
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title="No staff assigned yet"
          description="The department head can assign eligible staff once the booking is ready for staffing."
        />
      )}
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
