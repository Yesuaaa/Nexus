import Link from "next/link"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import { ProgressMeter } from "@/components/ui/stat-strip"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
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

function workspaceKey(workspace: WorkspaceRow, readOnly: boolean) {
  return readOnly ? workspace.id : workspace.rowId
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
  onViewDetails,
  directory = false,
  departmentScopedDirectory = false,
  directoryState,
  readOnly = false,
  projectHref,
}: {
  workspaces: WorkspaceRow[]
  loading: boolean
  viewKey: string
  quickKey: string
  archiveView: boolean
  onChanged: () => void
  onViewDetails?: (identity: string) => void
  directory?: boolean
  departmentScopedDirectory?: boolean
  directoryState?: WorkspaceDirectoryState
  readOnly?: boolean
  projectHref?: (id: string) => string
}) {
  const { formatDate } = useDatePreferences()
  const rowGrid = grid
  return (
    <ResponsiveDataTable
      label={
        departmentScopedDirectory
          ? "Department project workspaces"
          : "Project workspaces"
      }
      aria-busy={loading}
    >
      <ResponsiveDataTableHeader
        className="@max-[900px]:sr-only"
        rowClassName={rowGrid}
      >
        {(departmentScopedDirectory
          ? [
              "Workspace",
              "Client",
              "Progress",
              "Status",
              "Last updated",
              "Actions",
            ]
          : [
              directory ? "Workspace" : "Project",
              "Client",
              directory ? "Progress" : "Services",
              "Status",
              "Last updated",
              "Actions",
            ]
        ).map((label) => (
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
              rowGrid,
              "h-[58px] px-4 py-[7px] @max-[900px]:h-[210px] @max-[900px]:gap-y-2",
            )}
            cellClassNames={cells}
          />
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          items={workspaces}
          getKey={(workspace) => workspaceKey(workspace, readOnly)}
          rowClassName={(workspace, index, isLast) =>
            rowClass(workspace, index, isLast)
          }
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
              <ResponsiveDataTableCell className={cells[0]}>
                {departmentScopedDirectory ? (
                  <span className="block truncate font-semibold text-foreground">
                    {workspace.name}
                  </span>
                ) : (
                  <Link
                    href={
                      readOnly
                        ? projectHref?.(workspace.id) ??
                          `/project-workspace/${encodeURIComponent(workspace.id)}`
                        : projectWorkspaceHref(
                            workspaceKey(workspace, readOnly),
                            directoryState,
                          )
                    }
                    className="block truncate font-semibold text-foreground no-underline hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {workspace.name}
                  </Link>
                )}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell
                className={cn(cells[1], "truncate text-[#52627a]")}
              >
                <span className="mr-2 hidden text-[#65718a] @max-[900px]:inline">
                  Client
                </span>
                {("clientName" in workspace
                  ? workspace.clientName
                  : workspace.client.fullName) || "Client"}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className={cells[2]}>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <span className="hidden shrink-0 text-[#65718a] @max-[900px]:inline">
                    {directory ? "Progress" : "Services"}
                  </span>
                  {"projectCount" in workspace ? (
                    departmentScopedDirectory && workspace.progress ? (
                      <div className="w-24 shrink-0">
                        <ProgressMeter
                          value={workspace.progress.completed}
                          max={workspace.progress.total}
                          label={`${workspace.name} task progress`}
                          colorClass="bg-[#244993]"
                        />
                      </div>
                    ) : departmentScopedDirectory ? (
                      <span className="shrink-0 text-[#65718a]">Unplanned</span>
                    ) : workspace.progress ? (
                      <span className="shrink-0 tabular-nums text-[#52627a]">
                        {workspace.progress.total > 0
                          ? `${Math.round((workspace.progress.completed / workspace.progress.total) * 100)}%`
                          : "0%"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[#65718a]">Unplanned</span>
                    )
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
                    <span className="text-[#65718a]">No services</span>
                  )}
                </div>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className={cells[3]}>
                <span className="mr-2 hidden text-[#65718a] @max-[900px]:inline">
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
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell
                className={cn(cells[4], "text-[#52627a]")}
              >
                <span className="mr-2 hidden text-[#65718a] @max-[900px]:inline">
                  Updated
                </span>
                <time dateTime={workspace.updatedAt}>
                  {formatDate(workspace.updatedAt)}
                </time>
              </ResponsiveDataTableCell>
              {readOnly ? (
                <ResponsiveDataTableCell className={cells[5]}>
                  <Link
                    href={
                      projectHref?.(workspace.id) ??
                      `/project-workspace/${encodeURIComponent(workspace.id)}`
                    }
                    className="text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Inspect
                  </Link>
                </ResponsiveDataTableCell>
              ) : departmentScopedDirectory ? (
                <ResponsiveDataTableCell
                  className={cells[5]}
                  aria-label={`Actions for ${workspace.name}`}
                >
                  {onViewDetails && (
                    <WorkspaceListRowActions
                      workspace={workspace}
                      identity={workspaceKey(workspace, readOnly)}
                      onChanged={onChanged}
                      onViewDetails={() =>
                        onViewDetails(workspaceKey(workspace, readOnly))
                      }
                    />
                  )}
                </ResponsiveDataTableCell>
              ) : (
                <ResponsiveDataTableCell className={cells[5]}>
                  <WorkspaceListRowActions
                    workspace={workspace}
                    identity={workspaceKey(workspace, readOnly)}
                    returnState={directoryState}
                    onChanged={onChanged}
                    isArchived={
                      "status" in workspace &&
                      ["COMPLETED", "CANCELLED"].includes(workspace.status)
                    }
                  />
                </ResponsiveDataTableCell>
              )}
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
