"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/auth/model/types"
import { canAccessMessages } from "@/features/auth/model/permissions"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

const tabletQuery = "(min-width: 768px) and (max-width: 1100px)"
const sidebarCollapsedStorageKey = "nexus.layout.sidebar-collapsed"

function readSidebarCollapsedPreference(): boolean | null {
  if (typeof window === "undefined") return null

  try {
    const stored = window.sessionStorage.getItem(sidebarCollapsedStorageKey)
    if (stored === "true") return true
    if (stored === "false") return false
  } catch {
    // Fall back to the responsive default when storage is unavailable.
  }

  return null
}

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
    () =>
      readSidebarCollapsedPreference() ??
      (typeof window !== "undefined" && window.matchMedia(tabletQuery).matches),
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(tabletQuery)
    const syncBreakpoint = () => {
      if (readSidebarCollapsedPreference() === null) setCollapsed(query.matches)
    }
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

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      try {
        window.sessionStorage.setItem(sidebarCollapsedStorageKey, String(next))
      } catch {
        // Keep the control functional when storage is unavailable.
      }
      return next
    })
  }

  return (
    <div
      className="relative h-dvh overflow-hidden bg-[var(--portal-canvas)] text-sm text-foreground"
      data-variant="management"
      data-role={account.role}
      data-collapsed={collapsed}
      data-drawer-open={drawerOpen}
    >
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 hidden w-full cursor-pointer border-0 bg-[rgb(15_28_53_/_48%)] max-[767px]:block"
          aria-label="Close navigation menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Sidebar
        account={account}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        onToggleCollapse={toggleSidebar}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div
        className={cn(
          "h-dvh min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-2 transition-[margin-left] duration-[240ms] max-[767px]:m-0 max-[767px]:p-1.5 motion-reduce:transition-none",
          // Sidebar inset (8px) + its width; the p-2 above is the 8px gap.
          collapsed ? "ml-[72px]" : "ml-[240px]",
        )}
      >
        <Topbar
          drawerOpen={drawerOpen}
          onOpenMenu={() => setDrawerOpen(true)}
          onSignOut={onSignOut}
          showMessages={canAccessMessages(account)}
        />
        {children}
      </div>
    </div>
  )
}
