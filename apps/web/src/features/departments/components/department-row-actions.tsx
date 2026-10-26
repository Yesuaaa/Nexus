import { useRef } from "react"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingAction = useRef<"members" | "delete" | null>(null)

  return (
    <div className="flex items-center gap-2">
      {canManage && (
        <button
          type="button"
          className={cn(
            rowActionButton,
            "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
          )}
          aria-label={`Edit ${department.name}`}
          title="Edit department"
          onClick={() => onEdit(department)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m16 3 5 5M4 16 17 3a2.1 2.1 0 0 1 3 3L7 19l-5 2 2-5Z" />
          </svg>
        </button>
      )}
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
            aria-label={`More actions for ${department.name}`}
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
          aria-label={`Actions for ${department.name}`}
          className={cn(
            dropdownMenuClass,
            "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
          )}
          onCloseAutoFocus={(event) => {
            const action = pendingAction.current
            if (action) {
              // Open after the menu releases its focus trap so the dialog can
              // capture the persistent row trigger as its return target.
              event.preventDefault()
              pendingAction.current = null
              triggerRef.current?.focus()
              if (action === "members") onManageMembers(department.id)
              else onDelete(department.id, department.name)
            }
          }}
        >
          <DropdownMenuItem
            className={cn(dropdownItemClass, "text-xs focus:bg-[#eef1f8]")}
            onSelect={() => {
              pendingAction.current = "members"
            }}
          >
            Members &amp; teams
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              className={cn(
                dropdownItemClass,
                "text-xs text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
              )}
              onSelect={() => {
                pendingAction.current = "delete"
              }}
            >
              Delete department
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
