"use client"

import { MessagesLink } from "@/features/request-conversations/components/messages-link"
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
  return (
    <header
      data-portal-topbar
      className="flex h-[70px] min-w-0 items-center rounded-[13px] border border-[#dedede] bg-background px-4 shadow-[0_2px_4px_rgb(20_30_50_/_11%)] max-[767px]:h-[62px] max-[767px]:gap-[9px] max-[767px]:px-[10px]"
    >
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
        {showMessages && <MessagesLink />}
        <AccountMenu onSignOut={onSignOut} />
      </div>
    </header>
  )
}
