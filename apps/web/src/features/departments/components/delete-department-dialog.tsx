import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

export function DeleteDepartmentDialog({
  name,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  name: string
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmationDialog
      title="Delete department?"
      subject={name}
      description="This will permanently delete the department and its teams. Members will be unassigned, and their accounts will be kept. This action cannot be undone."
      confirmLabel="Delete department"
      pendingLabel="Deleting..."
      pending={deleting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
