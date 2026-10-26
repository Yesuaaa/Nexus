import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Service } from "../api/services-api"

export function ServiceStatusDialog({
  service,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  service: Service
  saving: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const activating = !service.isActive
  return (
    <ConfirmationDialog
      title={activating ? "Activate service?" : "Deactivate service?"}
      subject={service.name}
      description={
        activating
          ? "This service will become available for new client requests."
          : "This service will no longer be available for new client requests. Existing records will remain unaffected."
      }
      confirmLabel={activating ? "Activate service" : "Deactivate service"}
      pendingLabel={activating ? "Activating..." : "Deactivating..."}
      pending={saving}
      destructive={!activating}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
