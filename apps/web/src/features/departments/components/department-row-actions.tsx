import { Eye, Pencil } from "lucide-react"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { RowActionsMenu } from "@/components/ui/row-actions-menu"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"

export function DepartmentRowActions({
  department,
  canManage,
  canDelete,
  onEdit,
  onManageMembers,
  onDelete,
}: {
  department: Department
  canManage: boolean
  canDelete: boolean
  onEdit: (department: Department) => void
  onManageMembers: (id: string) => void
  onDelete: (id: string, name: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={rowActionButton}
        aria-label={`View ${department.name} members and teams`}
        onClick={() => onManageMembers(department.id)}
      >
        <Eye size={15} aria-hidden="true" />
        <HoverTooltip>Members &amp; teams</HoverTooltip>
      </button>
      {canManage && (
        <button
          type="button"
          className={cn(
            rowActionButton,
            "border-[#203f8c] bg-[#203f8c] text-white hover:enabled:bg-[#172f70] hover:enabled:text-white",
          )}
          aria-label={`Edit ${department.name}`}
          onClick={() => onEdit(department)}
        >
          <Pencil size={14} aria-hidden="true" />
          <HoverTooltip>Edit department</HoverTooltip>
        </button>
      )}
      {canDelete && (
        <RowActionsMenu
          triggerLabel={`More actions for ${department.name}`}
          menuLabel={`Actions for ${department.name}`}
          items={[
            {
              action: "delete",
              label: "Delete Department",
              className:
                "text-xs text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
            },
          ]}
          onAction={() => onDelete(department.id, department.name)}
        />
      )}
    </div>
  )
}
