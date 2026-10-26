import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Account } from "@/features/auth/model/types"

export function DeleteAccountDialog({
  account,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  account: Account
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmationDialog
      title="Delete account?"
      subject={account.email}
      description="This will permanently delete this inactive account. Its department and team assignments will be removed. This action cannot be undone."
      confirmLabel="Delete account"
      pendingLabel="Deleting..."
      pending={deleting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
