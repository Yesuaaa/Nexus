"use client"

import { Pencil } from "lucide-react"
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
import type {
  ProjectTask,
  ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"
import { taskStatusLabels, taskStatusTones } from "../model/task-status"

/** Read-only task view. Mount it while open; it animates out on close. */
export function TaskDetailsPanel({
  task,
  stream,
  onClose,
  onEdit,
}: {
  task: ProjectTask
  stream: ProjectWorkspaceWorkstream
  onClose: () => void
  onEdit: () => void
}) {
  const panel = useSidePanel(onClose)
  const phase = stream.plan?.phases.find((item) =>
    item.tasks.some((item) => item.id === task.id),
  )
  const assignee = stream.staff?.find((person) => person.id === task.employeeId)
  const done = phase?.tasks.filter((item) => item.status === "DONE").length ?? 0
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() => document.getElementById(`task-actions-${task.id}`)}
    >
      <SidePanelHeader
        title="Task details"
        description={`${stream.serviceName} · ${phase?.title || "Project plan"}`}
        closeLabel="Close task details"
      />
      <SidePanelBody>
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold break-words">
            {task.title}
          </h2>
          <Pill
            tone={taskStatusTones[task.status]}
            className="mt-3 px-2 py-1 text-[11px]"
          >
            {taskStatusLabels[task.status]}
          </Pill>
        </div>
        <DetailList>
          <DetailItem label="Project role">{task.role || "Not set"}</DetailItem>
          <DetailItem label="Assigned staff">
            {assignee?.fullName ||
              (task.employeeId
                ? "No longer assigned to project"
                : "Unassigned")}
          </DetailItem>
          <DetailItem label="Staff position">
            {assignee?.position || "Not set"}
          </DetailItem>
          <DetailItem label="Due date">
            {task.dueDate
              ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString()
              : "Not set"}
          </DetailItem>
          <DetailItem label="Booking reference">
            {stream.referenceNumber || "Not set"}
          </DetailItem>
        </DetailList>
        <SidePanelSection title="Phase context">
          <DetailList>
            <DetailItem label="Phase">
              {phase?.title || "Project plan"}
            </DetailItem>
            <DetailItem label="Progress">
              {done} of {phase?.tasks.length ?? 0} tasks complete
            </DetailItem>
          </DetailList>
        </SidePanelSection>
        {assignee && (
          <SidePanelSection title="Assigned staff skills">
            <p className="m-0 text-xs leading-5 text-[#60718c]">
              {assignee.profileSpecialties.join(", ") || "No skills recorded."}
            </p>
          </SidePanelSection>
        )}
      </SidePanelBody>
      <SidePanelFooter className="justify-between">
        <SidePanelButton
          variant="secondary"
          onClick={() => panel.close(onEdit)}
        >
          <Pencil size={14} aria-hidden="true" />
          Edit task
        </SidePanelButton>
        <SheetClose asChild>
          <SidePanelButton>Done</SidePanelButton>
        </SheetClose>
      </SidePanelFooter>
    </SidePanel>
  )
}
