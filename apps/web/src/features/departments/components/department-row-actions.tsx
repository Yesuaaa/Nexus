import { useRef, useState } from "react"
import { Eye, MoreHorizontal, Pencil } from "lucide-react"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
import { useExclusiveMenu } from "@/components/ui/dropdown"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Department } from "../api/departments-api"

export function DepartmentRowActions({
  department,
  canManage,
  canDelete,
  onEdit,
  onManageMembers,
  onDelete,
}: {
  department: Department
  canManage: boolean
  canDelete: boolean
  onEdit: (department: Department) => void
  onManageMembers: (id: string) => void
  onDelete: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const deletePending = useRef(false)
  const closedByOther = useRef(false)

  // Close this menu whenever any other menu opens.
  useExclusiveMenu(open, () => {
    closedByOther.current = true
    setOpen(false)
  })

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={rowActionButton}
        aria-label={`View ${department.name} members and teams`}
        onClick={() => onManageMembers(department.id)}
      >
        <Eye size={15} aria-hidden="true" />
        <HoverTooltip>Members &amp; teams</HoverTooltip>
      </button>
      {canManage && (
        <button
          type="button"
          className={cn(
            rowActionButton,
            "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
          )}
          aria-label={`Edit ${department.name}`}
          onClick={() => onEdit(department)}
        >
          <Pencil size={14} aria-hidden="true" />
          <HoverTooltip>Edit department</HoverTooltip>
        </button>
      )}
      {canDelete && (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            if (next) {
              deletePending.current = false
              closedByOther.current = false
            }
            setOpen(next)
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className={rowActionButton}
              aria-label={`More actions for ${department.name}`}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
              <HoverTooltip>More actions</HoverTooltip>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            collisionPadding={24}
            aria-label={`Actions for ${department.name}`}
            className={cn(
              dropdownMenuClass,
              "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
            )}
            onCloseAutoFocus={(event) => {
              // Another menu took over: don't pull focus back to this trigger.
              if (closedByOther.current) {
                closedByOther.current = false
                event.preventDefault()
                return
              }
              if (!deletePending.current) return
              event.preventDefault()
              deletePending.current = false
              triggerRef.current?.focus()
              onDelete(department.id, department.name)
            }}
          >
            <DropdownMenuItem
              className={cn(
                dropdownItemClass,
                "text-xs text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
              )}
              onSelect={() => {
                deletePending.current = true
              }}
            >
              Delete Department
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
