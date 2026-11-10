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
import { rowActionButton } from "@/components/ui/row-action-styles"
import { cn } from "@/lib/utils"

type AnchorPoint = { x: number; y: number }

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
  const wasOpenOnPointerDown = useRef(false)
  // null = under the button's right edge (keyboard or externally opened).
  const [anchor, setAnchor] = useState<AnchorPoint | null>(null)
  const [align, setAlign] = useState<"start" | "end">("end")
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

  function openAt(point: AnchorPoint | null) {
    setAnchor(point)
    setAlign(point ? "start" : "end")
    changeOpen(true)
  }

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen} modal={modal}>
      <span className="relative inline-flex">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={cn(rowActionButton, triggerClassName)}
          disabled={disabled}
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          data-state={open ? "open" : "closed"}
          onPointerDown={() => {
            // The menu's outside-click handler closes it after this, so a
            // second click on the button acts as a toggle.
            wasOpenOnPointerDown.current = open
          }}
          onClick={(event) => {
            if (wasOpenOnPointerDown.current) {
              wasOpenOnPointerDown.current = false
              return
            }
            if (event.detail === 0) return openAt(null)
            const rect = event.currentTarget.getBoundingClientRect()
            openAt({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            })
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              openAt(null)
            }
          }}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute size-0"
            style={{ left: anchor?.x ?? "100%", top: anchor?.y ?? "100%" }}
          />
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent
        align={align}
        sideOffset={align === "start" ? 4 : 6}
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
            className={cn(dropdownItemClass, "text-xs", item.className)}
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
