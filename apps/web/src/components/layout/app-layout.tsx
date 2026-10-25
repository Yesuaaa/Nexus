import { useEffect, useState, type ReactNode } from "react"
import type { Account } from "@/features/auth/types"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import "./app-shell.css"

const tabletQuery = "(min-width: 768px) and (max-width: 1100px)"

export function AppLayout({
  account,
  onSignOut,
  children,
}: {
  account: Account
  onSignOut: () => void
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia(tabletQuery).matches,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(tabletQuery)
    const syncBreakpoint = () => setCollapsed(query.matches)
    query.addEventListener("change", syncBreakpoint)
    return () => query.removeEventListener("change", syncBreakpoint)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [drawerOpen])

  return (
    <div
      className="app-layout"
      data-variant={account.role === "USER" ? "client" : "management"}
      data-collapsed={collapsed}
      data-drawer-open={drawerOpen}
    >
      {drawerOpen && (
        <button
          type="button"
          className="app-drawer-overlay"
          aria-label="Close navigation menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Sidebar
        account={account}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        onToggleCollapse={() => setCollapsed((current) => !current)}
        onCloseDrawer={() => setDrawerOpen(false)}
        onSignOut={onSignOut}
      />
      <div className="app-scroll">
        <Topbar
          drawerOpen={drawerOpen}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        {children}
      </div>
    </div>
  )
}
