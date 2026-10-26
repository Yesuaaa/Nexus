import { useRef } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
import { rowActionButton } from "@/components/ui/row-action-styles"
import type { Account } from "@/features/auth/model/types"
import { cn } from "@/lib/utils"

export function AccountRowActions({
  account,
  disabled,
  onChangeStatus,
}: {
  account: Account
  disabled: boolean
  onChangeStatus: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  const action = account.isActive ? "Deactivate" : "Reactivate"

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) openingDialog.current = false
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={rowActionButton}
          disabled={disabled}
          aria-label={`More actions for ${account.email}`}
          title="More actions"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={24}
        aria-label={`Actions for ${account.email}`}
        className={cn(
          dropdownMenuClass,
          "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
        )}
        onCloseAutoFocus={(event) => {
          if (openingDialog.current) {
            event.preventDefault()
            openingDialog.current = false
            triggerRef.current?.focus()
            onChangeStatus()
          }
        }}
      >
        <DropdownMenuItem
          className={cn(
            dropdownItemClass,
            "text-xs focus:bg-[#eef1f8]",
            account.isActive &&
              "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
          )}
          onSelect={() => {
            openingDialog.current = true
          }}
        >
          {action} account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
