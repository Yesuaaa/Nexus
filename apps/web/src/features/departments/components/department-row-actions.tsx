import type { ReactNode } from "react"
import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react"
import {
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import type { Department } from "../api/departments-api"

type DepartmentAction = "view" | "edit" | "delete"

function MenuLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  )
}

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
      label: <MenuLabel icon={Eye}>View Department</MenuLabel>,
    },
  ]
  if (canManage) {
    items.push({
      action: "edit",
      label: <MenuLabel icon={Pencil}>Edit</MenuLabel>,
    })
  }
  if (canDelete) {
    items.push({
      action: "delete",
      label: <MenuLabel icon={Trash2}>Delete</MenuLabel>,
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
