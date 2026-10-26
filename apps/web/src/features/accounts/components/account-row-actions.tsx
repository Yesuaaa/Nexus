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
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import type { Account } from "@/features/auth/model/types"
import { cn } from "@/lib/utils"

export function AccountRowActions({
  account,
  disabled,
  onChangeStatus,
  onDelete,
}: {
  account: Account
  disabled: boolean
  onChangeStatus: () => void
  onDelete: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingAction = useRef<"status" | "delete" | null>(null)
  const action = account.isActive ? "Deactivate" : "Reactivate"

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) pendingAction.current = null
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={rowActionButton}
          disabled={disabled}
          aria-label={`More actions for ${account.email}`}
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
          <HoverTooltip>More actions</HoverTooltip>
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
          const selectedAction = pendingAction.current
          if (!selectedAction) return
          event.preventDefault()
          pendingAction.current = null
          triggerRef.current?.focus()
          if (selectedAction === "status") onChangeStatus()
          else onDelete()
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
            pendingAction.current = "status"
          }}
        >
          {action} account
        </DropdownMenuItem>
        {!account.isActive && (
          <DropdownMenuItem
            className={cn(
              dropdownItemClass,
              "text-xs text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
            )}
            onSelect={() => {
              pendingAction.current = "delete"
            }}
          >
            Delete account
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
