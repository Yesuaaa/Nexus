import { Eye, KeyRound, Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Employee } from "../api/employees-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"

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
  const actor = usePortalAccount()
  const canManage = hasPermission(actor, Permissions.EMPLOYEES_MANAGE)
  // This module manages other Staff logins. Admin credentials stay in Account Management.
  const canManageLogin =
    canManage &&
    employee.accountRole === "STAFF" &&
    employee.accountId !== actor.id
  const items: RowActionMenuItem<EmployeeAction>[] = []

  if (!archiveView) {
    items.push({
      action: "view",
      label: <RowActionLabel icon={Eye}>View Employee</RowActionLabel>,
    })
    if (canManage)
      items.push({
        action: "edit",
        label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
      })
    if (canManage && !employee.hasAccount && !employee.accountDeletedAt)
      items.push({
        action: "create",
        label: (
          <RowActionLabel icon={KeyRound}>Create login account</RowActionLabel>
        ),
        separatorBefore: true,
      })
    else if (canManageLogin && employee.hasAccount)
      items.push(
        employee.accountIsActive
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

  if (canManageLogin)
    items.push({
      action: archiveView ? "permanent" : "delete",
      label: (
        <RowActionLabel icon={Trash2}>
          {archiveView ? "Delete permanently" : "Delete account"}
        </RowActionLabel>
      ),
      disabled:
        employee.accountIsActive !== false ||
        (!archiveView && !employee.hasAccount),
      className: dangerItem,
    })

  if (!items.length) return null

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
