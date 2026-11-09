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
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { rowActionButton } from "@/components/ui/row-action-styles"
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
}: {
  workspace: ProjectWorkspaceDetail
  onChanged: () => void
}) {
  const [search, setSearch] = useState("")
  const [streamId, setStreamId] = useState("all")
  const [detail, setDetail] = useState<{
    name: string
    position: string
    skills: string[]
    service: string
  } | null>(null)
  const rows = useMemo(
    () =>
      workspace.workstreams.flatMap((stream) =>
        (stream.staff ?? []).map((person) => ({
          id: `${stream.id}-${person.id}`,
          person,
          stream,
        })),
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
              renderRow={({ person, stream }) => (
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
                      onClick={() =>
                        setDetail({
                          name: person.fullName,
                          position: person.position || "Staff",
                          skills: person.profileSpecialties,
                          service: stream.serviceName,
                        })
                      }
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
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent>
          <DialogTitle>{detail?.name}</DialogTitle>
          <DialogDescription>
            {detail?.position} · {detail?.service}
          </DialogDescription>
          <p className="text-xs text-[#60718c]">
            {detail?.skills.join(", ") || "No skills recorded."}
          </p>
        </DialogContent>
      </Dialog>
    </section>
  )
}
