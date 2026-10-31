"use client"

import { useRef, useState } from "react"
import { LogOut, UserRound } from "lucide-react"
import { iconButtonClass } from "@/components/layout/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
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

const roleNames = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "Client",
}

export function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const account = usePortalAccount()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const fullName = account.fullName?.trim() || "My account"
  const profileFields = [
    ["Full name", account.fullName?.trim() || "Not provided"],
    ["Email", account.email],
    ["Contact number", account.contactNumber || "Not provided"],
    ["Role", roleNames[account.role]],
    ...(account.position ? [["Position", account.position]] : []),
    ...(account.department ? [["Department", account.department.name]] : []),
    ...(account.team ? [["Team", account.team.name]] : []),
  ]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
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
          className={`${dropdownMenuClass} w-72 max-w-[calc(100vw-24px)]`}
          onCloseAutoFocus={(event) => {
            if (profileOpen) event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="px-3 py-2 font-normal">
            <p className="break-words text-sm font-semibold text-foreground">
              {fullName}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {account.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-10 cursor-pointer rounded-md px-3"
            onSelect={() => setProfileOpen(true)}
          >
            <UserRound aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-10 cursor-pointer rounded-md px-3 text-[#f35b61] focus:bg-[#fff0f1] focus:text-[#f35b61]"
            onSelect={onSignOut}
          >
            <LogOut aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-y-auto rounded-xl border-[#d7dfed]"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <DialogTitle className="pr-6 text-[#203a78]">Profile</DialogTitle>
          <DialogDescription>Your account details.</DialogDescription>
          <dl className="divide-y divide-[#e7ecf3]">
            {profileFields.map(([label, value]) => (
              <div key={label} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
