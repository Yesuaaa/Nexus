"use client"

import Link from "next/link"
import { LogOut, UserRound, Settings } from "lucide-react"
import { iconButtonClass } from "@/components/layout/styles"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { dropdownMenuClass } from "@/components/ui/dropdown-styles"
import { usePortalAccount } from "../providers/account-context"

export function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const account = usePortalAccount()
  return (
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
        className={`${dropdownMenuClass} w-72 max-w-[calc(100vw-24px)] text-xs`}
      >
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <p className="break-words text-xs leading-5 font-semibold text-foreground">
            {account.fullName?.trim() || "My account"}
          </p>
          <p className="mt-0.5 break-all text-[11px] leading-4 text-muted-foreground">
            {account.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="min-h-[38px] cursor-pointer rounded-md px-3 text-xs"
        >
          <Link href="/profile">
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="min-h-[38px] cursor-pointer rounded-md px-3 text-xs"
        >
          <Link href="/settings">
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-[38px] cursor-pointer rounded-md px-3 text-xs text-[#f35b61] focus:bg-[#fff0f1] focus:text-[#f35b61]"
          onSelect={onSignOut}
        >
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
