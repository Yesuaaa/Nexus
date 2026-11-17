import { Check, Eye, RotateCcw, X } from "lucide-react"
import { MemberIdentity } from "@/components/ui/member-identity"
import { Pill, type PillTone } from "@/components/ui/pill"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import { AttendanceTableEmpty } from "@/features/attendance/components/attendance-shared"
import type { LeaveAction, LeaveRequest } from "../api/leave-api"

const grid =
  "grid grid-cols-[minmax(170px,1.2fr)_minmax(110px,.8fr)_minmax(180px,1fr)_minmax(90px,.6fr)_minmax(95px,.65fr)_56px] items-center gap-3.5 @max-[900px]:grid-cols-[minmax(0,1fr)_auto]"
const rowClass = `${grid} min-h-[58px] border-b border-[#eceef1] bg-background px-4 py-2 text-xs hover:bg-[#e8eef2] last:border-b-0 @max-[900px]:gap-y-2 @max-[900px]:py-3`

const labels = {
  ANNUAL: "Annual",
  SICK: "Sick",
  EMERGENCY: "Emergency",
  UNPAID: "Unpaid",
  OTHER: "Other",
} as const

const statuses = {
  SUBMITTED: "Submitted",
  VERIFIED: "Awaiting HR",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
} as const

function tone(status: LeaveRequest["status"]): PillTone {
  if (status === "APPROVED") return "success"
  if (status === "REJECTED" || status === "CANCELLED") return "danger"
  if (status === "VERIFIED") return "info"
  if (status === "REVERSED") return "neutral"
  return "warning"
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

type TableAction = LeaveAction | "view"

function actions(item: LeaveRequest): RowActionMenuItem<TableAction>[] {
  const result: RowActionMenuItem<TableAction>[] = [
    {
      action: "view",
      label: <RowActionLabel icon={Eye}>View details</RowActionLabel>,
    },
  ]
  if (item.capabilities.verify)
    result.push({
      action: "verify",
      label: <RowActionLabel icon={Check}>Verify request</RowActionLabel>,
    })
  if (item.capabilities.approve)
    result.push({
      action: "approve",
      label: <RowActionLabel icon={Check}>Approve request</RowActionLabel>,
    })
  if (item.capabilities.reject)
    result.push({
      action: "reject",
      label: <RowActionLabel icon={X}>Reject request</RowActionLabel>,
      className: "text-destructive",
    })
  if (item.capabilities.cancel)
    result.push({
      action: "cancel",
      label: <RowActionLabel icon={X}>Cancel request</RowActionLabel>,
      className: "text-destructive",
      separatorBefore: true,
    })
  if (item.capabilities.reverse)
    result.push({
      action: "reverse",
      label: <RowActionLabel icon={RotateCcw}>Reverse approval</RowActionLabel>,
      className: "text-destructive",
      separatorBefore: true,
    })
  return result
}

export function LeaveRequestTable({
  items,
  loading,
  error,
  onRetry,
  onAction,
}: {
  items: LeaveRequest[]
  loading: boolean
  error: string
  onRetry: () => void
  onAction: (request: LeaveRequest, action: TableAction) => void
}) {
  return (
    <ResponsiveDataTable label="Leave requests" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[900px]:sr-only"
        rowClassName={grid}
      >
        <ResponsiveDataTableColumnHeader>
          Employee
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Type</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Dates</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Hours</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Status
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Actions
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>
      <ResponsiveDataTableBody>
        {loading ? (
          <DataTableSkeletonRows
            label="leave requests"
            rows={5}
            rowClassName={rowClass}
            cellClassNames={Array.from({ length: 6 }, () => "")}
            cellSkeletonClassNames={Array.from(
              { length: 6 },
              () => "h-4 w-4/5",
            )}
          />
        ) : error ? (
          <DataTableErrorRow message={error} colSpan={6} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <AttendanceTableEmpty
            colSpan={6}
            message="No leave requests match this view."
          />
        ) : (
          items.map((item) => (
            <ResponsiveDataTableRow key={item.id} className={rowClass}>
              <ResponsiveDataTableCell className="min-w-0 @max-[900px]:col-span-2">
                <MemberIdentity
                  member={item.employee}
                  secondaryText={
                    item.employee.department?.name ?? "No department"
                  }
                />
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell>
                <Pill tone="brand">{labels[item.type]}</Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="text-[#65718a]">
                <span className="mr-1 hidden text-[#738096] @max-[900px]:inline">
                  Dates
                </span>
                {dateLabel(item.startDate)}
                {item.startDate.slice(0, 10) !== item.endDate.slice(0, 10) &&
                  ` – ${dateLabel(item.endDate)}`}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="text-[#65718a]">
                {item.days.reduce((sum, day) => sum + day.leaveMinutes, 0) / 60}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell>
                <Pill tone={tone(item.status)}>{statuses[item.status]}</Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="justify-self-end">
                <RowActionsMenu
                  triggerId={`leave-actions-${item.id}`}
                  triggerLabel={`More actions for ${item.employee.fullName}'s leave request`}
                  menuLabel={`Leave request actions for ${item.employee.fullName}`}
                  items={actions(item)}
                  onAction={(action) => onAction(item, action)}
                />
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ))
        )}
      </ResponsiveDataTableBody>
    </ResponsiveDataTable>
  )
}
