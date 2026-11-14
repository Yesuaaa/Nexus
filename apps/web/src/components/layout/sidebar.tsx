"use client"

import { useId, useState, type ComponentType } from "react"
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
  Inbox,
  MessageSquareText,
  MessagesSquare,
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
import { HoverTooltip } from "@/components/ui/hover-tooltip"

import { focusRing, iconButtonClass } from "./styles"
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

const rowClass =
  "flex h-9 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left text-[13px] font-medium whitespace-nowrap text-[#3b4658] no-underline transition-colors duration-150 hover:bg-[#f3f5f8] hover:text-[#182235] motion-reduce:transition-none"
const activeRowClass =
  "bg-[#eef2f9] font-semibold text-[#203f8c] hover:bg-[#eef2f9] hover:text-[#203f8c]"
/** Icon-only square in the collapsed desktop sidebar (full row in the drawer). */
const collapsedRowClass =
  "size-10 justify-center justify-self-center gap-0 p-0 max-[767px]:h-9 max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-2.5 max-[767px]:px-2.5"

const navLinkClass = `group relative ${rowClass} ${focusRing}`
const collapsedNavLinkClass = collapsedRowClass

function CollapsedTooltip({ children }: { children: string }) {
  return <HoverTooltip side="right">{children}</HoverTooltip>
}

function NavigationIcon({
  policyId,
  active,
}: {
  policyId: RoutePolicyId
  active: boolean
}) {
  const icons: Partial<Record<RoutePolicyId, NavIcon>> = {
    dashboard: DashboardIcon,
    accounts: AccountsIcon,
    clients: Contact,
    departments: DepartmentIcon,
    services: ServiceIcon,
    "service-requests": ClipboardList,
    calendar: CalendarDays,
    projects: FolderKanban,
    "project-workspace": FolderKanban,
    "request-inbox": Inbox,
    help: CircleHelp,
    employees: UsersRound,
    "attendance-dashboard": DashboardIcon,
    "staff-workload": Gauge,
  }
  const icon = icons[policyId]
  return icon ? <RowIcon icon={icon} active={active} /> : null
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
    <Link
      href={
        typeof navigation.href === "function"
          ? navigation.href(account)
          : navigation.href
      }
      aria-current={active ? "page" : undefined}
      className={cn(
        navLinkClass,
        collapsed && collapsedNavLinkClass,
        active && activeRowClass,
      )}
      onClick={onNavigate}
    >
      <NavigationIcon policyId={policy.id} active={active} />
      <span
        className={cn(
          "min-w-0 truncate",
          collapsed && "sr-only max-[767px]:not-sr-only",
        )}
      >
        {label}
      </span>
      {collapsed && <CollapsedTooltip>{label}</CollapsedTooltip>}
    </Link>
  )
}

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>

/** A module with an Overview (cards & stats) and its main data table. */
type NavGroup = {
  kind: "group"
  label: string
  icon: NavIcon
  visible: (account: Account) => boolean
  links: { href: string; label: string; ariaLabel?: string }[]
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

function RowIcon({ icon: Icon, active }: { icon: NavIcon; active: boolean }) {
  return (
    <Icon
      className={cn(
        "size-[18px] flex-none",
        active ? "text-[#203f8c]" : "text-[#6b778c]",
      )}
      strokeWidth={1.75}
    />
  )
}

type RowProps = {
  pathname: string
  collapsed: boolean
  onNavigate: () => void
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
  const groupActive = group.links.some((link) => link.href === pathname)
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
              const active = link.href === pathname
              return (
                <Link
                  key={link.href}
                  href={link.href}
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
  const groupActive = group.links.some((link) => link.href === pathname)
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
          const active = link.href === pathname
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
  // Groups follow the current page unless the user toggled them.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  function renderGroup(group: NavGroup) {
    const open =
      openGroups[group.label] ??
      group.links.some((link) => link.href === pathname)
    const disclosure = (
      <GroupDisclosure
        group={group}
        pathname={pathname}
        open={open}
        onToggle={() =>
          setOpenGroups((current) => ({ ...current, [group.label]: !open }))
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
    if (attendanceGroup && attendanceGroup.id !== "attendance-dashboard") {
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
        services: ["Services", "Service", ServiceIcon],
      } as const
      const [label, singular, icon] = names[policy.id]
      return renderGroup(
        moduleGroup(label, singular, icon, `/${policy.id}`, policy.canAccess),
      )
    }
    return <SidebarNavigationLink key={policy.id} {...props} />
  }
  const searchParams = useSearchParams()
  const mainNavigation = getNavigationPolicies(account, "main")
  const isClient = account.role === "USER"
  const activeModuleId = useWorkspaceModuleId()
  const dashboardPolicy = mainNavigation.find(
    (policy) => policy.id === "dashboard",
  )
  const workspaceNavigation = activeModuleId
    ? mainNavigation.filter((policy) => policy.moduleId === activeModuleId)
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
          {dashboardPolicy && (
            <SidebarNavigationLink
              policy={dashboardPolicy}
              account={account}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onCloseDrawer}
              labelOverride={isClient ? undefined : "Switch Workspace"}
            />
          )}

          {activeModuleId && (
            <>
              <p className={sectionLabelClass}>
                {workspaceModuleLabels[activeModuleId]}
              </p>
              {workspaceNavigation.map(renderPolicy)}
              {activeModuleId === "project-management" &&
                canAccessProjectWorkspace(account) && (
                  <Link
                    href="/messages?scope=project"
                    aria-current={
                      pathname === "/messages" &&
                      searchParams.get("scope") === "project" &&
                      searchParams.get("mode") !== "internal" &&
                      !searchParams.has("request")
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      navLinkClass,
                      collapsed && collapsedNavLinkClass,
                      projectMessagesActive && activeRowClass,
                    )}
                    onClick={onCloseDrawer}
                  >
                    <RowIcon
                      icon={MessagesSquare}
                      active={projectMessagesActive}
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        collapsed && "sr-only max-[767px]:not-sr-only",
                      )}
                    >
                      Project Messages
                    </span>
                    {collapsed && (
                      <CollapsedTooltip>Project Messages</CollapsedTooltip>
                    )}
                  </Link>
                )}
              {activeModuleId === "service-operations" &&
                canAccessRequestInbox(account) && (
                  <Link
                    href="/messages?scope=service"
                    aria-current={
                      pathname === "/messages" &&
                      searchParams.get("scope") === "service" &&
                      searchParams.get("mode") !== "internal" &&
                      !searchParams.has("project")
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      navLinkClass,
                      collapsed && collapsedNavLinkClass,
                      serviceMessagesActive && activeRowClass,
                    )}
                    onClick={onCloseDrawer}
                  >
                    <RowIcon
                      icon={MessageSquareText}
                      active={serviceMessagesActive}
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        collapsed && "sr-only max-[767px]:not-sr-only",
                      )}
                    >
                      Service Messages
                    </span>
                    {collapsed && (
                      <CollapsedTooltip>Service Messages</CollapsedTooltip>
                    )}
                  </Link>
                )}
            </>
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
                <Link
                  href="/messages?mode=internal"
                  aria-current={
                    pathname === "/messages" &&
                    searchParams.get("mode") === "internal"
                      ? "page"
                      : undefined
                  }
                  className={cn(
                    navLinkClass,
                    collapsed && collapsedNavLinkClass,
                    internalMessagesActive && activeRowClass,
                  )}
                  onClick={onCloseDrawer}
                >
                  <RowIcon icon={UsersRound} active={internalMessagesActive} />
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      collapsed && "sr-only max-[767px]:not-sr-only",
                    )}
                  >
                    Internal Messages
                  </span>
                  {collapsed && (
                    <CollapsedTooltip>Internal Messages</CollapsedTooltip>
                  )}
                </Link>
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
