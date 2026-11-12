"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
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
import { errorMessage } from "@/lib/error-message"
import {
  assignProjectTeamLead,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"
import { taskStatusLabels } from "../model/task-status"
import { TaskRowActions } from "./task-row-actions"

export type TeamMember = {
  id: string
  person: NonNullable<ProjectWorkspaceWorkstream["staff"]>[number]
  stream: ProjectWorkspaceWorkstream
}

const editableStatuses = ["PLANNED", "IN_PROGRESS"]

/** Project team member details. Mount it while open; it animates out on close. */
export function TeamMemberPanel({
  workspace,
  member,
  teamLead,
  onUpdated,
  onClose,
}: {
  workspace: ProjectWorkspaceDetail
  member: TeamMember
  teamLead: TeamMember | undefined
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const { person, stream } = member
  const canEditTasks =
    stream.canAssign && editableStatuses.includes(stream.status)
  const canAssignLead =
    !person.isTeamLead &&
    workspace.canManage &&
    canEditTasks &&
    person.status === "ACTIVE"
  const assignedTasks =
    stream.plan?.phases.flatMap((phase) =>
      phase.tasks
        .filter((task) => task.employeeId === person.id)
        .map((task) => ({ task, phase: phase.title })),
    ) ?? []

  async function saveTeamLead() {
    if (saving) return
    setSaving(true)
    setError("")
    try {
      onUpdated(await assignProjectTeamLead(workspace.id, stream.id, person.id))
    } catch (reason) {
      setError(errorMessage(reason, "Could not assign team lead."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={saving}
      fallbackFocus={() =>
        document.getElementById(`team-member-view-${member.id}`)
      }
    >
      <SidePanelHeader
        leading={<Avatar name={person.fullName} className="size-11" />}
        title={person.fullName}
        description="Project team member"
        closeLabel="Close team member details"
        closeDisabled={saving}
      />
      <SidePanelBody>
        <DetailList>
          <DetailItem label="Position">{person.position || "Staff"}</DetailItem>
          <DetailItem label="Service">{stream.serviceName}</DetailItem>
          <DetailItem label="Assigned on">
            {new Date(person.approvedAt).toLocaleDateString()}
          </DetailItem>
          <DetailItem label="Project role">
            {person.isTeamLead ? "Team lead" : "Team member"}
          </DetailItem>
          <DetailItem label="Skills">
            {person.profileSpecialties.join(", ") || "No skills recorded"}
          </DetailItem>
        </DetailList>
        <SidePanelSection
          title="Assigned tasks"
          action={
            <span className="text-[11px] text-[#738096]">
              {assignedTasks.length} assigned
            </span>
          }
        >
          {assignedTasks.length ? (
            <ul className="m-0 list-none rounded-lg border border-[#e8ebef] p-0">
              {assignedTasks.map(({ task, phase }) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b border-[#eceef1] px-4 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-medium break-words">
                      {task.title}
                    </p>
                    <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                      {phase} · {taskStatusLabels[task.status]}
                    </p>
                  </div>
                  {canEditTasks && (
                    <TaskRowActions
                      workspaceId={workspace.id}
                      stream={stream}
                      task={task}
                      onUpdated={onUpdated}
                      disabled={saving}
                      editOnly
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-lg border border-[#e8ebef] px-4 py-3 text-xs text-[#738096]">
              No tasks assigned for this service yet.
            </p>
          )}
        </SidePanelSection>
      </SidePanelBody>
      {canAssignLead && (
        <SidePanelFooter className="flex-wrap">
          {teamLead && (
            <p className="m-0 mr-auto text-xs text-[#60718c]">
              This will replace {teamLead.person.fullName} as team lead.
            </p>
          )}
          {error && (
            <Alert variant="text" className="w-full">
              {error}
            </Alert>
          )}
          <SidePanelButton
            disabled={saving}
            onClick={() => void saveTeamLead()}
          >
            {saving ? "Assigning…" : "Assign as team lead"}
          </SidePanelButton>
        </SidePanelFooter>
      )}
    </SidePanel>
  )
}
