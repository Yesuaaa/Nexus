import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

export function DeleteDepartmentDialog({
  name,
  memberCount,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  name: string
  memberCount: number
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const members =
    memberCount === 0
      ? "It has no members."
      : `${memberCount} ${memberCount === 1 ? "member" : "members"} will be unassigned; their accounts are kept.`

  return (
    <ConfirmationDialog
      title="Delete department?"
      subject={name}
      description={`This permanently deletes the department and its teams. ${members} This can't be undone.`}
      confirmLabel="Delete department"
      pendingLabel="Deleting..."
      pending={deleting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
