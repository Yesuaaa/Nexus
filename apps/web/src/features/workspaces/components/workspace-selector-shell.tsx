"use client"

import type { ReactNode } from "react"
import { Topbar } from "@/components/layout/topbar"

export function WorkspaceSelectorShell({
  children,
  onSignOut,
}: {
  children: ReactNode
  onSignOut: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--portal-canvas)] p-[15px] text-sm text-foreground max-[767px]:p-3">
      <Topbar minimal onSignOut={onSignOut} />
      {children}
    </div>
  )
}
