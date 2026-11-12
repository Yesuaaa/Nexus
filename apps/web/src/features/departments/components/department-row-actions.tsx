import { Eye, Pencil, Trash2 } from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Department } from "../api/departments-api"

type DepartmentAction = "view" | "edit" | "delete"

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
  const items: RowActionMenuItem<DepartmentAction>[] = [
    {
      action: "view",
      label: <RowActionLabel icon={Eye}>View Department</RowActionLabel>,
    },
  ]
  if (canManage) {
    items.push({
      action: "edit",
      label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
    })
  }
  if (canDelete) {
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
        if (action === "view") onManageMembers(department.id)
        else if (action === "edit") onEdit(department)
        else onDelete(department.id, department.name)
      }}
    />
  )
}
