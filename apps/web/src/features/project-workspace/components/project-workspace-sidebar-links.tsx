"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronDown, FolderKanban } from "lucide-react"
import {
  listProjectWorkspaces,
  onProjectWorkspaceListChanged,
} from "../api/project-workspace-api"
import { focusRing } from "@/components/layout/styles"

export function ProjectWorkspaceSidebarLinks({
  collapsed,
  active,
  onNavigate,
}: {
  collapsed: boolean
  active: boolean
  onNavigate: () => void
}) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [expanded, setExpanded] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listProjectWorkspaces({ sort: "recent", limit: 5 }, controller.signal)
      .then(({ workspaces }) => {
        if (!controller.signal.aborted)
          setItems(
            workspaces
              .filter(
                ({ status }) => !["CANCELLED", "COMPLETED"].includes(status),
              )
              .map(({ id, name }) => ({ id, name })),
          )
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([])
      })
    return () => controller.abort()
  }, [revision])

  useEffect(
    () =>
      onProjectWorkspaceListChanged(() => setRevision((value) => value + 1)),
    [],
  )

  return (
    <div className="grid gap-1">
      {collapsed ? (
        <Link
          href="/project-workspace"
          aria-current={active ? "page" : undefined}
          title="Project Workspace"
          onClick={onNavigate}
          className={`grid aspect-square w-11 justify-self-center place-items-center rounded-md font-semibold text-foreground no-underline transition-colors hover:bg-[#e1e3e5] ${active ? "bg-[#e1e3e5]" : ""} ${focusRing}`}
        >
          <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="project-workspace-sidebar-subnav"
          onClick={() => setExpanded((value) => !value)}
          className={`flex min-h-10 w-full min-w-0 items-center gap-[13px] rounded-md px-[13px] font-semibold text-foreground transition-colors hover:bg-[#e1e3e5] ${active ? "bg-[#e1e3e5]" : ""} ${focusRing}`}
        >
          <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
          <span className="min-w-0 flex-1 truncate text-left">
            Project Workspace
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.8}
            className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}
          />
        </button>
      )}
      {!collapsed && (
        <div
          id="project-workspace-sidebar-subnav"
          aria-hidden={!expanded}
          inert={!expanded}
          className={`ml-[22px] grid gap-0.5 overflow-hidden border-l pl-3 transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none ${expanded ? "max-h-64 border-[#dfe4ec] opacity-100" : "pointer-events-none max-h-0 border-transparent opacity-0"}`}
        >
          <Link
            href="/project-workspace"
            onClick={onNavigate}
            className="min-h-8 truncate rounded-md px-2 py-2 text-[11px] font-medium text-[#536b91] no-underline transition-colors hover:bg-[#eef1f5] hover:text-[#203a78]"
          >
            All projects
          </Link>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/project-workspace/${encodeURIComponent(item.id)}`}
              onClick={onNavigate}
              className="min-h-8 truncate rounded-md px-2 py-2 text-[11px] text-[#647a9c] no-underline transition-colors hover:bg-[#eef1f5] hover:text-[#203a78]"
              title={item.name}
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
