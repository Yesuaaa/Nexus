import { BriefcaseBusiness, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  panelAssignButton,
  panelDangerButton,
} from "@/components/ui/panel-styles"
import { Pill } from "@/components/ui/pill"
import { SheetClose } from "@/components/ui/sheet"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { statusLabel as projectStatusLabel } from "@/features/projects/model/project-status"
import {
  getWorkloadMetrics,
  type WorkloadAssignment,
  type WorkloadStaff,
} from "../model/workload"

export function WorkloadDetailsDrawer({
  staff,
  week,
  onClose,
  onEditCapacity,
  onEditAllocation,
  onUnassign,
}: {
  staff: WorkloadStaff
  week: string
  onClose: () => void
  onEditCapacity: () => void
  onEditAllocation: (assignment: WorkloadAssignment) => void
  onUnassign: (assignment: WorkloadAssignment) => void
}) {
  const panel = useSidePanel(onClose)
  const metrics = getWorkloadMetrics(staff)
  const count = staff.assignments.length

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(`workload-actions-${staff.id}`)
      }
    >
      <SidePanelHeader
        eyebrow="Workload details"
        title={staff.fullName}
        description={`${staff.position ?? "Staff"} · Week of ${week}`}
        closeLabel="Close workload details"
      />
      <SidePanelBody>
        <SidePanelSection title="Weekly capacity">
          <DetailList>
            <DetailItem label="Scheduled hours">
              {staff.capacity?.scheduledHours ?? "Not set"}
            </DetailItem>
            <DetailItem label="Time off / holidays">
              {staff.capacity?.timeOffHours ?? "Not set"}
            </DetailItem>
            <DetailItem label="Assigned hours">
              {metrics.unknown ? "Hours need recording" : metrics.assigned}
            </DetailItem>
            <DetailItem label="Remaining capacity">
              {metrics.capacity === null || metrics.unknown
                ? "Not available"
                : `${Math.max(0, metrics.capacity - metrics.assigned)} hrs`}
            </DetailItem>
          </DetailList>
        </SidePanelSection>
        <SidePanelSection
          title="Current assignments"
          action={
            <span className="text-[11px] text-[#738096]">
              {count} {count === 1 ? "Assignment" : "Assignments"}
            </span>
          }
        >
          <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
            {staff.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between gap-4 border-b border-[#eceef1] px-4 py-4 last:border-b-0 max-[400px]:flex-wrap"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-[#edf0f4] text-[#738096]">
                    <BriefcaseBusiness
                      size={15}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-medium break-words text-foreground">
                      {assignment.project.name}
                    </p>
                    <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                      {assignment.weeklyHours === null
                        ? "Hours not recorded"
                        : `${assignment.weeklyHours} hrs/week`}
                    </p>
                    <Pill tone="info" className="mt-2">
                      {projectStatusLabel(assignment.project.status)}
                    </Pill>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2 max-[400px]:ml-11">
                  <Button
                    type="button"
                    className={panelAssignButton}
                    onClick={() =>
                      panel.close(() => onEditAllocation(assignment))
                    }
                  >
                    Edit allocation
                  </Button>
                  <Button
                    type="button"
                    className={panelDangerButton}
                    aria-label={`Unassign from ${assignment.project.name}`}
                    onClick={() => panel.close(() => onUnassign(assignment))}
                  >
                    <Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
            {!count && (
              <p className="m-0 px-4 py-5 text-xs text-[#738096]">
                No assignments this week.
              </p>
            )}
          </div>
        </SidePanelSection>
        <p className="m-0 text-[11px] text-[#738096]">
          Utilization = assigned hours ÷ (scheduled hours − time off). Missing
          hours are never treated as free capacity.
        </p>
      </SidePanelBody>
      <SidePanelFooter className="justify-between">
        <SidePanelButton
          variant="secondary"
          onClick={() => panel.close(onEditCapacity)}
        >
          Edit capacity
        </SidePanelButton>
        <SheetClose asChild>
          <SidePanelButton aria-label="Done viewing workload details">
            Done
          </SidePanelButton>
        </SheetClose>
      </SidePanelFooter>
    </SidePanel>
  )
}
