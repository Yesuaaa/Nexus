import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Service } from "../api/services-api"

export function DeleteServiceDialog({
  service,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  service: Service
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmationDialog
      title="Delete service?"
      subject={service.name}
      description="This will permanently delete this inactive service and remove its department associations. This action cannot be undone."
      confirmLabel="Delete service"
      pendingLabel="Deleting..."
      pending={deleting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
