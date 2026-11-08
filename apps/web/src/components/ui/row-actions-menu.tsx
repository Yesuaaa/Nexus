import { useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import { useExclusiveMenu } from "@/components/ui/dropdown"
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
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { cn } from "@/lib/utils"

export type RowActionMenuItem<Action extends string> = {
  action: Action
  label: ReactNode
  disabled?: boolean
  className?: string
}

export function RowActionsMenu<Action extends string>({
  triggerLabel,
  menuLabel = triggerLabel,
  items,
  onAction,
  disabled = false,
  triggerId,
  triggerClassName,
  menuClassName,
  open: controlledOpen,
  onOpenChange,
  modal,
}: {
  triggerLabel: string
  menuLabel?: string
  items: RowActionMenuItem<Action>[]
  onAction: (action: Action) => void
  disabled?: boolean
  triggerId?: string
  triggerClassName?: string
  menuClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingAction = useRef<Action | null>(null)
  const closedByOther = useRef(false)
  const restoreFocus = useRef(false)
  const open = controlledOpen ?? internalOpen

  function changeOpen(next: boolean) {
    if (next) {
      pendingAction.current = null
      closedByOther.current = false
      restoreFocus.current = false
    }
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  useExclusiveMenu(open, () => {
    closedByOther.current = true
    changeOpen(false)
  })

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen} modal={modal}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={cn(rowActionButton, triggerClassName)}
          disabled={disabled}
          aria-label={triggerLabel}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
          <HoverTooltip>More actions</HoverTooltip>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={24}
        aria-label={menuLabel}
        className={cn(
          dropdownMenuClass,
          "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
          menuClassName,
        )}
        onEscapeKeyDown={() => {
          restoreFocus.current = true
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (closedByOther.current) {
            closedByOther.current = false
            restoreFocus.current = false
            return
          }
          const action = pendingAction.current
          if (!action) {
            if (restoreFocus.current) triggerRef.current?.focus()
            restoreFocus.current = false
            return
          }
          pendingAction.current = null
          triggerRef.current?.focus()
          onAction(action)
        }}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.action}
            disabled={item.disabled}
            className={cn(dropdownItemClass, item.className)}
            onSelect={() => {
              pendingAction.current = item.action
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
