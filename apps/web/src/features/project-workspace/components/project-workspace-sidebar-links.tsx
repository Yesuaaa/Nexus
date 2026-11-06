"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { FolderKanban } from "lucide-react"
import { listProjectWorkspaces } from "../api/project-workspace-api"
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

  useEffect(() => {
    const controller = new AbortController()
    listProjectWorkspaces({ sort: "recent", limit: 5 }, controller.signal)
      .then(({ workspaces }) => {
        if (!controller.signal.aborted)
          setItems(workspaces.map(({ id, name }) => ({ id, name })))
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([])
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="grid gap-1">
      <Link
        href="/project-workspace"
        aria-current={active ? "page" : undefined}
        title={collapsed ? "Project Workspace" : undefined}
        onClick={onNavigate}
        className={`group relative flex min-h-10 w-full items-center gap-[13px] rounded-md px-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-[#e1e3e5] ${active ? "bg-[#e1e3e5]" : ""} ${collapsed ? "aspect-square w-11 justify-self-center justify-center gap-0 px-0" : ""} ${focusRing}`}
      >
        <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
        <span className={collapsed ? "sr-only" : "truncate"}>
          Project Workspace
        </span>
      </Link>
      {!collapsed && items.length > 0 && (
        <div className="ml-[22px] grid gap-0.5 border-l border-[#dfe4ec] pl-3">
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
