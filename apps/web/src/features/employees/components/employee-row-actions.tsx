import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
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
  type EmployeeAction =
    "status" | "create" | "deactivate" | "reactivate" | "delete" | "permanent"
  const items: RowActionMenuItem<EmployeeAction>[] = []
  if (!archiveView) {
    items.push({
      action: "status",
      disabled: employee.hasEmployeeRecord === false,
      className: "text-sm focus:bg-[#eef1f8]",
      label: (
        <>
          Change status
          {employee.hasEmployeeRecord === false && (
            <HoverTooltip>Complete employee details first</HoverTooltip>
          )}
        </>
      ),
    })
    items.push(
      !employee.hasAccount
        ? { action: "create", label: "Create login account" }
        : {
            action: employee.accountIsActive ? "deactivate" : "reactivate",
            label: employee.accountIsActive
              ? "Deactivate account"
              : "Reactivate account",
            className: employee.accountIsActive
              ? "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]"
              : "text-[#247044] focus:bg-[#edf8f1] focus:text-[#247044]",
          },
    )
  }
  items.push({
    action: archiveView ? "permanent" : "delete",
    label: archiveView ? "Delete permanently" : "Delete account",
    disabled:
      employee.accountRole === "ADMIN" ||
      (!archiveView &&
        (!employee.hasAccount || employee.accountIsActive !== false)),
    className:
      "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945] data-[disabled]:text-[#9aa8bb] data-[disabled]:opacity-60",
  })

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
      <RowActionsMenu
        modal={false}
        open={open}
        onOpenChange={onOpenChange}
        triggerId={`employee-actions-${employee.id}`}
        triggerLabel={`More actions for ${employee.fullName}`}
        menuLabel={`Actions for ${employee.fullName}`}
        items={items}
        disabled={disabled}
        onAction={(action) => {
          if (action === "status") onChangeStatus()
          else onManageLogin(action)
        }}
      />
    </div>
  )
}
