import {
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Account } from "@/features/auth/model/types"

type AccountRowAction = "status" | "delete" | "password"

export function AccountRowActions({
  account,
  disabled,
  onChangeStatus,
  onDelete,
  onChangePassword,
  canChangeStatus = true,
  trashView = false,
}: {
  account: Account
  disabled: boolean
  onChangeStatus: () => void
  onDelete: () => void
  onChangePassword?: () => void
  canChangeStatus?: boolean
  trashView?: boolean
}) {
  const action = trashView
    ? "Restore"
    : account.isActive
      ? "Deactivate"
      : "Reactivate"

  const items: RowActionMenuItem<AccountRowAction>[] = []
  if (!trashView && onChangePassword)
    items.push({ action: "password", label: "Change password" })
  if (canChangeStatus)
    items.push({
      action: "status",
      label: `${action} account`,
      className: account.isActive
        ? "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]"
        : undefined,
    })
  if (canChangeStatus && (trashView || !account.isActive))
    items.push({
      action: "delete",
      label: trashView ? "Delete Permanently" : "Move to trash",
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
        if (selectedAction === "status") onChangeStatus()
        else if (selectedAction === "password") onChangePassword?.()
        else onDelete()
      }}
    />
  )
}
