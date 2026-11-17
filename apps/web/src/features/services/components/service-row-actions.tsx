import { Eye, Pencil, Power, PowerOff, Trash2 } from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Service } from "../api/services-api"

type ServiceAction = "view" | "edit" | "status" | "delete"

const dangerItem =
  "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]"
const positiveItem =
  "text-[#247044] hover:bg-[#edf8f1] focus:bg-[#edf8f1] focus:text-[#247044] focus-visible:bg-[#edf8f1]"

/** Element id of a service's row-actions trigger, for focus restoration. */
export function serviceActionsTriggerId(serviceId: string) {
  return `service-actions-${serviceId}`
}

export function ServiceRowActions({
  service,
  canManage,
  onView,
  onEdit,
  onStatus,
  onDelete,
}: {
  service: Service
  canManage: boolean
  onView: (service: Service) => void
  onEdit: (service: Service) => void
  onStatus: (service: Service) => void
  onDelete: (service: Service) => void
}) {
  const items: RowActionMenuItem<ServiceAction>[] = [
    {
      action: "view",
      label: <RowActionLabel icon={Eye}>View service</RowActionLabel>,
    },
  ]
  if (canManage) {
    items.push(
      {
        action: "edit",
        label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
      },
      service.isActive
        ? {
            action: "status",
            label: (
              <RowActionLabel icon={PowerOff}>
                Deactivate service
              </RowActionLabel>
            ),
            className: dangerItem,
            separatorBefore: true,
          }
        : {
            action: "status",
            label: (
              <RowActionLabel icon={Power}>Activate service</RowActionLabel>
            ),
            className: positiveItem,
            separatorBefore: true,
          },
    )
    // Only inactive services can be deleted.
    if (!service.isActive) {
      items.push({
        action: "delete",
        label: <RowActionLabel icon={Trash2}>Delete service</RowActionLabel>,
        className: dangerItem,
      })
    }
  }

  return (
    <RowActionsMenu
      triggerId={serviceActionsTriggerId(service.id)}
      triggerLabel={`More actions for ${service.name}`}
      menuLabel={`Actions for ${service.name}`}
      items={items}
      onAction={(action) => {
        if (action === "view") onView(service)
        else if (action === "edit") onEdit(service)
        else if (action === "status") onStatus(service)
        else onDelete(service)
      }}
    />
  )
}
