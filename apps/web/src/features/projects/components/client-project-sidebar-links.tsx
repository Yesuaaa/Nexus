"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import {
  ClipboardList,
  ArrowLeft,
  FileText,
  FolderKanban,
  History,
  Layers3,
  UsersRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"

const projectNavLinkClass = `group relative flex min-h-10 w-full items-center gap-[13px] rounded-md border-0 bg-transparent px-[13px] text-left font-semibold text-foreground no-underline whitespace-nowrap cursor-pointer transition-colors duration-150 hover:bg-[#e1e3e5] motion-reduce:transition-none ${focusRing}`

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
      title={collapsed ? label : undefined}
      className={cn(
        projectNavLinkClass,
        collapsed &&
          "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
        active && "bg-[#e1e3e5]",
      )}
      onClick={onNavigate}
    >
      {children}
      <span
        className={cn(
          "min-w-0 truncate text-left",
          !collapsed && "flex-1",
          collapsed &&
            "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:flex-1 max-[767px]:overflow-visible max-[767px]:opacity-100",
        )}
      >
        {label}
      </span>
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
        title={collapsed ? "Back to projects" : undefined}
        className={cn(
          projectNavLinkClass,
          "mb-2 text-[#203f8c] hover:text-[#172f70]",
          collapsed &&
            "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
        )}
        onClick={onNavigate}
      >
        <ArrowLeft size={20} strokeWidth={1.7} aria-hidden="true" />
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
        <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=deliverables`}
        label="Deliverables (1)"
        active={isDeliverables}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <Layers3 size={20} strokeWidth={1.7} className="flex-none" />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=notes`}
        label="Notes"
        active={selectedTab === "notes"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <FileText size={20} strokeWidth={1.7} className="flex-none" />
      </ProjectNavLink>
      <ProjectNavLink
        href={`${basePath}?tab=team`}
        label="Team"
        active={selectedTab === "team"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <UsersRound size={20} strokeWidth={1.7} className="flex-none" />
      </ProjectNavLink>
    </>
  )
}

export function StaffProjectSidebarLinks({
  projectId,
  collapsed,
  onNavigate,
}: {
  projectId: string
  collapsed: boolean
  onNavigate: () => void
}) {
  const searchParams = useSearchParams()
  const basePath = `/project-workspace/${encodeURIComponent(projectId)}`
  const backQuery = new URLSearchParams(searchParams.toString())
  backQuery.delete("tab")
  const backHref = `/project-workspace${backQuery.size ? `?${backQuery}` : ""}`

  return (
    <ProjectWorkspaceSidebarLinks
      projectBaseHref={basePath}
      backHref={backHref}
      collapsed={collapsed}
      onNavigate={onNavigate}
    />
  )
}

const workspaceSections = [
  { id: "overview", label: "Overview", icon: FolderKanban },
  { id: "work", label: "Work", icon: ClipboardList },
  { id: "deliverables", label: "Deliverables", icon: Layers3 },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "requests", label: "Requests", icon: ClipboardList },
  { id: "team", label: "Team", icon: UsersRound },
  { id: "activity", label: "Activity", icon: History },
] as const

export function ProjectWorkspaceSidebarLinks({
  projectBaseHref,
  backHref,
  collapsed,
  onNavigate,
}: {
  projectBaseHref: string
  backHref: string
  collapsed: boolean
  onNavigate: () => void
}) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab")?.toLowerCase() ?? "overview"

  return (
    <>
      <ProjectNavLink
        href={backHref}
        label="Back to projects"
        active={false}
        collapsed={collapsed}
        onNavigate={onNavigate}
      >
        <ArrowLeft size={20} strokeWidth={1.7} className="flex-none" />
      </ProjectNavLink>
      {workspaceSections.map(({ id, label, icon: Icon }) => {
        const query = new URLSearchParams(searchParams.toString())
        if (id === "overview") query.delete("tab")
        else query.set("tab", id)
        const href = `${projectBaseHref}${query.size ? `?${query}` : ""}`
        return (
          <ProjectNavLink
            key={id}
            href={href}
            label={label}
            active={activeTab === id}
            collapsed={collapsed}
            onNavigate={onNavigate}
          >
            <Icon size={20} strokeWidth={1.7} className="flex-none" />
          </ProjectNavLink>
        )
      })}
    </>
  )
}
