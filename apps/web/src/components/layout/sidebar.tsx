"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  CalendarDays,
  Clock3,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Contact,
  FolderKanban,
  Gauge,
  History,
  Inbox,
  MessageSquareText,
  MessagesSquare,
  MoveLeft,
  UsersRound,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/auth/model/types"
import {
  canAccessRequestInbox,
  canAccessProjectWorkspace,
  canCreateProjectWorkspace,
} from "@/features/auth/model/permissions"
import {
  getNavigationLabel,
  getNavigationPolicies,
  isNavigationActive,
  workspaceModuleLabels,
  canAccessRoute,
  type RoutePolicy,
  type RoutePolicyId,
} from "@/features/workspaces/model/route-policy"
import { attendanceNavigation } from "@/features/attendance/model/navigation"
import { useWorkspaceModuleId } from "@/features/workspaces/providers/workspace-provider"
import {
  ProjectWorkspaceSidebarLinks,
  StaffProjectSidebarLinks,
} from "@/features/projects/components/client-project-sidebar-links"

import { focusRing, iconButtonClass } from "./styles"
import {
  SidebarLink,
  SidebarRowIcon as RowIcon,
  SidebarTooltip as CollapsedTooltip,
  sidebarActiveRowClass as activeRowClass,
  sidebarCollapsedRowClass as collapsedRowClass,
  sidebarRowClass as rowClass,
  type SidebarIcon as NavIcon,
} from "./sidebar-link"
import {
  AccountsIcon,
  CloseIcon,
  DashboardIcon,
  DepartmentIcon,
  PanelIcon,
  ServiceIcon,
} from "./icons"

const accessLabels: Record<Account["role"], string> = {
  USER: "CLIENT ACCESS",
  STAFF: "STAFF ACCESS",
  ADMIN: "ADMIN ACCESS",
  SUPERADMIN: "SUPERADMIN ACCESS",
}

const navigationIcons: Partial<Record<RoutePolicyId, NavIcon>> = {
  dashboard: DashboardIcon,
  accounts: AccountsIcon,
  clients: Contact,
  departments: DepartmentIcon,
  services: ServiceIcon,
  "service-requests": ClipboardList,
  "module-service-operations": ClipboardList,
  calendar: CalendarDays,
  projects: FolderKanban,
  "project-workspace": FolderKanban,
  "request-inbox": Inbox,
  help: CircleHelp,
  employees: UsersRound,
  "staff-workload": Gauge,
  "administrative-workload": Gauge,
  "service-operation-logs": History,
  "project-management-logs": History,
  "attendance-audit": History,
}

function SidebarNavigationLink({
  policy,
  account,
  pathname,
  collapsed,
  onNavigate,
  labelOverride,
}: {
  policy: RoutePolicy
  account: Account
  pathname: string
  collapsed: boolean
  onNavigate: () => void
  labelOverride?: string
}) {
  const navigation = policy.navigation
  if (!navigation) return null
  const label = labelOverride ?? getNavigationLabel(policy, account)
  const active = isNavigationActive(policy, pathname)

  return (
    <SidebarLink
      href={
        typeof navigation.href === "function"
          ? navigation.href(account)
          : navigation.href
      }
      label={label}
      icon={navigationIcons[policy.id]}
      active={active}
      collapsed={collapsed}
      onNavigate={onNavigate}
    />
  )
}

/** A module with an Overview (cards & stats) and its main data table. */
type NavGroup = {
  kind: "group"
  label: string
  icon: NavIcon
  visible: (account: Account) => boolean
  links: {
    href: string
    label: string
    ariaLabel?: string
    match?: (pathname: string) => boolean
  }[]
}

function isGroupLinkActive(link: NavGroup["links"][number], pathname: string) {
  return link.match?.(pathname) ?? link.href === pathname
}

/**
 * "Departments" → Overview (/departments/overview) and Management
 * (/departments). Short visible labels keep the compact sidebar untruncated;
 * the links' accessible names spell out the module ("Department Management").
 */
function moduleGroup(
  label: string,
  singular: string,
  icon: NavIcon,
  base: string,
  visible: (account: Account) => boolean,
): NavGroup {
  return {
    kind: "group",
    label,
    icon,
    visible,
    links: [
      {
        href: `${base}/overview`,
        label: "Overview",
        ariaLabel: `${singular} overview`,
      },
      {
        href: base,
        label: "Management",
        ariaLabel: `${singular} Management`,
      },
    ],
  }
}

const administrativeRequestsPath = "/module/service-operations"

function requestGroup(account: Account): NavGroup {
  const links: NavGroup["links"] = []
  if (canAccessRoute(account, administrativeRequestsPath)) {
    links.push({
      href: administrativeRequestsPath,
      label: "Overview",
      ariaLabel: "Request overview",
    })
  }
  if (canAccessRoute(account, "/request-inbox/overview")) {
    links.push({
      href: "/request-inbox/overview",
      label: "Overview",
      ariaLabel: "Request overview",
    })
  }
  if (canAccessRoute(account, "/request-inbox")) {
    links.push({
      href: "/request-inbox",
      label: "Inbox",
      ariaLabel: "Request Inbox",
    })
  }
  return {
    kind: "group",
    label: "Request",
    icon: Inbox,
    visible: () => links.length > 0,
    links,
  }
}

type RowProps = {
  pathname: string
  collapsed: boolean
  onNavigate: () => void
}

/**
 * Within a module, Overview → Management slides forward and back again
 * (see ModuleTransition); jumps between modules switch without a slide.
 */
function groupTransition(
  group: NavGroup,
  href: string,
  pathname: string,
): string[] | undefined {
  const inGroup = group.links.some((link) => isGroupLinkActive(link, pathname))
  if (!inGroup || href === pathname) return undefined
  return [href.endsWith("/overview") ? "nav-back" : "nav-forward"]
}

/** Expandable group: a toggle row and its indented sub-links. */
function GroupDisclosure({
  group,
  pathname,
  open,
  onToggle,
  onNavigate,
}: Omit<RowProps, "collapsed"> & {
  group: NavGroup
  open: boolean
  onToggle: () => void
}) {
  const panelId = useId()
  const groupActive = group.links.some((link) =>
    isGroupLinkActive(link, pathname),
  )
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          rowClass,
          focusRing,
          groupActive && "text-[#203f8c] hover:text-[#203f8c]",
        )}
      >
        <RowIcon icon={group.icon} active={groupActive} />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 flex-none text-[#9aa4b5] transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-0.5 mb-1 ml-[19px] grid gap-0.5 border-l border-[#e6e9ee] pl-2">
            {group.links.map((link) => {
              const active = isGroupLinkActive(link, pathname)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  transitionTypes={groupTransition(group, link.href, pathname)}
                  aria-label={link.ariaLabel}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    rowClass,
                    "h-8 px-2.5 text-[12.5px]",
                    focusRing,
                    active && activeRowClass,
                  )}
                >
                  <span className="min-w-0 truncate">{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Collapsed desktop sidebar: the group icon opens its links to the right. */
function GroupFlyout({
  group,
  pathname,
  onNavigate,
}: Omit<RowProps, "collapsed"> & { group: NavGroup }) {
  const groupActive = group.links.some((link) =>
    isGroupLinkActive(link, pathname),
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={group.label}

          className={cn(
            rowClass,
            "group relative",
            focusRing,
            collapsedRowClass,
            groupActive && activeRowClass,
          )}
        >
          <RowIcon icon={group.icon} active={groupActive} />
          <CollapsedTooltip>{group.label}</CollapsedTooltip>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={12}
        className="min-w-[184px] rounded-lg border-[#e3e7ed] p-1"
      >
        <DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-[#8a94a6]">
          {group.label}
        </DropdownMenuLabel>
        {group.links.map((link) => {
          const active = isGroupLinkActive(link, pathname)
          return (
            <DropdownMenuItem
              key={link.href}
              asChild
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5 text-[13px] text-[#3b4658]",
                active && "bg-[#eef2f9] font-semibold text-[#203f8c]",
              )}
            >
              <Link
                href={link.href}
                transitionTypes={groupTransition(group, link.href, pathname)}
                aria-label={link.ariaLabel}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                {link.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Sidebar({
  account,
  collapsed,
  drawerOpen,
  onToggleCollapse,
  onCloseDrawer,
}: {
  account: Account
  collapsed: boolean
  drawerOpen: boolean
  onToggleCollapse: () => void
  onCloseDrawer: () => void
}) {
  const pathname = usePathname()
  const showRequestsUnderService =
    account.role === "SUPERADMIN" &&
    canAccessRoute(account, "/services") &&
    canAccessRoute(account, administrativeRequestsPath)
  // Groups follow the current page until the user toggles one. Once toggled,
  // the accordion keeps only the selected group open until navigation changes.
  const [openGroupState, setOpenGroupState] = useState<{
    pathname: string
    group: string | null
  } | null>(null)
  const openGroup =
    openGroupState?.pathname === pathname ? openGroupState.group : undefined
  function renderGroup(group: NavGroup) {
    const open =
      openGroup === undefined
        ? group.links.some((link) => isGroupLinkActive(link, pathname))
        : openGroup === group.label
    const disclosure = (
      <GroupDisclosure
        group={group}
        pathname={pathname}
        open={open}
        onToggle={() =>
          setOpenGroupState({
            pathname,
            group: open ? null : group.label,
          })
        }
        onNavigate={onCloseDrawer}
      />
    )
    if (!collapsed)
      return (
        <div key={group.label} className="min-w-0">
          {disclosure}
        </div>
      )
    // Collapsed applies to desktop only; the phone drawer always shows labels.
    return (
      <div key={group.label} className="grid min-w-0">
        <div className="grid max-[767px]:hidden">
          <GroupFlyout
            group={group}
            pathname={pathname}
            onNavigate={onCloseDrawer}
          />
        </div>
        <div className="hidden max-[767px]:block">{disclosure}</div>
      </div>
    )
  }

  function renderPolicy(policy: RoutePolicy) {
    const attendanceGroup = attendanceNavigation.find(
      (group) => group.id === policy.id,
    )
    if (attendanceGroup) {
      return renderGroup({
        kind: "group",
        label: attendanceGroup.label,
        icon:
          attendanceGroup.id === "attendance"
            ? Clock3
            : attendanceGroup.id === "attendance-requests"
              ? Inbox
              : ClipboardList,
        visible: policy.canAccess,
        links: attendanceGroup.links.filter((link) =>
          canAccessRoute(account, link.href),
        ),
      })
    }
    if (policy.id === "admin-project-management" && policy.canAccess(account)) {
      const group = moduleGroup(
        "Project Workspace",
        "Project Workspace",
        FolderKanban,
        "/project-management",
        policy.canAccess,
      )
      group.links[1].match = (path) =>
        path !== "/project-management/overview" &&
        isNavigationActive(policy, path)
      return renderGroup(group)
    }
    if (
      policy.id === "project-workspace" &&
      canCreateProjectWorkspace(account)
    ) {
      const group = moduleGroup(
        "Project Workspace",
        "Project Workspace",
        FolderKanban,
        "/project-workspace",
        canCreateProjectWorkspace,
      )
      group.links[1].match = (path) =>
        path !== group.links[0].href && isNavigationActive(policy, path)
      return renderGroup(group)
    }
    if (
      policy.id === "module-service-operations" ||
      policy.id === "request-inbox"
    ) {
      if (showRequestsUnderService && policy.id === "module-service-operations")
        return null

      const group = requestGroup(account)
      const hasAdministrativeOverview = group.links.some(
        (link) => link.href === administrativeRequestsPath,
      )
      // If a role can access both links, the overview policy renders the
      // group once and the inbox policy is intentionally suppressed.
      if (
        policy.id === "module-service-operations" ||
        (policy.id === "request-inbox" && !hasAdministrativeOverview)
      )
        return renderGroup(group)
      return null
    }
    const props = {
      policy,
      account,
      pathname,
      collapsed,
      onNavigate: onCloseDrawer,
    }
    if (
      account.role !== "USER" &&
      (policy.id === "departments" ||
        policy.id === "employees" ||
        policy.id === "services")
    ) {
      const names = {
        departments: ["Departments", "Department", DepartmentIcon],
        employees: ["Employees", "Employee", UsersRound],
        services: ["Service", "Service", ServiceIcon],
      } as const
      const [label, singular, icon] = names[policy.id]
      const group = moduleGroup(
        label,
        singular,
        icon,
        `/${policy.id}`,
        policy.canAccess,
      )
      if (policy.id === "services" && showRequestsUnderService) {
        group.links.push({
          href: administrativeRequestsPath,
          label: "Request",
          ariaLabel: "Request overview",
        })
      }
      return renderGroup(group)
    }
    return <SidebarNavigationLink key={policy.id} {...props} />
  }
  const searchParams = useSearchParams()
  const mainNavigation = getNavigationPolicies(account, "main")
  const isClient = account.role === "USER"
  const staffWorkspaceMatch =
    account.role === "STAFF" &&
    pathname !== "/project-workspace/overview" &&
    pathname !== "/project-workspace/new"
      ? pathname.match(/^\/project-workspace\/([^/]+)$/)
      : null
  const staffProjectId = staffWorkspaceMatch?.[1]
    ? decodeURIComponent(staffWorkspaceMatch[1])
    : null
  const administrativeProjectId =
    account.role === "SUPERADMIN" && pathname === "/module/project-management"
      ? searchParams.get("project")
      : null
  const projectBackQuery = new URLSearchParams(searchParams.toString())
  projectBackQuery.delete("tab")
  const projectBackHref = staffProjectId
    ? `/project-workspace${projectBackQuery.size ? `?${projectBackQuery}` : ""}`
    : administrativeProjectId
      ? "/module/project-management"
      : null
  const activeModuleId = useWorkspaceModuleId()
  const dashboardPolicy = mainNavigation.find(
    (policy) => policy.id === "dashboard",
  )
  const workspaceNavigation = activeModuleId
    ? mainNavigation.filter((policy) => policy.moduleId === activeModuleId)
    : []
  const systemToolNavigation = activeModuleId
    ? getNavigationPolicies(account, "system-tool").filter(
        (policy) => policy.moduleId === activeModuleId,
      )
    : []
  const sharedNavigation = mainNavigation.filter(
    (policy) =>
      policy.id !== "dashboard" && (isClient || policy.moduleId === null),
  )
  const footerNavigation = getNavigationPolicies(account, "footer").filter(
    (policy) =>
      isClient ||
      policy.moduleId === null ||
      policy.moduleId === activeModuleId,
  )
  const projectMessagesActive =
    pathname === "/messages" &&
    searchParams.get("scope") === "project" &&
    searchParams.get("mode") !== "internal" &&
    !searchParams.has("request")
  const serviceMessagesActive =
    pathname === "/messages" &&
    searchParams.get("scope") === "service" &&
    searchParams.get("mode") !== "internal" &&
    !searchParams.has("project")
  const internalMessagesActive =
    pathname === "/messages" && searchParams.get("mode") === "internal"
  const sectionLabelClass = cn(
    "px-2.5 pt-3 pb-1 text-[10px] leading-4 font-semibold tracking-[0.12em] text-[#8a94a6] uppercase",
    collapsed &&
      "h-0 overflow-hidden p-0 opacity-0 max-[767px]:h-auto max-[767px]:overflow-visible max-[767px]:px-2.5 max-[767px]:pt-3 max-[767px]:pb-1 max-[767px]:opacity-100",
  )

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "fixed top-2 bottom-2 left-2 z-30 h-[calc(100dvh-16px)] min-w-0 rounded-[14px] border border-[#dedede] bg-background transition-[width,transform] duration-[240ms] max-[767px]:invisible max-[767px]:top-0 max-[767px]:bottom-0 max-[767px]:left-0 max-[767px]:h-dvh max-[767px]:w-[min(260px,calc(100vw-48px))] max-[767px]:-translate-x-[105%] max-[767px]:rounded-l-none max-[767px]:rounded-r-[14px] motion-reduce:transition-none",
        collapsed ? "w-[64px]" : "w-[232px]",

        drawerOpen && "max-[767px]:visible max-[767px]:translate-x-0",
      )}
      aria-label="Primary navigation"
      data-drawer-open={drawerOpen}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header spans the topbar's band (70px minus this aside's 1px top
            border); the menu's pt-2 mirrors the 8px gap above the main panel,
            so the first link lines up with the panel's top edge. */}
        <div
          className={cn(
            "flex h-[69px] flex-none items-center gap-2 pr-3 pl-5",
            collapsed &&
              "justify-center px-0 max-[767px]:justify-start max-[767px]:pr-3 max-[767px]:pl-5",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col items-start overflow-hidden whitespace-nowrap",
              collapsed && "hidden max-[767px]:flex",
            )}
            aria-label="EXP Digital Solutions Inc."
          >
            <img
              className="block w-[64px] flex-none"
              src="/auth/exp-logo.svg"
              alt="EXP"
            />
            <span
              data-portal-access-label
              className="mt-1 text-[9px] leading-none font-semibold tracking-[0.16em] text-[#46618d]"
            >
              {accessLabels[account.role]}
            </span>
          </div>
          <button
            type="button"
            className={cn(
              iconButtonClass,
              "group relative size-8 max-[767px]:hidden",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={onToggleCollapse}
          >
            <PanelIcon className="size-[18px]" />
            {collapsed && <CollapsedTooltip>Expand sidebar</CollapsedTooltip>}
          </button>
          <button
            type="button"
            className={cn(iconButtonClass, "hidden size-8 max-[767px]:grid")}
            aria-label="Close navigation menu"
            onClick={onCloseDrawer}
          >
            <CloseIcon className="size-[18px]" />
          </button>
        </div>

        <nav
          className={cn(
            "grid min-h-0 grid-cols-[minmax(0,1fr)] content-start gap-0.5 px-3 pt-2 pb-3",
            collapsed
              ? "overflow-visible"
              : "overflow-x-hidden overflow-y-auto",
          )}
          aria-label="Main menu"
        >
          {projectBackHref ? (
            <SidebarLink
              href={projectBackHref}
              label="Back to projects"
              icon={MoveLeft}
              collapsed={collapsed}
              onNavigate={onCloseDrawer}
            />
          ) : (
            dashboardPolicy && (
              <SidebarNavigationLink
                policy={dashboardPolicy}
                account={account}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseDrawer}
                labelOverride={isClient ? undefined : "Switch Workspace"}
              />
            )
          )}

          {activeModuleId && (
            <p className={sectionLabelClass}>
              {workspaceModuleLabels[activeModuleId]}
            </p>
          )}
          {staffProjectId ? (
            <StaffProjectSidebarLinks
              projectId={staffProjectId}
              collapsed={collapsed}
              onNavigate={onCloseDrawer}
              showBackLink={false}
            />
          ) : administrativeProjectId ? (
            <ProjectWorkspaceSidebarLinks
              projectBaseHref={pathname}
              backHref="/module/project-management"
              collapsed={collapsed}
              onNavigate={onCloseDrawer}
              showBackLink={false}
            />
          ) : (
            workspaceNavigation.map(renderPolicy)
          )}
          {!projectBackHref &&
            activeModuleId === "project-management" &&
            canAccessProjectWorkspace(account) && (
              <SidebarLink
                href="/messages?scope=project"
                label="Project Messages"
                icon={MessagesSquare}
                active={projectMessagesActive}
                collapsed={collapsed}
                onNavigate={onCloseDrawer}
              />
            )}
          {activeModuleId === "service-operations" &&
            canAccessRequestInbox(account) && (
              <SidebarLink
                href="/messages?scope=service"
                label="Service Messages"
                icon={MessageSquareText}
                active={serviceMessagesActive}
                collapsed={collapsed}
                onNavigate={onCloseDrawer}
              />
            )}

          {systemToolNavigation.length > 0 && (
            <div
              role="group"
              aria-labelledby="sidebar-system-tool"
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5"
            >
              <p id="sidebar-system-tool" className={sectionLabelClass}>
                System Tool
              </p>
              {systemToolNavigation.map(renderPolicy)}
            </div>
          )}

          {sharedNavigation.length > 0 && (
            <>
              {activeModuleId && <p className={sectionLabelClass}>Shared</p>}
              {sharedNavigation.map((policy) => (
                <SidebarNavigationLink
                  key={policy.id}
                  policy={policy}
                  account={account}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onCloseDrawer}
                />
              ))}
              {!isClient && (
                <SidebarLink
                  href="/messages?mode=internal"
                  label="Internal Messages"
                  icon={UsersRound}
                  active={internalMessagesActive}
                  collapsed={collapsed}
                  onNavigate={onCloseDrawer}
                />
              )}
            </>
          )}
        </nav>

        {footerNavigation.length > 0 && (
          <div className="mt-auto grid gap-0.5 border-t border-[#eef0f3] p-3">
            {footerNavigation.map((policy) => (
              <SidebarNavigationLink
                key={policy.id}
                policy={policy}
                account={account}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseDrawer}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
