import { Eye, KeyRound, Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Employee } from "../api/employees-api"

type LoginAction =
  "create" | "deactivate" | "reactivate" | "delete" | "permanent"
type EmployeeAction = "view" | "edit" | LoginAction

const dangerItem =
  "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1] data-[disabled]:text-[#9aa8bb] data-[disabled]:opacity-60"
const positiveItem =
  "text-[#247044] hover:bg-[#edf8f1] focus:bg-[#edf8f1] focus:text-[#247044] focus-visible:bg-[#edf8f1]"

export function EmployeeRowActions({
  employee,
  open,
  onOpenChange,
  archiveView = false,
  disabled,
  onView,
  onEdit,
  onManageLogin,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
  archiveView?: boolean
  disabled: boolean
  onView: () => void
  onEdit: () => void
  onManageLogin: (action: LoginAction) => void
}) {
  const items: RowActionMenuItem<EmployeeAction>[] = []

  if (!archiveView) {
    items.push(
      {
        action: "view",
        label: <RowActionLabel icon={Eye}>View Employee</RowActionLabel>,
      },
      {
        action: "edit",
        label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
      },
      !employee.hasAccount
        ? {
            action: "create",
            label: (
              <RowActionLabel icon={KeyRound}>
                Create login account
              </RowActionLabel>
            ),
            separatorBefore: true,
          }
        : employee.accountIsActive
          ? {
              action: "deactivate",
              label: (
                <RowActionLabel icon={UserX}>Deactivate account</RowActionLabel>
              ),
              className: dangerItem,
              separatorBefore: true,
            }
          : {
              action: "reactivate",
              label: (
                <RowActionLabel icon={UserCheck}>
                  Reactivate account
                </RowActionLabel>
              ),
              className: positiveItem,
              separatorBefore: true,
            },
    )
  }

  items.push({
    action: archiveView ? "permanent" : "delete",
    label: (
      <RowActionLabel icon={Trash2}>
        {archiveView ? "Delete permanently" : "Delete account"}
      </RowActionLabel>
    ),
    disabled:
      employee.accountRole === "ADMIN" ||
      (!archiveView &&
        (!employee.hasAccount || employee.accountIsActive !== false)),
    className: dangerItem,
  })

  return (
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
        if (action === "view") onView()
        else if (action === "edit") onEdit()
        else onManageLogin(action)
      }}
    />
  )
}
