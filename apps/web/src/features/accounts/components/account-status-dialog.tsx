import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Account } from "@/features/auth/model/types"

export function AccountStatusDialog({
  account,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  account: Account
  saving: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const action = account.isActive ? "Deactivate" : "Reactivate"

  return (
    <ConfirmationDialog
      title={`${action} account?`}
      subject={account.email}
      description={
        account.isActive
          ? "This account will be signed out and unable to sign in. Its details and department assignments will be kept. You can reactivate it later."
          : "This account will be able to sign in again with its existing password and role."
      }
      confirmLabel={`${action} account`}
      pendingLabel="Saving..."
      pending={saving}
      destructive={account.isActive}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
