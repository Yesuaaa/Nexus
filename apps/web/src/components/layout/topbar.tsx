"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, MessageSquare, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { dropdownMenuClass } from "@/components/ui/dropdown-styles"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${iconButtonClass} data-[state=open]:outline-none data-[state=open]:focus-visible:outline-none`}
              aria-label="Open account menu"
            >
              <UserRound size={22} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className={`${dropdownMenuClass} w-40`}
          >
            <DropdownMenuItem
              className="min-h-10 cursor-pointer rounded-md px-3 text-[#f35b61] focus:bg-[#fff0f1] focus:text-[#f35b61]"
              onSelect={onSignOut}
            >
              <LogOut aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
