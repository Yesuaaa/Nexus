import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Account } from "@/features/auth/model/types"

export function DeleteAccountDialog({
  account,
  deleting,
  error,
  permanent,
  onClose,
  onConfirm,
}: {
  account: Account
  deleting: boolean
  error: string
  permanent: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmationDialog
      title={
        permanent ? "Permanently delete account?" : "Move account to Trash?"
      }
      subject={account.email}
      description={
        permanent
          ? "This permanently deletes the account and cannot be undone. Accounts with related historical records must remain in Trash."
          : "This soft deletes the inactive account and removes it from Account Management. You can review it in Trash before permanently deleting it."
      }
      confirmLabel={permanent ? "Delete Permanently" : "Move to Trash"}
      pendingLabel={permanent ? "Deleting..." : "Moving..."}
      pending={deleting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
