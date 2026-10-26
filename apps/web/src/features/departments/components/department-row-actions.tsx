import { useRef } from "react"
import { focusRing } from "@/components/layout/styles"
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

const actionClass = `grid size-8 flex-none cursor-pointer place-items-center rounded-[7px] border border-[#e1e4ea] bg-background text-[#65718a] transition-colors hover:bg-[#f1f5fc] hover:text-foreground motion-reduce:transition-none ${focusRing}`

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
  const openingSheet = useRef(false)

  return (
    <div className="flex items-center gap-2">
      {canManage && (
        <button
          type="button"
          className={cn(
            actionClass,
            "border-[#203f8c] bg-[#203f8c] text-white hover:bg-[#172f70] hover:text-white",
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
          if (open) openingSheet.current = false
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={actionClass}
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
            if (openingSheet.current) {
              // Open after the menu releases its focus trap so the sheet can
              // capture the persistent row trigger as its return target.
              event.preventDefault()
              openingSheet.current = false
              triggerRef.current?.focus()
              onManageMembers(department.id)
            }
          }}
        >
          <DropdownMenuItem
            className={cn(dropdownItemClass, "text-xs focus:bg-[#eef1f8]")}
            onSelect={() => {
              openingSheet.current = true
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
                onDelete(department.id, department.name)
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
