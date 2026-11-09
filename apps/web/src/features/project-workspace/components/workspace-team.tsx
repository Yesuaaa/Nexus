"use client"

import { useMemo, useRef, useState } from "react"
import { Eye, Plus, UsersRound } from "lucide-react"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { TaskRowActions } from "./task-row-actions"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import { ProjectStaffingDialog } from "@/features/request-workflow/components/project-staffing-dialog"
import {
  assignProjectTeamLead,
  type ProjectWorkspaceDetail,
} from "../api/project-workspace-api"

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
        className="bg-[#294c96] text-xs text-white hover:bg-[#203f80]"
        disabled={!allowed || controls.loading}
        onClick={() => setOpen(true)}
      >
        <Plus size={15} />
        Assign staff
      </Button>
      {controls.error && (
        <p role="alert" className="text-xs text-red-700">
          {controls.error}
        </p>
      )}
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
  const [savingLead, setSavingLead] = useState(false)
  const [leadError, setLeadError] = useState("")
  const rows = useMemo(
    () =>
      workspace.workstreams
        .flatMap((stream) =>
          (stream.staff ?? []).map((person) => ({
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
  const assignedTasks =
    detail?.stream.plan?.phases.flatMap((phase) =>
      phase.tasks
        .filter((task) => task.employeeId === detail.person.id)
        .map((task) => ({ task, phase: phase.title })),
    ) ?? []

  async function saveTeamLead() {
    if (!detail || savingLead) return
    setSavingLead(true)
    setLeadError("")
    try {
      onUpdated(
        await assignProjectTeamLead(
          workspace.id,
          detail.stream.id,
          detail.person.id,
        ),
      )
    } catch (error) {
      setLeadError(
        error instanceof Error ? error.message : "Could not assign team lead.",
      )
    } finally {
      setSavingLead(false)
    }
  }
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
        <Select value={streamId} onValueChange={setStreamId}>
          <SelectTrigger
            aria-label="Filter team by service"
            className="h-[34px] w-[190px] text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {workspace.workstreams.map((stream) => (
              <SelectItem key={stream.id} value={stream.id}>
                {stream.serviceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9eef8] text-[#294c96]">
                        {person.fullName
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
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
                      className={rowActionButton}
                      aria-label={`View ${person.fullName}`}
                      onClick={() => {
                        setLeadError("")
                        setDetailId(id)
                      }}
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
        <div className="rounded-xl border border-dashed border-[#d8e0eb] px-5 py-12 text-center">
          <UsersRound size={28} className="mx-auto text-[#8293ad]" />
          <h3 className="mt-3 mb-1 text-sm font-semibold">
            {rows.length ? "No matching staff" : "No staff assigned yet"}
          </h3>
          <p className="m-0 text-xs text-[#738096]">
            {rows.length
              ? "Try another search or service."
              : "The department head can assign eligible staff once the booking is ready for staffing."}
          </p>
          {rows.length > 0 && (
            <Button
              variant="outline"
              className="mt-4 text-xs"
              onClick={() => {
                setSearch("")
                setStreamId("all")
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
      <Sheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open && !savingLead) setDetailId(null)
        }}
      >
        <SheetContent
          overlayClassName="bg-[#14213d]/40"
          className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none"
        >
          <header className="border-b border-[#eceef1] px-6 py-6 pr-14">
            <SheetTitle className="text-[22px] leading-tight tracking-tight">
              {detail?.person.fullName}
            </SheetTitle>
            <SheetDescription className="mt-2 text-xs text-[#738096]">
              Project team member
            </SheetDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {detail && (
              <dl className="rounded-xl border border-[#e1e4ea] px-4">
                {[
                  ["Position", detail.person.position || "Staff"],
                  ["Service", detail.stream.serviceName],
                  [
                    "Assigned on",
                    new Date(detail.person.approvedAt).toLocaleDateString(),
                  ],
                  [
                    "Project role",
                    detail.person.isTeamLead ? "Team lead" : "Team member",
                  ],
                  [
                    "Skills",
                    detail.person.profileSpecialties.join(", ") ||
                      "No skills recorded",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-[#eceef1] py-3 last:border-0"
                  >
                    <dt className="text-[11px] font-medium text-[#738096]">
                      {label}
                    </dt>
                    <dd className="mt-1.5 break-words text-xs font-medium">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {detail && (
              <section className="mt-5" aria-labelledby="member-assigned-tasks">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3
                    id="member-assigned-tasks"
                    className="text-xs font-semibold"
                  >
                    Assigned tasks
                  </h3>
                  <span className="text-[11px] text-[#738096]">
                    {assignedTasks.length} assigned
                  </span>
                </div>
                {assignedTasks.length ? (
                  <ul className="rounded-xl border border-[#e1e4ea]">
                    {assignedTasks.map(({ task, phase }) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-3 border-b border-[#eceef1] px-4 py-3 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium">
                            {task.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#738096]">
                            {phase} ·{" "}
                            {task.status === "DONE"
                              ? "Complete"
                              : task.status === "IN_PROGRESS"
                                ? "In progress"
                                : "Not started"}
                          </p>
                        </div>
                        {detail.stream.canAssign &&
                          ["PLANNED", "IN_PROGRESS"].includes(
                            detail.stream.status,
                          ) && (
                            <TaskRowActions
                              workspaceId={workspace.id}
                              stream={detail.stream}
                              task={task}
                              onUpdated={onUpdated}
                              disabled={savingLead}
                              editOnly
                            />
                          )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-[#e1e4ea] px-4 py-3 text-xs text-[#738096]">
                    No tasks assigned for this service yet.
                  </p>
                )}
              </section>
            )}
          </div>
          {detail &&
          !detail.person.isTeamLead &&
          workspace.canManage &&
          detail.stream.canAssign &&
          ["PLANNED", "IN_PROGRESS"].includes(detail.stream.status) &&
          detail.person.status === "ACTIVE" ? (
            <footer className="shrink-0 border-t border-[#eceef1] px-6 py-4">
              {teamLead && (
                <p className="text-xs text-[#60718c]">
                  This will replace {teamLead.person.fullName} as team lead.
                </p>
              )}
              {leadError && (
                <p role="alert" className="text-xs text-red-700">
                  {leadError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  disabled={savingLead}
                  onClick={() => void saveTeamLead()}
                  className="bg-[#203f8c] text-white hover:bg-[#172f70]"
                >
                  {savingLead ? "Assigning…" : "Assign as team lead"}
                </Button>
              </div>
            </footer>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
