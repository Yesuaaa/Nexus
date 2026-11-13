"use client"

import type { ReactNode } from "react"
import { AccountMenu } from "@/features/auth/components/account-menu"

export function WorkspaceSelectorShell({
  children,
  onSignOut,
}: {
  children: ReactNode
  onSignOut: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--portal-canvas)] p-[15px] text-sm text-foreground max-[767px]:p-3">
      <div
        className="flex justify-end pb-2"
        role="group"
        aria-label="Account controls"
      >
        <AccountMenu onSignOut={onSignOut} />
      </div>
      {children}
    </div>
  )
}
