"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  CalendarDays,
  CircleHelp,
  ClipboardList,
  FolderKanban,
  Inbox,
  MessageSquareText,
  MessagesSquare,
  UsersRound,
} from "lucide-react"
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
  type RoutePolicy,
  type RoutePolicyId,
} from "@/features/workspaces/model/route-policy"
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

const navLinkClass = `group relative flex min-h-10 w-full items-center gap-[13px] rounded-md border-0 bg-transparent px-[13px] text-left font-semibold text-foreground no-underline whitespace-nowrap cursor-pointer transition-colors duration-150 hover:bg-[#e1e3e5] max-[767px]:min-h-10 max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-[13px] max-[767px]:px-[13px] max-[767px]:aspect-auto motion-reduce:transition-none ${focusRing}`
const collapsedNavLinkClass =
  "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0"

function CollapsedTooltip({ children }: { children: string }) {
  return <HoverTooltip side="right">{children}</HoverTooltip>
}

function NavigationIcon({ policyId }: { policyId: RoutePolicyId }) {
  if (policyId === "dashboard") return <DashboardIcon className="flex-none" />
  if (policyId === "accounts" || policyId === "clients")
    return <AccountsIcon className="flex-none" />
  if (policyId === "departments")
    return <DepartmentIcon className="flex-none" />
  if (policyId === "services") return <ServiceIcon className="flex-none" />
  if (policyId === "service-requests")
    return <ClipboardList size={20} strokeWidth={1.7} className="flex-none" />
  if (policyId === "calendar")
    return <CalendarDays size={20} strokeWidth={1.7} className="flex-none" />
  if (policyId === "projects" || policyId === "project-workspace")
    return <FolderKanban size={20} strokeWidth={1.7} className="flex-none" />
  if (policyId === "request-inbox")
    return <Inbox size={20} strokeWidth={1.7} className="flex-none" />
  if (policyId === "help")
    return <CircleHelp size={20} strokeWidth={1.7} className="flex-none" />
  if (policyId === "employees" || policyId === "staff-workload")
    return <UsersRound size={20} strokeWidth={1.7} className="flex-none" />
  return null
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
        collapsed &&
          (navigation.location === "footer"
            ? "justify-center gap-0 p-0"
            : collapsedNavLinkClass),
        active && "bg-[#e1e3e5]",
      )}
      onClick={onNavigate}
    >
      <NavigationIcon policyId={policy.id} />
      <span
        className={cn(
          collapsed &&
            "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:overflow-visible max-[767px]:opacity-100",
        )}
      >
        {label}
      </span>
      {collapsed && <CollapsedTooltip>{label}</CollapsedTooltip>}
    </Link>
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
  const sectionLabelClass = cn(
    "px-[13px] pt-3 pb-1 text-[10px] leading-4 font-semibold tracking-[0.12em] text-[#71819a] uppercase",
    collapsed &&
      "h-0 overflow-hidden p-0 opacity-0 max-[767px]:h-auto max-[767px]:overflow-visible max-[767px]:px-[13px] max-[767px]:pt-3 max-[767px]:pb-1 max-[767px]:opacity-100",
  )

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "fixed top-[15px] bottom-[15px] left-[15px] z-30 h-[calc(100dvh-30px)] min-w-0 rounded-[14px] border border-[#dedede] bg-background transition-[width,transform] duration-[240ms] max-[767px]:invisible max-[767px]:top-0 max-[767px]:bottom-0 max-[767px]:left-0 max-[767px]:h-dvh max-[767px]:w-[min(296px,calc(100vw-48px))] max-[767px]:-translate-x-[105%] max-[767px]:rounded-l-none max-[767px]:rounded-r-[14px] motion-reduce:transition-none",
        collapsed ? "w-[80px]" : "w-[296px]",
        drawerOpen && "max-[767px]:visible max-[767px]:translate-x-0",
      )}
      aria-label="Primary navigation"
      data-drawer-open={drawerOpen}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            "relative flex h-[159px] flex-none items-start justify-center px-[14px] pt-[47px] transition-[height,padding] duration-[240ms] max-[767px]:h-[159px] max-[767px]:px-[14px] max-[767px]:pt-[47px] motion-reduce:transition-none",
            collapsed ? "h-[72px] p-0" : "h-[160px] pt-[51px]",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-col items-center overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
              collapsed &&
                "invisible pointer-events-none opacity-0 max-[767px]:visible max-[767px]:pointer-events-auto max-[767px]:opacity-100",
            )}
            aria-label="EXP Digital Solutions Inc."
          >
            <div className="flex h-[54px] w-[112px] items-center justify-center overflow-hidden">
              <img
                className="block w-[112px] flex-none"
                src="/auth/exp-logo.svg"
                alt="EXP"
              />
            </div>
            <span
              data-portal-access-label
              className="mt-1 text-center text-[10px] leading-[1.3] font-semibold tracking-[0.18em] text-[#46618d]"
            >
              {accessLabels[account.role]}
            </span>
          </div>
          <button
            type="button"
            className={cn(
              iconButtonClass,
              "group absolute top-[17px] right-[13px] max-[767px]:hidden",
              collapsed && "top-3 right-[21px]",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={onToggleCollapse}
          >
            <PanelIcon />
            {collapsed && <CollapsedTooltip>Expand sidebar</CollapsedTooltip>}
          </button>
          <button
            type="button"
            className={cn(
              iconButtonClass,
              "absolute top-[15px] right-3 hidden max-[767px]:grid",
            )}
            aria-label="Close navigation menu"
            onClick={onCloseDrawer}
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          className={cn(
            "grid min-h-0 content-start gap-[5px] px-6 max-[767px]:px-[22px]",
            collapsed
              ? "overflow-visible px-3"
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
              {workspaceNavigation.map((policy) => (
                <SidebarNavigationLink
                  key={policy.id}
                  policy={policy}
                  account={account}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onCloseDrawer}
                />
              ))}
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
                    )}
                    onClick={onCloseDrawer}
                  >
                    <MessagesSquare
                      size={20}
                      strokeWidth={1.7}
                      className="flex-none"
                    />
                    <span
                      className={cn(
                        collapsed &&
                          "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:overflow-visible max-[767px]:opacity-100",
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
                    )}
                    onClick={onCloseDrawer}
                  >
                    <MessageSquareText
                      size={20}
                      strokeWidth={1.7}
                      className="flex-none"
                    />
                    <span
                      className={cn(
                        collapsed &&
                          "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:overflow-visible max-[767px]:opacity-100",
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
                  )}
                  onClick={onCloseDrawer}
                >
                  <UsersRound
                    size={20}
                    strokeWidth={1.7}
                    className="flex-none"
                  />
                  <span
                    className={cn(
                      collapsed &&
                        "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:overflow-visible max-[767px]:opacity-100",
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
          <div
            className={cn(
              "mt-auto grid gap-[5px] border-t border-[#e2e5e9] px-6 pt-4 pb-[19px] max-[767px]:px-[22px]",
              collapsed && "px-3",
            )}
          >
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
