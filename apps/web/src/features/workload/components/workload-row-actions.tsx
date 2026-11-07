import { useRef, useState } from "react"
import { Eye, Pencil, MoreHorizontal } from "lucide-react"
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
import { useExclusiveMenu } from "@/components/ui/dropdown"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { cn } from "@/lib/utils"

export function WorkloadRowActions({
  name,
  canAssign,
  hasAssignments,
  onView,
  onEdit,
  onAssign,
  onReassign,
  onUnassign,
}: {
  name: string
  canAssign: boolean
  hasAssignments: boolean
  onView: () => void
  onEdit: () => void
  onAssign: () => void
  onReassign: () => void
  onUnassign: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const nextAction = useRef<"assign" | "reassign" | "unassign" | null>(null)
  useExclusiveMenu(open, () => setOpen(false))
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={rowActionButton}
        aria-label={`View ${name}`}
        onClick={onView}
      >
        <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
        <HoverTooltip>View details</HoverTooltip>
      </button>
      <button
        type="button"
        className={cn(
          rowActionButton,
          "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
        )}
        aria-label={`Edit capacity for ${name}`}
        onClick={onEdit}
      >
        <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
        <HoverTooltip>Edit weekly capacity</HoverTooltip>
      </button>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(value) => {
          if (value) {
            nextAction.current = null
            restoreFocus.current = false
          }
          setOpen(value)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={rowActionButton}
            aria-label={`More actions for ${name}`}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            <HoverTooltip>More actions</HoverTooltip>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          collisionPadding={24}
          aria-label={`Actions for ${name}`}
          className={cn(
            dropdownMenuClass,
            "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
          )}
          onEscapeKeyDown={() => {
            restoreFocus.current = true
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const action = nextAction.current
            if (!action && restoreFocus.current) triggerRef.current?.focus()
            if (action) {
              nextAction.current = null
              triggerRef.current?.focus()
              if (action === "assign") onAssign()
              else if (action === "reassign") onReassign()
              else onUnassign()
            }
          }}
        >
          <DropdownMenuItem
            className={dropdownItemClass}
            disabled={!canAssign}
            onSelect={() => {
              nextAction.current = "assign"
            }}
          >
            Assign to project
          </DropdownMenuItem>
          <DropdownMenuItem
            className={dropdownItemClass}
            disabled={!hasAssignments}
            onSelect={() => {
              nextAction.current = "reassign"
            }}
          >
            Reassign
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              dropdownItemClass,
              "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]",
            )}
            disabled={!hasAssignments}
            onSelect={() => {
              nextAction.current = "unassign"
            }}
          >
            Unassign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
