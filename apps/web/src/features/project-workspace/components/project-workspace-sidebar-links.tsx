"use client"

import Link from "next/link"
import { FolderKanban } from "lucide-react"
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
  return (
    <div>
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
        <Link
          href="/project-workspace"
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={`flex min-h-10 w-full min-w-0 items-center gap-[13px] rounded-md pl-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-[#e1e3e5] ${active ? "bg-[#e1e3e5]" : ""} ${focusRing}`}
        >
          <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
          <span className="min-w-0 flex-1 truncate text-left">
            Project Workspace
          </span>
        </Link>
      )}
    </div>
  )
}
