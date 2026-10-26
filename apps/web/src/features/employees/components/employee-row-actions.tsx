import { useRef } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  dropdownItemClass,
  dropdownMenuClass,
} from "@/components/ui/dropdown-styles"
import { rowActionButton } from "@/components/ui/row-action-styles"
import type { Employee } from "../api/employees-api"
import { cn } from "@/lib/utils"

export function EmployeeRowActions({
  employee,
  disabled,
  onView,
  onEdit,
  onChangeStatus,
}: {
  employee: Employee
  disabled: boolean
  onView: () => void
  onEdit: () => void
  onChangeStatus: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const nextAction = useRef<"view" | "edit" | "status" | null>(null)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) nextAction.current = null
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          ref={triggerRef}
          type="button"
          className={rowActionButton}
          disabled={disabled}
          aria-label={`More actions for ${employee.fullName}`}
          title="More actions"
          id={`employee-actions-${employee.id}`}
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
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={24}
        aria-label={`Actions for ${employee.fullName}`}
        className={cn(
          dropdownMenuClass,
          "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
        )}
        onCloseAutoFocus={(event) => {
          const action = nextAction.current
          if (action) {
            event.preventDefault()
            nextAction.current = null
            triggerRef.current?.focus()
            if (action === "view") onView()
            if (action === "edit") onEdit()
            if (action === "status") onChangeStatus()
          }
        }}
      >
        <DropdownMenuItem
          className={cn(dropdownItemClass, "text-xs focus:bg-[#eef1f8]")}
          onSelect={() => {
            nextAction.current = "view"
          }}
        >
          View details
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(dropdownItemClass, "text-xs focus:bg-[#eef1f8]")}
          onSelect={() => {
            nextAction.current = "edit"
          }}
        >
          Edit employee
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(dropdownItemClass, "text-xs focus:bg-[#eef1f8]")}
          onSelect={() => {
            nextAction.current = "status"
          }}
        >
          Change status
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
