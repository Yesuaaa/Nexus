"use client"

import { useState } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { MemberIdentity } from "@/components/ui/member-identity"
import { Pill } from "@/components/ui/pill"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  statusLabel,
  statusTone,
} from "@/features/projects/model/project-status"
import {
  getAdminProjectManagementWorkspaceDetails,
  type AdminProjectManagementWorkspaceDetails,
  type AdminProjectWorkspaceProject,
} from "../api/project-workspace-api"
import { useAsyncResource } from "@/lib/use-async-resource"

function WorkspaceDetailsLoading() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <span role="status" className="sr-only">
        Loading workspace details…
      </span>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid gap-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    </div>
  )
}

function WorkspaceSummary({
  workspace,
  onSelectProject,
}: {
  workspace: AdminProjectManagementWorkspaceDetails
  onSelectProject: (id: string) => void
}) {
  const clients = workspace.clients
    .map(({ fullName }) => fullName || "Client")
    .join(", ")
  const head = workspace.department.head
  return (
    <>
      <SidePanelSection title="Workspace summary">
        <DetailList layout="stacked">
          <DetailItem label="Department">
            {workspace.department.name}
          </DetailItem>
          <DetailItem label="Client">
            {clients || "Client unavailable"}
          </DetailItem>
          <DetailItem label="Department members">
            {workspace.department.memberCount}
          </DetailItem>
        </DetailList>
      </SidePanelSection>

      <SidePanelSection title="Department head">
        {head ? (
          <MemberIdentity
            member={{ fullName: head.fullName, email: head.email }}
            secondaryText={head.position || "Department Head"}
            nameAdornment={<Pill>Department Head</Pill>}
          />
        ) : (
          <p className="m-0 text-xs text-[#738096]">Unassigned</p>
        )}
      </SidePanelSection>

      <SidePanelSection title="Overall task progress">
        {workspace.progress ? (
          <div className="grid gap-2">
            <p className="m-0 text-xs text-[#52627a]">
              {workspace.progress.completed} of {workspace.progress.total} tasks
              complete
            </p>
            <ProgressMeter
              value={workspace.progress.completed}
              max={workspace.progress.total}
              label={`${workspace.name} overall task progress`}
              colorClass="bg-[#244993]"
            />
            {workspace.unplannedProjectCount > 0 && (
              <p className="m-0 text-[11px] text-[#738096]">
                {workspace.unplannedProjectCount} project
                {workspace.unplannedProjectCount === 1 ? " has" : "s have"} no
                work plan yet and are excluded from progress.
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 text-xs text-[#738096]">Unplanned</p>
        )}
      </SidePanelSection>

      <SidePanelSection title="Workspace team">
        {workspace.teamMembers.length ? (
          <ul className="m-0 grid list-none divide-y divide-[#eceef1] p-0">
            {workspace.teamMembers.map((member) => (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <MemberIdentity
                  member={{ fullName: member.fullName }}
                  secondaryText={member.position || "Staff"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-xs text-[#738096]">
            No project team members assigned.
          </p>
        )}
      </SidePanelSection>

      <SidePanelSection title={`Projects (${workspace.projectCount})`}>
        {workspace.projects.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {workspace.projects.map((project) => (
              <li key={project.id}>
                <ProjectListButton
                  project={project}
                  onClick={() => onSelectProject(project.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No projects in this workspace" size="sm" />
        )}
      </SidePanelSection>
    </>
  )
}

function ProjectListButton({
  project,
  onClick,
}: {
  project: AdminProjectWorkspaceProject
  onClick: () => void
}) {
  const leadNames = project.leads.map(({ fullName }) => fullName).join(", ")
  const progress = project.progress
    ? `${project.progress.completed}/${project.progress.total} tasks`
    : "Unplanned"
  return (
    <Button
      type="button"
      variant="outline"
      size="panelItem"
      className="w-full justify-between gap-3 text-left"
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{project.name}</span>
        <span className="block truncate text-[11px] font-normal text-[#738096]">
          {statusLabel(project.status)} · {progress} · Lead:{" "}
          {leadNames || "Unassigned"}
        </span>
      </span>
      <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
    </Button>
  )
}

function ProjectDetails({
  project,
  activity,
}: {
  project: AdminProjectWorkspaceProject
  activity: AdminProjectManagementWorkspaceDetails["activity"]
}) {
  const { formatDate, formatDateOnly, formatDateTime } = useDatePreferences()
  const projectActivity = activity.filter(
    (event) => event.projectId === project.id,
  )
  const dueDates = project.taskDueDates.map(formatDateOnly)
  const timeline = [
    {
      label: "Start date",
      value: project.startDate ? formatDate(project.startDate) : null,
    },
    {
      label: "Task due dates",
      value: dueDates.length
        ? dueDates.length === 1
          ? dueDates[0]
          : `${dueDates[0]} – ${dueDates[dueDates.length - 1]}`
        : null,
    },
  ]

  return (
    <>
      {project.description && (
        <p className="m-0 whitespace-pre-wrap text-xs leading-5 text-[#52627a]">
          {project.description}
        </p>
      )}
      <DetailList layout="stacked">
        <DetailItem label="Client">
          {project.client.fullName || "Client"}
        </DetailItem>
        <DetailItem label="Department">{project.department.name}</DetailItem>
        <DetailItem
          label="Project lead"
          className="col-span-2 max-[450px]:col-span-1"
        >
          {project.leads.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {project.leads.map((lead) => (
                <li key={lead.id}>
                  <MemberIdentity
                    member={{ fullName: lead.fullName }}
                    secondaryText={lead.position || undefined}
                  />
                </li>
              ))}
            </ul>
          ) : (
            "Unassigned"
          )}
        </DetailItem>
        {project.workspace?.name && project.workspace.name !== project.name && (
          <DetailItem
            label="Workspace"
            className="col-span-2 max-[450px]:col-span-1"
          >
            {project.workspace.name}
          </DetailItem>
        )}
      </DetailList>

      <SidePanelSection title="Project team">
        {project.team.length ? (
          <ul className="m-0 grid list-none divide-y divide-[#eceef1] p-0">
            {project.team.map((member) => (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <MemberIdentity
                  member={{ fullName: member.fullName }}
                  secondaryText={member.position || "Staff"}
                  nameAdornment={
                    member.isTeamLead ? <Pill>Project lead</Pill> : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-xs text-[#738096]">No staff assigned yet</p>
        )}
      </SidePanelSection>

      <SidePanelSection title="Timeline">
        <DetailList layout="stacked">
          {timeline.map(({ label, value }) => (
            <DetailItem key={label} label={label}>
              {value || "Not recorded"}
            </DetailItem>
          ))}
        </DetailList>
      </SidePanelSection>

      <SidePanelSection title="Progress and tasks">
        <div className="grid gap-2">
          {project.progress ? (
            <>
              <p className="m-0 text-xs text-[#52627a]">
                {project.tasks.completed} completed · {project.tasks.incomplete}{" "}
                incomplete · {project.tasks.total} total
              </p>
              <ProgressMeter
                value={project.progress.completed}
                max={project.progress.total}
                label={`${project.name} task progress`}
                colorClass="bg-[#244993]"
              />
            </>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              Unplanned · no task plan is recorded.
            </p>
          )}
        </div>
      </SidePanelSection>

      <SidePanelSection title="Recent activity">
        {projectActivity.length ? (
          <ol
            aria-label="Project activity"
            className="m-0 ml-1 grid list-none border-l border-[#dfe5ec] p-0"
          >
            {projectActivity.map((event) => (
              <li
                key={event.id}
                className="relative grid gap-1 pb-4 pl-4 last:pb-0"
              >
                <span
                  className="absolute top-1 left-[-5px] size-2.5 rounded-full border-2 border-white bg-[#244993]"
                  aria-hidden="true"
                />
                <p className="m-0 break-words whitespace-pre-wrap text-xs leading-5 text-[#52627a]">
                  {event.summary}
                </p>
                <p className="m-0 flex flex-wrap gap-x-1 break-words text-[11px] text-[#738096]">
                  <span>{event.actor?.fullName || "System"}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={event.createdAt}>
                    {formatDateTime(event.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No recent activity" size="sm" />
        )}
      </SidePanelSection>
    </>
  )
}

export function AdminProjectWorkspaceDetailsPanel({
  departmentId,
  identity,
  onClose,
}: {
  departmentId: string
  identity: string
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const [revision, setRevision] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  const resource = useAsyncResource(
    (signal) =>
      getAdminProjectManagementWorkspaceDetails(departmentId, identity, signal),
    [departmentId, identity, revision],
    { fallbackError: "Couldn't load this project workspace." },
  )
  const workspace = resource.data
  const selectedProject = workspace?.projects.find(
    ({ id }) => id === selectedProjectId,
  )
  const loading = resource.loading && !workspace
  const projectStatus = selectedProject ? (
    <Pill tone={statusTone(selectedProject.status)}>
      {statusLabel(selectedProject.status)}
    </Pill>
  ) : undefined

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title={
          selectedProject?.name ??
          workspace?.name ??
          (loading ? "Loading workspace" : "Workspace details")
        }
        titleClassName="whitespace-normal break-words"
        description={
          selectedProject
            ? `Project details for ${selectedProject.name}`
            : workspace
              ? `Workspace summary for ${workspace.name}`
              : "Workspace summary"
        }
        hideDescription
        leading={
          selectedProject ? (
            <Button
              type="button"
              variant="ghost"
              size="touch"
              aria-label="Back to workspace summary"
              onClick={() => setSelectedProjectId(null)}
            >
              <ArrowLeft size={14} aria-hidden="true" />
            </Button>
          ) : undefined
        }
        meta={projectStatus}
        closeLabel="Close project workspace details"
      />
      <SidePanelBody className="gap-4">
        {loading ? (
          <WorkspaceDetailsLoading />
        ) : resource.error && !workspace ? (
          <SidePanelError
            message={resource.error}
            onRetry={() => setRevision((current) => current + 1)}
          />
        ) : workspace ? (
          selectedProject ? (
            <ProjectDetails
              project={selectedProject}
              activity={workspace.activity}
            />
          ) : (
            <WorkspaceSummary
              workspace={workspace}
              onSelectProject={setSelectedProjectId}
            />
          )
        ) : (
          <EmptyState title="Project workspace unavailable" size="sm" />
        )}
      </SidePanelBody>
      {!selectedProject && (
        <SidePanelFooter>
          <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
        </SidePanelFooter>
      )}
    </SidePanel>
  )
}
