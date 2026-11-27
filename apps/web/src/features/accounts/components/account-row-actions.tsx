import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import {
  KeyRound,
  Pencil,
  Power,
  PowerOff,
  RotateCcw,
  Trash2,
} from "lucide-react"
import type { Account } from "@/features/auth/model/types"

type AccountRowAction = "edit" | "status" | "delete" | "password"

export function AccountRowActions({
  account,
  disabled,
  onChangeStatus,
  onDelete,
  onChangePassword,
  onEdit,
  canChangeStatus = true,
  trashView = false,
}: {
  account: Account
  disabled: boolean
  onChangeStatus: () => void
  onDelete: () => void
  onChangePassword?: () => void
  onEdit?: () => void
  canChangeStatus?: boolean
  trashView?: boolean
}) {
  const action = trashView
    ? "Restore"
    : account.isActive
      ? "Deactivate"
      : "Reactivate"

  const items: RowActionMenuItem<AccountRowAction>[] = []
  if (!trashView && onEdit)
    items.push({
      action: "edit",
      label: <RowActionLabel icon={Pencil}>Edit account</RowActionLabel>,
    })
  if (!trashView && onChangePassword)
    items.push({
      action: "password",
      label: <RowActionLabel icon={KeyRound}>Change password</RowActionLabel>,
    })
  if (canChangeStatus)
    items.push({
      action: "status",
      label: (
        <RowActionLabel
          icon={trashView ? RotateCcw : account.isActive ? PowerOff : Power}
        >
          {action} account
        </RowActionLabel>
      ),
      separatorBefore: true,
      className: account.isActive
        ? "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]"
        : "text-[#247044] hover:bg-[#edf8f1] focus:bg-[#edf8f1] focus:text-[#247044] focus-visible:bg-[#edf8f1]",
    })
  if (canChangeStatus && (trashView || !account.isActive))
    items.push({
      action: "delete",
      label: (
        <RowActionLabel icon={Trash2}>
          {trashView ? "Delete Permanently" : "Move to trash"}
        </RowActionLabel>
      ),
      className:
        "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
    })

  return (
    <RowActionsMenu
      triggerLabel={`More actions for ${account.email}`}
      menuLabel={`Actions for ${account.email}`}
      items={items}
      disabled={disabled}
      onAction={(selectedAction) => {
        if (selectedAction === "edit") onEdit?.()
        else if (selectedAction === "status") onChangeStatus()
        else if (selectedAction === "password") onChangePassword?.()
        else onDelete()
      }}
    />
  )
}
