import {
  ArrowLeftRight,
  Eye,
  FolderPlus,
  Pencil,
  UserMinus,
} from "lucide-react"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"

type WorkloadAction = "view" | "edit" | "assign" | "reassign" | "unassign"

const dangerItem =
  "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1] data-[disabled]:text-[#9aa8bb] data-[disabled]:opacity-60"

export function WorkloadRowActions({
  staffId,
  name,
  canAssign,
  hasAssignments,
  onView,
  onEdit,
  onAssign,
  onReassign,
  onUnassign,
}: {
  staffId: string
  name: string
  canAssign: boolean
  hasAssignments: boolean
  onView: () => void
  onEdit: () => void
  onAssign: () => void
  onReassign: () => void
  onUnassign: () => void
}) {
  const items: RowActionMenuItem<WorkloadAction>[] = [
    {
      action: "view",
      label: <RowActionLabel icon={Eye}>View workload</RowActionLabel>,
    },
    {
      action: "edit",
      label: <RowActionLabel icon={Pencil}>Edit capacity</RowActionLabel>,
    },
    {
      action: "assign",
      label: (
        <RowActionLabel icon={FolderPlus}>Assign to project</RowActionLabel>
      ),
      disabled: !canAssign,
      separatorBefore: true,
    },
    {
      action: "reassign",
      label: <RowActionLabel icon={ArrowLeftRight}>Reassign</RowActionLabel>,
      disabled: !hasAssignments,
    },
    {
      action: "unassign",
      label: <RowActionLabel icon={UserMinus}>Unassign</RowActionLabel>,
      disabled: !hasAssignments,
      className: dangerItem,
    },
  ]

  return (
    <RowActionsMenu
      modal={false}
      triggerId={`workload-actions-${staffId}`}
      triggerLabel={`More actions for ${name}`}
      menuLabel={`Actions for ${name}`}
      items={items}
      onAction={(action) => {
        if (action === "view") onView()
        else if (action === "edit") onEdit()
        else if (action === "assign") onAssign()
        else if (action === "reassign") onReassign()
        else onUnassign()
      }}
    />
  )
}
