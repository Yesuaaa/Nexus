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
import { useExclusiveMenu } from "@/components/ui/dropdown"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import type { Employee } from "../api/employees-api"
import { cn } from "@/lib/utils"

export function EmployeeRowActions({
  employee,
  open,
  onOpenChange,
  archiveView = false,
  disabled,
  onView,
  onEdit,
  onChangeStatus,
  onManageLogin,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
  archiveView?: boolean
  disabled: boolean
  onView: () => void
  onEdit: () => void
  onChangeStatus: () => void
  onManageLogin: (
    action: "create" | "deactivate" | "reactivate" | "delete" | "permanent",
  ) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const nextAction = useRef<
    | "status"
    | "create"
    | "deactivate"
    | "reactivate"
    | "delete"
    | "permanent"
    | null
  >(null)

  // Close this menu whenever any other menu opens.
  useExclusiveMenu(open, () => onOpenChange(false))

  return (
    <div className="flex items-center gap-2">
      {!archiveView && (
        <>
          <button
            type="button"
            className={rowActionButton}
            disabled={disabled}
            aria-label={`View ${employee.fullName}`}
            onClick={onView}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            <HoverTooltip>View details</HoverTooltip>
          </button>
          <button
            type="button"
            className={cn(
              rowActionButton,
              "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
            )}
            disabled={disabled}
            aria-label={`Edit ${employee.fullName}`}
            onClick={onEdit}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m16 3 5 5M4 16 17 3a2.1 2.1 0 0 1 3 3L7 19l-5 2 2-5Z" />
            </svg>
            <HoverTooltip>Edit employee</HoverTooltip>
          </button>
        </>
      )}
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            nextAction.current = null
            restoreFocus.current = false
          }
          onOpenChange(nextOpen)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={rowActionButton}
            disabled={disabled}
            aria-label={`More actions for ${employee.fullName}`}
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
            <HoverTooltip>More actions</HoverTooltip>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          onEscapeKeyDown={() => {
            restoreFocus.current = true
          }}
          align="end"
          sideOffset={6}
          collisionPadding={24}
          aria-label={`Actions for ${employee.fullName}`}
          className={cn(
            dropdownMenuClass,
            "w-48 max-w-[min(280px,calc(100vw-40px))] text-xs text-foreground outline-none",
          )}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const action = nextAction.current
            if (!action && restoreFocus.current) triggerRef.current?.focus()
            if (action) {
              nextAction.current = null
              triggerRef.current?.focus()
              if (action === "status") onChangeStatus()
              else onManageLogin(action)
            }
          }}
        >
          {!archiveView && (
            <>
              <DropdownMenuItem
                disabled={employee.hasEmployeeRecord === false}
                title={
                  employee.hasEmployeeRecord === false
                    ? "Complete employee details first"
                    : undefined
                }
                className={cn(dropdownItemClass, "text-sm focus:bg-[#eef1f8]")}
                onSelect={() => {
                  nextAction.current = "status"
                }}
              >
                Change status
              </DropdownMenuItem>
              {!employee.hasAccount ? (
                <DropdownMenuItem
                  className={dropdownItemClass}
                  onSelect={() => {
                    nextAction.current = "create"
                  }}
                >
                  Create login account
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    className={cn(
                      dropdownItemClass,
                      employee.accountIsActive
                        ? "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]"
                        : "text-[#247044] focus:bg-[#edf8f1] focus:text-[#247044]",
                    )}
                    onSelect={() => {
                      nextAction.current = employee.accountIsActive
                        ? "deactivate"
                        : "reactivate"
                    }}
                  >
                    {employee.accountIsActive
                      ? "Deactivate account"
                      : "Reactivate account"}
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
          <DropdownMenuItem
            disabled={
              employee.accountRole === "ADMIN" ||
              (!archiveView &&
                (!employee.hasAccount || employee.accountIsActive !== false))
            }
            className={cn(
              dropdownItemClass,
              "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945] data-[disabled]:text-[#9aa8bb] data-[disabled]:opacity-60",
            )}
            onSelect={() => {
              nextAction.current = archiveView ? "permanent" : "delete"
            }}
          >
            {archiveView ? "Delete permanently" : "Delete account"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
