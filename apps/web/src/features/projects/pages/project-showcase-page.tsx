"use client"

import { useRef, useState, type ReactNode, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { Reorder, useDragControls, useReducedMotion } from "motion/react"
import {
  Images,
  Archive,
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import {
  PageHeader,
  PageHeaderButton,
  PageHeaderPlusIcon,
} from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import {
  DataTableEmptyRow,
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import { errorMessage } from "@/lib/error-message"
import { cn } from "@/lib/utils"
import { ShowcaseEntryPanel } from "../components/showcase-entry-panel"
import type { ShowcaseEntry } from "../model/showcase-projects"

const columns = ["Project", "Order", "Status", "Homepage", "Actions"]
const rowClass =
  "grid grid-cols-[minmax(0,2fr)_3rem_5rem_minmax(0,1fr)_4rem] items-center gap-x-4 gap-y-2 text-xs @max-[560px]:grid-cols-2"
function DraggableShowcaseRow({
  entry,
  disabled,
  reducedMotion,
  constraints,
  onStart,
  onEnd,
  children,
}: {
  entry: ShowcaseEntry
  disabled: boolean
  reducedMotion: boolean
  constraints: RefObject<HTMLDivElement | null>
  onStart: () => void
  onEnd: () => void
  children: (grip: ReactNode) => ReactNode
}) {
  const controls = useDragControls()
  const grip = (
    <span
      onPointerDown={(event) => {
        if (!disabled) controls.start(event)
      }}
      className={cn(
        "touch-none text-muted-foreground",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
      aria-hidden="true"
    >
      <GripVertical size={16} />
    </span>
  )
  return (
    <Reorder.Item
      as="div"
      role="row"
      value={entry}
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragConstraints={constraints}
      dragElastic={0}
      onDragStart={onStart}
      onDragEnd={onEnd}
      whileDrag={
        reducedMotion
          ? { zIndex: 10 }
          : {
              zIndex: 10,
              boxShadow: "0 8px 24px rgba(18, 36, 73, 0.16)",
            }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: "tween", duration: 0.25, ease: "easeOut" }
      }
      className={cn(
        rowClass,
        "relative border-b border-[#edf0f3] bg-background px-4 py-3 last:border-b-0",
      )}
    >
      {children(grip)}
    </Reorder.Item>
  )
}

export function ProjectShowcasePage() {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const [archived, setArchived] = useState(false)
  const [target, setTarget] = useState<{
    entry: ShowcaseEntry
    action: "archive" | "restore" | "delete"
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [dragOrder, setDragOrder] = useState<ShowcaseEntry[] | null>(null)
  const dragOrderRef = useRef<ShowcaseEntry[] | null>(null)
  const reorderBoundsRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<ShowcaseEntry | null | undefined>(
    undefined,
  )
  const resource = useAsyncResource(
    (signal) =>
      apiRequest<{ projects: ShowcaseEntry[] }>(
        `/api/project-showcase?archived=${archived}`,
        {
          signal,
        },
      ),
    [archived],
    { fallbackError: "Couldn't load the project showcase." },
  )
  const projects = resource.data?.projects ?? []
  const visibleProjects = dragOrder ?? projects
  const homepageIds = new Set(
    projects
      .filter((project) => project.published && project.featured)
      .slice(0, 3)
      .map((project) => project.id),
  )
  const nextPosition = Math.min(99999, (projects.at(-1)?.position ?? 0) + 10)

  async function moveProject(from: number, to: number) {
    if (
      archived ||
      reordering ||
      resource.loading ||
      from === to ||
      from < 0 ||
      to < 0 ||
      to >= projects.length
    )
      return
    const ordered = [...projects]
    const [moved] = ordered.splice(from, 1)
    if (!moved) return
    ordered.splice(to, 0, moved)
    setReordering(true)
    resource.setData({ projects: ordered })
    try {
      const result = await apiRequest<{ projects: ShowcaseEntry[] }>(
        "/api/project-showcase/reorder",
        {
          method: "POST",
          body: JSON.stringify({
            projects: ordered.map(({ id, version }) => ({ id, version })),
          }),
        },
      )
      resource.setData(result)
      sileo.success({ title: "Project order updated" })
    } catch (cause) {
      sileo.error({
        title: errorMessage(cause, "Couldn't update the project order."),
      })
      resource.retry()
    } finally {
      setReordering(false)
    }
  }

  async function confirmAction() {
    if (!target || pending) return
    setPending(true)
    setError("")
    try {
      const suffix = target.action === "delete" ? "" : `/${target.action}`
      await apiRequest(
        `/api/project-showcase/${encodeURIComponent(target.entry.id)}${suffix}`,
        {
          method: target.action === "delete" ? "DELETE" : "POST",
          body: JSON.stringify({ version: target.entry.version }),
        },
      )
      sileo.success({
        title:
          target.action === "archive"
            ? "Project archived"
            : target.action === "restore"
              ? "Project restored"
              : "Project permanently deleted",
      })
      setTarget(null)
      resource.retry()
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't update the project."))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <PageHeader
        title="Project Showcase"
        description="Manage projects on the public projects page and homepage."
        actions={
          <PageHeaderButton
            disabled={archived || reordering}
            onClick={() => setEditing(null)}
          >
            <PageHeaderPlusIcon />
            Add project
          </PageHeaderButton>
        }
      />
      <div className="mt-5">
        <ManagementViewToggle
          active={archived}
          ariaLabel="Showcase views"
          disabled={pending || reordering}
          onChange={setArchived}
          views={[
            { value: false, label: "Projects", icon: Images },
            { value: true, label: "Archive", icon: Archive },
          ]}
        />
      </div>
      <ResponsiveDataTable
        label="Showcase projects"
        aria-busy={resource.loading}
        className="mt-5"
      >
        <ResponsiveDataTableHeader
          rowClassName={cn(rowClass, "@max-[560px]:sr-only")}
        >
          {columns.map((column) => (
            <ResponsiveDataTableColumnHeader
              key={column}
              className={column === "Actions" ? "text-right" : undefined}
            >
              {column}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {resource.error ? (
            <DataTableErrorRow
              message={resource.error}
              onRetry={resource.retry}
              colSpan={columns.length}
            />
          ) : resource.loading ? (
            <DataTableSkeletonRows
              label="showcase projects"
              rows={3}
              rowClassName={cn(rowClass, "px-4 py-4")}
              cellClassNames={columns.map(() => "h-3")}
            />
          ) : projects.length === 0 ? (
            <DataTableEmptyRow colSpan={columns.length}>
              {archived ? "No archived projects" : "No showcase projects yet"}
            </DataTableEmptyRow>
          ) : (
            <Reorder.Group
              ref={reorderBoundsRef}
              as="div"
              axis="y"
              values={visibleProjects}
              onReorder={(order) => {
                dragOrderRef.current = order
                setDragOrder(order)
              }}
            >
              {visibleProjects.map((entry, index) => (
                <DraggableShowcaseRow
                  constraints={reorderBoundsRef}
                  key={entry.id}
                  entry={entry}
                  disabled={archived || reordering}
                  reducedMotion={Boolean(reducedMotion)}
                  onStart={() => {
                    dragOrderRef.current = projects
                  }}
                  onEnd={() => {
                    const order = dragOrderRef.current
                    dragOrderRef.current = null
                    setDragOrder(null)
                    if (order)
                      void moveProject(
                        projects.findIndex(
                          (project) => project.id === entry.id,
                        ),
                        order.findIndex((project) => project.id === entry.id),
                      )
                  }}
                >
                  {(grip) => (
                    <>
                      <ResponsiveDataTableCell className="flex min-w-0 items-center gap-2 wrap-break-word @max-[560px]:col-span-2">
                        {grip}
                        <div className="min-w-0">
                          <p className="font-semibold">{entry.name}</p>
                          <p className="mt-1 text-muted-foreground">
                            {entry.type}
                          </p>
                        </div>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <span
                          aria-hidden="true"
                          className="hidden text-muted-foreground @max-[560px]:inline"
                        >
                          Order:{" "}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {index + 1}
                          {!archived && (
                            <span className="inline-flex flex-col">
                              <button
                                type="button"
                                aria-label={`Move ${entry.name} up`}
                                disabled={reordering || index === 0}
                                onClick={() =>
                                  void moveProject(index, index - 1)
                                }
                                className="cursor-pointer disabled:opacity-30"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${entry.name} down`}
                                disabled={
                                  reordering || index === projects.length - 1
                                }
                                onClick={() =>
                                  void moveProject(index, index + 1)
                                }
                                className="cursor-pointer disabled:opacity-30"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </span>
                          )}
                        </span>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <Pill
                          tone={
                            entry.published && !archived ? "success" : "neutral"
                          }
                        >
                          {archived
                            ? "Archived"
                            : entry.published
                              ? "Published"
                              : "Draft"}
                        </Pill>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <span
                          aria-hidden="true"
                          className="hidden text-muted-foreground @max-[560px]:inline"
                        >
                          Homepage:{" "}
                        </span>
                        {archived
                          ? "—"
                          : homepageIds.has(entry.id)
                            ? "Showing"
                            : entry.featured
                              ? entry.published
                                ? "Below first three"
                                : "When published"
                              : "—"}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="flex justify-end">
                        <RowActionsMenu<
                          "edit" | "view" | "archive" | "restore" | "delete"
                        >
                          triggerLabel={`More actions for ${entry.name}`}
                          items={
                            archived
                              ? [
                                  {
                                    action: "restore",
                                    label: (
                                      <RowActionLabel icon={RotateCcw}>
                                        Restore project
                                      </RowActionLabel>
                                    ),
                                    className:
                                      "text-[#247044] hover:bg-[#edf8f1] focus:bg-[#edf8f1] focus:text-[#247044] focus-visible:bg-[#edf8f1]",
                                  },
                                  {
                                    action: "delete",
                                    label: (
                                      <RowActionLabel icon={Trash2}>
                                        Delete permanently
                                      </RowActionLabel>
                                    ),
                                    className:
                                      "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
                                    separatorBefore: true,
                                  },
                                ]
                              : [
                                  {
                                    action: "edit",
                                    label: (
                                      <RowActionLabel icon={Pencil}>
                                        Edit project
                                      </RowActionLabel>
                                    ),
                                  },
                                  ...(entry.published
                                    ? [
                                        {
                                          action: "view" as const,
                                          label: (
                                            <RowActionLabel icon={Eye}>
                                              View public project
                                            </RowActionLabel>
                                          ),
                                        },
                                      ]
                                    : []),
                                  {
                                    action: "archive",
                                    label: (
                                      <RowActionLabel icon={Archive}>
                                        Archive project
                                      </RowActionLabel>
                                    ),
                                    className:
                                      "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
                                    separatorBefore: true,
                                  },
                                ]
                          }
                          onAction={(action) => {
                            if (action === "edit") setEditing(entry)
                            else if (action === "view")
                              router.push(`/explore/projects/${entry.slug}`)
                            else {
                              setError("")
                              setTarget({ entry, action })
                            }
                          }}
                        />
                      </ResponsiveDataTableCell>
                    </>
                  )}
                </DraggableShowcaseRow>
              ))}
            </Reorder.Group>
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {editing !== undefined && (
        <ShowcaseEntryPanel
          entry={editing}
          nextPosition={nextPosition}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            sileo.success({
              title: editing ? "Project updated" : "Project added",
            })
            resource.retry()
          }}
        />
      )}
      {target && (
        <ConfirmationDialog
          title={
            target.action === "archive"
              ? "Archive project?"
              : target.action === "restore"
                ? "Restore project?"
                : "Permanently delete project?"
          }
          subject={target.entry.name}
          description={
            target.action === "archive"
              ? "This project will be removed from the public showcase and moved to the archive."
              : target.action === "restore"
                ? "This project will return as a draft. You can publish it again when ready."
                : "This project will be permanently deleted. This cannot be undone."
          }
          confirmLabel={
            target.action === "archive"
              ? "Archive project"
              : target.action === "restore"
                ? "Restore project"
                : "Delete permanently"
          }
          pendingLabel="Saving…"
          destructive={target.action !== "restore"}
          pending={pending}
          error={error}
          onClose={() => setTarget(null)}
          onConfirm={() => void confirmAction()}
        />
      )}
    </main>
  )
}
