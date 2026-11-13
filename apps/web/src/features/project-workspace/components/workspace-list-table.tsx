import Link from "next/link"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import {
  statusLabel,
  statusTone,
} from "@/features/projects/model/project-status"
import {
  projectWorkspaceHref,
  type ProjectWorkspaceSummary,
  type WorkspaceDirectoryRow,
} from "../api/project-workspace-api"
import type { WorkspaceDirectoryState } from "../model/workspace-directory-state"
import { WorkspaceListRowActions } from "./workspace-list-row-actions"

const grid =
  "grid grid-cols-[minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(120px,1.2fr)_minmax(90px,.8fr)_minmax(100px,.9fr)_112px] items-center gap-3.5 @max-[900px]:grid-cols-[minmax(0,1fr)_auto]"

const cells = [
  "min-w-0 @max-[900px]:col-start-1 @max-[900px]:row-start-1",
  "min-w-0 @max-[900px]:col-span-2 @max-[900px]:row-start-2",
  "min-w-0 @max-[900px]:col-span-2 @max-[900px]:row-start-3",
  "min-w-0 @max-[900px]:col-span-2 @max-[900px]:row-start-4",
  "min-w-0 @max-[900px]:col-span-2 @max-[900px]:row-start-5",
  "@max-[900px]:col-start-2 @max-[900px]:row-start-1",
]

type WorkspaceRow = ProjectWorkspaceSummary | WorkspaceDirectoryRow

function workspaceKey(workspace: WorkspaceRow) {
  return "rowId" in workspace ? workspace.rowId : workspace.id
}

function rowClass(_workspace: WorkspaceRow, _index: number, isLast: boolean) {
  return cn(
    grid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground transition-colors hover:bg-[#e8eef2] @max-[900px]:h-[210px] @max-[900px]:gap-y-2",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

export function WorkspaceListTable({
  workspaces,
  loading,
  viewKey,
  quickKey,
  archiveView,
  onChanged,
  directory = false,
  directoryState,
}: {
  workspaces: WorkspaceRow[]
  loading: boolean
  viewKey: string
  quickKey: string
  archiveView: boolean
  onChanged: () => void
  directory?: boolean
  directoryState?: WorkspaceDirectoryState
}) {
  const { formatDate } = useDatePreferences()
  return (
    <ResponsiveDataTable label="Project workspaces" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[900px]:sr-only"
        rowClassName={grid}
      >
        {[
          directory ? "Workspace" : "Project",
          "Client",
          directory ? "Projects / Progress" : "Services",
          "Status",
          "Last updated",
          "Actions",
        ].map((label) => (
          <ResponsiveDataTableColumnHeader key={label}>
            {label}
          </ResponsiveDataTableColumnHeader>
        ))}
      </ResponsiveDataTableHeader>
      {loading ? (
        <ResponsiveDataTableBody>
          <DataTableSkeletonRows
            label="projects"
            rowClassName={cn(
              grid,
              "h-[58px] px-4 py-[7px] @max-[900px]:h-[210px] @max-[900px]:gap-y-2",
            )}
            cellClassNames={cells}
          />
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={workspaces}
          getKey={workspaceKey}
          rowClassName={rowClass}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows
          defaultRowHeight={58}
          className="relative min-w-0 overflow-x-clip"
          emptyContent={
            archiveView
              ? "No archived projects match these filters."
              : "No projects match these filters."
          }
          renderRow={(workspace) => (
            <>
              <div role="cell" className={cells[0]}>
                <Link
                  href={projectWorkspaceHref(
                    workspaceKey(workspace),
                    directory ? directoryState : undefined,
                  )}
                  className="block truncate font-semibold text-foreground no-underline hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {workspace.name}
                </Link>
              </div>
              <div
                role="cell"
                className={cn(cells[1], "truncate text-[#52627a]")}
              >
                <span className="mr-2 hidden text-[#738096] @max-[900px]:inline">
                  Client
                </span>
                {("clientName" in workspace
                  ? workspace.clientName
                  : workspace.client.fullName) || "Client"}
              </div>
              <div role="cell" className={cells[2]}>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <span className="hidden shrink-0 text-[#738096] @max-[900px]:inline">
                    {directory ? "Projects / Progress" : "Services"}
                  </span>
                  {"projectCount" in workspace ? (
                    <span className="text-[#52627a]">
                      {workspace.projectCount}{" "}
                      {workspace.projectCount === 1 ? "project" : "projects"}
                      {" · "}
                      {workspace.progress
                        ? `${workspace.progress.completed}/${workspace.progress.total} tasks`
                        : "Unplanned"}
                    </span>
                  ) : workspace.workstreams.length ? (
                    workspace.workstreams.map((workstream) => (
                      <Pill
                        key={workstream.id}
                        className="min-w-0 shrink"
                        title={workstream.serviceName}
                      >
                        {workstream.serviceName}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-[#738096]">No services</span>
                  )}
                </div>
              </div>
              <div role="cell" className={cells[3]}>
                <span className="mr-2 hidden text-[#738096] @max-[900px]:inline">
                  Status
                </span>
                {"statuses" in workspace && workspace.statuses.length > 1 ? (
                  <Pill title={workspace.statuses.map(statusLabel).join(", ")}>
                    Mixed statuses
                    <span className="sr-only">
                      {" "}
                      ({workspace.statuses.map(statusLabel).join(", ")})
                    </span>
                  </Pill>
                ) : (
                  <Pill
                    tone={statusTone(
                      "statuses" in workspace
                        ? workspace.statuses[0]
                        : workspace.status,
                    )}
                  >
                    {statusLabel(
                      "statuses" in workspace
                        ? workspace.statuses[0]
                        : workspace.status,
                    )}
                  </Pill>
                )}
              </div>
              <div role="cell" className={cn(cells[4], "text-[#52627a]")}>
                <span className="mr-2 hidden text-[#738096] @max-[900px]:inline">
                  Updated
                </span>
                <time dateTime={workspace.updatedAt}>
                  {formatDate(workspace.updatedAt)}
                </time>
              </div>
              <div role="cell" className={cells[5]}>
                <WorkspaceListRowActions
                  workspace={workspace}
                  identity={workspaceKey(workspace)}
                  returnState={directory ? directoryState : undefined}
                  onChanged={onChanged}
                  isArchived={
                    "status" in workspace &&
                    ["COMPLETED", "CANCELLED"].includes(workspace.status)
                  }
                />
              </div>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
