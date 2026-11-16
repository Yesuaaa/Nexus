"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  Layers3,
  UsersRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  sidebarActiveRowClass,
  sidebarCollapsedRowClass,
  sidebarNavLinkClass,
} from "@/components/layout/styles"

function ProjectNavLink({
  href,
  label,
  active,
  collapsed,
  onNavigate,
  children,
}: {
  href: string
  label: string
  active: boolean
  collapsed: boolean
  onNavigate: () => void
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        sidebarNavLinkClass,
        collapsed && sidebarCollapsedRowClass,
        active && sidebarActiveRowClass,
      )}
      onClick={onNavigate}
    >
      {children}
      <span
        className={cn(
          "min-w-0 truncate text-left",
          !collapsed && "flex-1",
          collapsed && "sr-only max-[767px]:not-sr-only",
        )}
      >
        {label}
      </span>
      {collapsed && <HoverTooltip side="right">{label}</HoverTooltip>}
    </Link>
  )
}

export function ClientProjectSidebarLinks({
  projectId,
  collapsed,
  onNavigate,
}: {
  projectId: string
  collapsed: boolean
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const basePath = `/projects/${encodeURIComponent(projectId)}`
  const selectedTab = searchParams.get("tab")
  const isDeliverables =
    pathname.startsWith(`${basePath}/deliverables`) ||
    selectedTab === "deliverables"

  return (
    <>
      <Link
        href="/projects"
        aria-label="Back to all projects"
        className={cn(
          sidebarNavLinkClass,
          "mb-2",
          collapsed && sidebarCollapsedRowClass,
        )}
        onClick={onNavigate}
      >
        <ArrowLeft
          className="size-[18px] flex-none"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span
          className={cn(
            "min-w-0 truncate",
            collapsed && "sr-only max-[767px]:not-sr-only",
          )}
        >
          Back to projects
        </span>
        {collapsed && (
          <HoverTooltip side="right">Back to projects</HoverTooltip>
        )}
      </Link>
      <ProjectNavLink
        href={basePath}
        label="Overview"
        active={
          !isDeliverables && selectedTab !== "notes" && selectedTab !== "team"
        }
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <FolderKanban className="size-[18px] flex-none" strokeWidth={1.75} />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=deliverables`}
        label="Deliverables (1)"
        active={isDeliverables}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <Layers3 className="size-[18px] flex-none" strokeWidth={1.75} />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=notes`}
        label="Notes"
        active={selectedTab === "notes"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <FileText className="size-[18px] flex-none" strokeWidth={1.75} />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=team`}
        label="Team"
        active={selectedTab === "team"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <UsersRound className="size-[18px] flex-none" strokeWidth={1.75} />
      </ProjectNavLink>
    </>
  )
}
