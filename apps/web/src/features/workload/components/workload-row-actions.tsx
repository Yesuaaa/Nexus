import { Eye, Pencil } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { RowActionsMenu } from "@/components/ui/row-actions-menu"
import { cn } from "@/lib/utils"

export function WorkloadRowActions({
  name,
  canAssign,
  hasAssignments,
  onView,
  onEdit,
  onAssign,
  onReassign,
  onUnassign,
}: {
  name: string
  canAssign: boolean
  hasAssignments: boolean
  onView: () => void
  onEdit: () => void
  onAssign: () => void
  onReassign: () => void
  onUnassign: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={rowActionButton}
        aria-label={`View ${name}`}
        onClick={onView}
      >
        <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
        <HoverTooltip>View details</HoverTooltip>
      </button>
      <button
        type="button"
        className={cn(
          rowActionButton,
          "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
        )}
        aria-label={`Edit capacity for ${name}`}
        onClick={onEdit}
      >
        <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
        <HoverTooltip>Edit weekly capacity</HoverTooltip>
      </button>
      <RowActionsMenu
        modal={false}
        triggerLabel={`More actions for ${name}`}
        menuLabel={`Actions for ${name}`}
        items={[
          {
            action: "assign",
            label: "Assign to project",
            disabled: !canAssign,
          },
          {
            action: "reassign",
            label: "Reassign",
            disabled: !hasAssignments,
          },
          {
            action: "unassign",
            label: "Unassign",
            disabled: !hasAssignments,
            className: "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]",
          },
        ]}
        onAction={(action) => {
          if (action === "assign") onAssign()
          else if (action === "reassign") onReassign()
          else onUnassign()
        }}
      />
    </div>
  )
}
