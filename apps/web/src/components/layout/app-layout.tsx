"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/auth/model/types"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

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
    () =>
      typeof window !== "undefined" && window.matchMedia(tabletQuery).matches,
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
        onToggleCollapse={() => setCollapsed((current) => !current)}
        onCloseDrawer={() => setDrawerOpen(false)}
        onSignOut={onSignOut}
      />
      <div
        className={cn(
          "h-dvh min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain py-[15px] pr-[15px] pl-4 transition-[margin-left] duration-[240ms] max-[767px]:m-0 max-[767px]:p-3 motion-reduce:transition-none",
          collapsed ? "ml-[95px]" : "ml-[311px]",
        )}
      >
        <Topbar
          drawerOpen={drawerOpen}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        {children}
      </div>
    </div>
  )
}
