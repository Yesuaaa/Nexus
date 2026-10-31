"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { AccountMenu } from "@/features/auth/components/account-menu"
import { Breadcrumbs } from "./breadcrumbs"
import { MenuIcon } from "./icons"
import { iconButtonClass } from "./styles"
import { WorkflowNotifications } from "@/features/workflow-notifications/components/workflow-notifications"

export function Topbar({
  drawerOpen,
  onOpenMenu,
  onSignOut,
  showMessages,
}: {
  drawerOpen: boolean
  onOpenMenu: () => void
  onSignOut: () => void
  showMessages: boolean
}) {
  const pathname = usePathname()
  return (
    <header className="flex h-[70px] min-w-0 items-center rounded-[13px] border border-[#dedede] bg-background px-4 shadow-[0_2px_4px_rgb(20_30_50_/_11%)] max-[767px]:h-[62px] max-[767px]:gap-[9px] max-[767px]:px-[10px]">
      <button
        type="button"
        className={`${iconButtonClass} hidden max-[767px]:grid`}
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        aria-expanded={drawerOpen}
        onClick={onOpenMenu}
      >
        <MenuIcon />
      </button>
      <Breadcrumbs />
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
        <WorkflowNotifications />
        {showMessages && (
          <Link
            href="/messages"
            aria-label="Messages"
            aria-current={pathname === "/messages" ? "page" : undefined}
            className={`${iconButtonClass} ${pathname === "/messages" ? "bg-[#e9eef5] text-[#203a78]" : ""}`}
          >
            <MessageSquare size={21} strokeWidth={1.7} aria-hidden="true" />
          </Link>
        )}
        <AccountMenu onSignOut={onSignOut} />
      </div>
    </header>
  )
}
