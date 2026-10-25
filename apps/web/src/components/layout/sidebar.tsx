import { NavLink } from "react-router"
import type { Account } from "@/features/auth/types"
import { hasPermission, Permissions } from "@/features/auth/permissions"
import {
  AccountsIcon,
  CloseIcon,
  DashboardIcon,
  PanelIcon,
  SignOutIcon,
} from "./icons"

const accessLabels: Record<Account["role"], string> = {
  USER: "DIGITAL SOLUTIONS INC.",
  STAFF: "STAFF ACCESS",
  ADMIN: "ADMIN ACCESS",
  SUPERADMIN: "SUPERADMIN ACCESS",
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
  return (
    <aside
      id="app-sidebar"
      className="app-sidebar"
      aria-label="Primary navigation"
      data-drawer-open={drawerOpen}
    >
      <div className="app-sidebar-inner">
        <div className="app-brand-row">
          <div className="app-brand" aria-label="EXP Digital Solutions Inc.">
            <div className="app-brand-image-frame">
              <img src="/auth/exp-logo.svg" alt="EXP" />
            </div>
            <span className="app-brand-caption">
              {accessLabels[account.role]}
            </span>
          </div>
          <button
            type="button"
            className="app-collapse-button app-icon-button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            <PanelIcon />
          </button>
          <button
            type="button"
            className="app-drawer-close app-icon-button"
            aria-label="Close navigation menu"
            onClick={onCloseDrawer}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="app-nav" aria-label="Main menu">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `app-nav-link${isActive ? " is-active" : ""}`
            }
            title={collapsed ? "Dashboard" : undefined}
            onClick={onCloseDrawer}
          >
            <DashboardIcon />
            <span className="app-sidebar-label">Dashboard</span>
          </NavLink>
          {hasPermission(account, Permissions.ACCOUNTS_READ) && (
            <NavLink
              to="/accounts"
              end
              className={({ isActive }) =>
                `app-nav-link${isActive ? " is-active" : ""}`
              }
              title={collapsed ? "Accounts" : undefined}
              onClick={onCloseDrawer}
            >
              <AccountsIcon />
              <span className="app-sidebar-label">Account Management</span>
            </NavLink>
          )}
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            className="app-sign-out"
            title={collapsed ? "Sign Out" : undefined}
            onClick={onSignOut}
          >
            <SignOutIcon />
            <span className="app-sidebar-label">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
