"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/auth/model/types"
import {
  canAccessDepartmentManagement,
  canAccessServiceManagement,
  hasPermission,
  Permissions,
} from "@/features/auth/model/permissions"
import { collapsedTooltipClass, focusRing, iconButtonClass } from "./styles"
import {
  AccountsIcon,
  CloseIcon,
  DashboardIcon,
  DepartmentIcon,
  PanelIcon,
  SignOutIcon,
  ServiceIcon,
} from "./icons"

const accessLabels: Record<Account["role"], string> = {
  USER: "DIGITAL SOLUTIONS INC.",
  STAFF: "STAFF ACCESS",
  ADMIN: "ADMIN ACCESS",
  SUPERADMIN: "SUPERADMIN ACCESS",
}

const navLinkClass = `group relative flex min-h-10 w-full items-center gap-[13px] rounded-md border-0 bg-transparent px-[13px] text-left font-semibold text-foreground no-underline whitespace-nowrap cursor-pointer transition-colors duration-150 hover:bg-[#e1e3e5] max-[767px]:min-h-10 max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-[13px] max-[767px]:px-[13px] max-[767px]:aspect-auto motion-reduce:transition-none ${focusRing}`

function CollapsedTooltip({ children }: { children: string }) {
  return (
    <span className={collapsedTooltipClass} aria-hidden="true">
      {children}
    </span>
  )
}

export function Sidebar({
  account,
  collapsed,
  drawerOpen,
  onToggleCollapse,
  onCloseDrawer,
  onSignOut,
}: {
  account: Account
  collapsed: boolean
  drawerOpen: boolean
  onToggleCollapse: () => void
  onCloseDrawer: () => void
  onSignOut: () => void
}) {
  const pathname = usePathname()
  const management = account.role !== "USER"
  const collapsedLabelClass = collapsed
    ? "w-0 overflow-hidden opacity-0 max-[767px]:w-auto max-[767px]:overflow-visible max-[767px]:opacity-100"
    : ""

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "fixed z-30 min-w-0 border-r border-[#e0e5eb] bg-background shadow-[2px_0_4px_rgb(20_30_50_/_11%)] transition-[width,transform] duration-[240ms] max-[767px]:invisible max-[767px]:top-0 max-[767px]:bottom-0 max-[767px]:left-0 max-[767px]:h-dvh max-[767px]:w-[min(296px,calc(100vw-48px))] max-[767px]:-translate-x-[105%] max-[767px]:rounded-r-[14px] max-[767px]:shadow-[5px_0_24px_rgb(20_30_50_/_13%)] motion-reduce:transition-none",
        management
          ? "top-[15px] bottom-[15px] left-[15px] h-[calc(100dvh-30px)] rounded-[14px] border border-[#dedede] max-[767px]:rounded-l-none"
          : "top-0 bottom-0 left-0",
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
            collapsed ? "h-[72px] p-0" : management && "h-[160px] pt-[51px]",
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
            <span className="mt-1 text-center text-[10px] leading-[1.3] font-semibold tracking-[0.18em] text-[#46618d]">
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
            "grid min-h-0 content-start gap-[5px] overflow-y-auto px-[22px] max-[767px]:px-[22px]",
            management && "px-6",
            collapsed && "overflow-visible px-3",
          )}
          aria-label="Main menu"
        >
          <Link
            href="/dashboard"
            aria-current={pathname === "/dashboard" ? "page" : undefined}
            className={cn(
              navLinkClass,
              collapsed &&
                "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
              pathname === "/dashboard" && "bg-[#e1e3e5]",
            )}
            onClick={onCloseDrawer}
          >
            <DashboardIcon className="flex-none" />
            <span className={collapsedLabelClass}>Dashboard</span>
            {collapsed && <CollapsedTooltip>Dashboard</CollapsedTooltip>}
          </Link>
          {hasPermission(account, Permissions.ACCOUNTS_READ) && (
            <Link
              href="/accounts"
              aria-current={pathname === "/accounts" ? "page" : undefined}
              className={cn(
                navLinkClass,
                collapsed &&
                  "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
                pathname === "/accounts" && "bg-[#e1e3e5]",
              )}
              onClick={onCloseDrawer}
            >
              <AccountsIcon className="flex-none" />
              <span className={collapsedLabelClass}>Account Management</span>
              {collapsed && (
                <CollapsedTooltip>Account Management</CollapsedTooltip>
              )}
            </Link>
          )}
          {canAccessDepartmentManagement(account) && (
            <Link
              href="/departments"
              aria-current={pathname === "/departments" ? "page" : undefined}
              className={cn(
                navLinkClass,
                collapsed &&
                  "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
                pathname === "/departments" && "bg-[#e1e3e5]",
              )}
              onClick={onCloseDrawer}
            >
              <DepartmentIcon className="flex-none" />
              <span className={collapsedLabelClass}>Department Management</span>
              {collapsed && (
                <CollapsedTooltip>Department Management</CollapsedTooltip>
              )}
            </Link>
          )}
          {canAccessServiceManagement(account) && (
            <Link
              href="/services"
              aria-current={pathname === "/services" ? "page" : undefined}
              className={cn(
                navLinkClass,
                collapsed &&
                  "aspect-square min-h-0 w-11 justify-self-center justify-center gap-0 p-0",
                pathname === "/services" && "bg-[#e1e3e5]",
              )}
              onClick={onCloseDrawer}
            >
              <ServiceIcon className="flex-none" />
              <span className={collapsedLabelClass}>Service Management</span>
              {collapsed && (
                <CollapsedTooltip>Service Management</CollapsedTooltip>
              )}
            </Link>
          )}
        </nav>

        <div
          className={cn(
            "mt-auto px-[22px] pt-4 pb-5 max-[767px]:px-[22px]",
            management && "border-t border-[#e2e5e9] px-6 pb-[19px]",
            collapsed && "px-3",
          )}
        >
          <button
            type="button"
            className={cn(
              navLinkClass,
              "font-normal text-[#f35b61] hover:bg-[#fff0f1]",
              collapsed && "justify-center gap-0 p-0",
            )}
            onClick={onSignOut}
          >
            <SignOutIcon className="flex-none" />
            <span className={collapsedLabelClass}>Sign Out</span>
            {collapsed && <CollapsedTooltip>Sign Out</CollapsedTooltip>}
          </button>
        </div>
      </div>
    </aside>
  )
}
