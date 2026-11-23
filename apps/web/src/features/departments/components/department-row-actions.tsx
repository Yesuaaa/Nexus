import { Eye, FolderKanban, Pencil, Trash2 } from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Department } from "../api/departments-api"

type DepartmentAction =
  "view" | "edit" | "delete" | "view-projects" | "view-details"

export function DepartmentRowActions({
  department,
  variant = "management",
  canManage = false,
  canDelete = false,
  onEdit,
  onManageMembers,
  onDelete,
  onViewProjects,
  onViewDetails,
}: {
  department: Department
  variant?: "management" | "project-management"
  canManage?: boolean
  canDelete?: boolean
  onEdit?: (department: Department) => void
  onManageMembers?: (id: string) => void
  onDelete?: (id: string, name: string) => void
  onViewProjects?: (department: Department) => void
  onViewDetails?: (departmentId: string) => void
}) {
  const items: RowActionMenuItem<DepartmentAction>[] =
    variant === "project-management"
      ? [
          {
            action: "view-projects",
            label: (
              <RowActionLabel icon={FolderKanban}>
                View Workspaces
              </RowActionLabel>
            ),
          },
          {
            action: "view-details",
            label: (
              <RowActionLabel icon={Eye}>
                View Department Details
              </RowActionLabel>
            ),
          },
        ]
      : [
          {
            action: "view",
            label: <RowActionLabel icon={Eye}>View Department</RowActionLabel>,
          },
        ]
  if (variant === "management" && canManage) {
    items.push({
      action: "edit",
      label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
    })
  }
  if (variant === "management" && canDelete) {
    items.push({
      action: "delete",
      label: <RowActionLabel icon={Trash2}>Delete</RowActionLabel>,
      className:
        "text-xs text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
    })
  }

  return (
    <RowActionsMenu
      triggerLabel={`Actions for ${department.name}`}
      menuLabel={`Actions for ${department.name}`}
      items={items}
      onAction={(action) => {
        if (action === "view-projects") onViewProjects?.(department)
        else if (action === "view-details") onViewDetails?.(department.id)
        else if (action === "view") onManageMembers?.(department.id)
        else if (action === "edit") onEdit?.(department)
        else if (action === "delete") onDelete?.(department.id, department.name)
      }}
    />
  )
}
