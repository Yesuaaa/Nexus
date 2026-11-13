"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { ProgressMeter } from "@/components/ui/stat-strip"
import type { ClientProjectSummary } from "../api/projects-api"
import {
  projectProgress,
  statusLabel,
  statusTone,
} from "../model/project-status"

export function ClientProjectDetailsDrawer({
  project,
  formatDate,
  onClose,
}: {
  project: ClientProjectSummary
  formatDate: (value: Date | string) => string
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const percent = projectProgress(project)

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(`project-view-${project.id}`)
      }
    >
      <SidePanelHeader
        title="Project details"
        description="Review project progress and shared deliverables."
        closeLabel="Close project details"
      />
      <SidePanelBody>
        <div>
          <h2 className="m-0 text-base font-semibold break-words">
            {project.name}
          </h2>
          <div className="mt-3">
            <Pill tone={statusTone(project.status)}>
              {statusLabel(project.status)}
            </Pill>
          </div>
        </div>

        <section className="rounded-xl border border-[#e4e9f0] bg-[#f8fafd] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-xs font-semibold">Project progress</h3>
            <span className="text-xs font-semibold text-[#294c96]">
              {percent}%
            </span>
          </div>
          <div className="mt-2">
            <ProgressMeter
              value={percent}
              max={100}
              label={`${project.name} progress`}
              colorClass="bg-[#294c96]"
            />
          </div>
          <p className="mt-2 mb-0 text-[11px] text-[#52627a]">
            {project.completedTasks} of {project.taskCount} tasks complete
          </p>
        </section>

        <DetailList layout="stacked">
          <DetailItem label="Service">
            {project.request?.service.name || "Project"}
          </DetailItem>
          <DetailItem label="Request reference">
            {project.request?.referenceNumber || project.id}
          </DetailItem>
          <DetailItem label="Deliverables">
            {`${project.deliverableCount} ${project.deliverableCount === 1 ? "deliverable" : "deliverables"}`}
          </DetailItem>
          <DetailItem label="Started">
            {project.startDate ? formatDate(project.startDate) : "Not started"}
          </DetailItem>
          <DetailItem label="Last updated">
            {formatDate(project.updatedAt)}
          </DetailItem>
        </DetailList>

        <SidePanelSection title="Project brief">
          <p className="m-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
            {project.description || "No project brief provided."}
          </p>
        </SidePanelSection>
      </SidePanelBody>
      <SidePanelFooter>
        {project.startDate && (
          <Button asChild variant="outline" className="text-xs">
            <Link href={`/messages?project=${encodeURIComponent(project.id)}`}>
              Project chat
            </Link>
          </Button>
        )}
        <Button asChild variant="brand" className="text-xs">
          <Link href={`/projects/${encodeURIComponent(project.id)}`}>
            Open project
          </Link>
        </Button>
      </SidePanelFooter>
    </SidePanel>
  )
}
