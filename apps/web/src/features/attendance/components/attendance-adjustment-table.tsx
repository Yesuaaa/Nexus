import { Pill } from "@/components/ui/pill"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableHeader,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { MemberIdentity } from "@/components/ui/member-identity"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import { Check, Eye, X } from "lucide-react"
import { attendanceDate } from "../model/attendance"
import type { AttendanceAdjustment } from "../api/attendance-api"
import { AttendanceTableEmpty } from "./attendance-shared"

const grid =
  "grid grid-cols-[minmax(150px,1.2fr)_minmax(80px,.6fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(160px,1.3fr)_minmax(90px,.7fr)_56px] items-center gap-3.5 @max-[1000px]:grid-cols-[minmax(0,1fr)_auto]"

const rowClass = `${grid} min-h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] last:border-b-0 @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-[10px] @max-[1000px]:py-[14px]`

type ReviewAction = "approve" | "reject"
type TableAction = ReviewAction | "view"

const adjustmentStatusLabels = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const

const reviewActionItems: RowActionMenuItem<ReviewAction>[] = [
  {
    action: "approve",
    label: <RowActionLabel icon={Check}>Approve request</RowActionLabel>,
  },
  {
    action: "reject",
    label: <RowActionLabel icon={X}>Reject request</RowActionLabel>,
    className: "text-destructive",
  },
]

const viewDetailsAction: RowActionMenuItem<"view"> = {
  action: "view",
  label: <RowActionLabel icon={Eye}>View details</RowActionLabel>,
}

function adjustmentActions(
  item: AttendanceAdjustment,
  canReview: boolean,
  isHR: boolean,
  actorId: string,
): RowActionMenuItem<TableAction>[] {
  const items: RowActionMenuItem<TableAction>[] = []
  items.push(viewDetailsAction)

  if (
    canReview &&
    (item.status === "PENDING" || (isHR && item.status === "VERIFIED")) &&
    item.requestedById !== actorId
  ) {
    items.push(
      ...reviewActionItems
        .filter(
          (entry) =>
            !(
              entry.action === "approve" &&
              item.type === "OVERTIME" &&
              isHR &&
              item.status === "PENDING"
            ),
        )
        .map((entry) =>
          entry.action === "approve" && item.type === "OVERTIME" && !isHR
            ? {
                ...entry,
                label: (
                  <RowActionLabel icon={Check}>Verify overtime</RowActionLabel>
                ),
              }
            : entry,
        ),
    )
  }

  return items
}

export function AttendanceAdjustmentTable({
  items,
  zone,
  canReview,
  actorId,
  isHR = false,
  loading = false,
  error = "",
  onRetry,
  onReview,
  onViewDetails,
}: {
  items: AttendanceAdjustment[]
  zone: string
  canReview: boolean
  actorId: string
  isHR?: boolean
  loading?: boolean
  error?: string
  onRetry?: () => void
  onReview: (
    request: AttendanceAdjustment,
    decision: "APPROVED" | "REJECTED",
  ) => void
  onViewDetails: (request: AttendanceAdjustment) => void
}) {
  return (
    <ResponsiveDataTable label="Attendance requests" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[1000px]:sr-only"
        rowClassName={`${grid} items-center`}
      >
        <ResponsiveDataTableColumnHeader>
          Employee
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Request type
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Start</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>End</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Reason
        </ResponsiveDataTableColumnHeader>
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
            label="attendance requests"
            rows={5}
            rowClassName={rowClass}
            cellClassNames={[
              "@max-[1000px]:col-span-2 @max-[1000px]:col-start-1 @max-[1000px]:row-start-1",
              "@max-[1000px]:col-span-2 @max-[1000px]:row-start-5",
              "@max-[1000px]:col-start-1 @max-[1000px]:row-start-2",
              "@max-[1000px]:col-start-2 @max-[1000px]:row-start-2",
              "@max-[1000px]:col-span-2 @max-[1000px]:col-start-1 @max-[1000px]:row-start-3",
              "@max-[1000px]:col-start-1 @max-[1000px]:row-start-4",
              "@max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end",
            ]}
            cellSkeletonClassNames={[
              "h-8 w-4/5",
              "h-5 w-20 rounded",
              "h-3 w-4/5",
              "h-3 w-4/5",
              "h-3 w-11/12",
              "h-5 w-16 rounded",
              "h-8 w-32",
            ]}
          />
        ) : error ? (
          <DataTableErrorRow
            message={error}
            colSpan={7}
            onRetry={() => onRetry?.()}
          />
        ) : !items.length ? (
          <AttendanceTableEmpty
            colSpan={7}
            message="No requests. Submit an attendance correction or an overtime request to get started."
          />
        ) : (
          items.map((item) => (
            <ResponsiveDataTableRow key={item.id} className={rowClass}>
              <ResponsiveDataTableCell className="min-w-0 @max-[1000px]:col-span-2 @max-[1000px]:col-start-1 @max-[1000px]:row-start-1">
                <MemberIdentity
                  member={item.employee}
                  secondaryText={
                    item.type === "OVERTIME"
                      ? `${item.overtimeMinutes} minutes requested`
                      : item.sessionId
                        ? "Session correction"
                        : "Missing attendance"
                  }
                />
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 @max-[1000px]:col-span-2 @max-[1000px]:row-start-5">
                <Pill tone={item.type === "OVERTIME" ? "warning" : "info"}>
                  {item.type === "OVERTIME" ? "Overtime" : "Correction"}
                </Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 text-[#65718a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-2">
                <span className="mr-1.5 hidden text-[#738096] @max-[1000px]:inline">
                  Start
                </span>
                {attendanceDate(item.proposedStartedAt, zone)}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 text-[#65718a] @max-[1000px]:col-start-2 @max-[1000px]:row-start-2">
                <span className="mr-1.5 hidden text-[#738096] @max-[1000px]:inline">
                  End
                </span>
                {attendanceDate(item.proposedEndedAt, zone)}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 leading-5 break-words @max-[1000px]:col-span-2 @max-[1000px]:col-start-1 @max-[1000px]:row-start-3">
                <span className="mr-1.5 hidden text-[#738096] @max-[1000px]:inline">
                  Reason
                </span>
                <p className="m-0 whitespace-pre-wrap text-[#65718a]">
                  {item.reason}
                </p>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="@max-[1000px]:col-start-1 @max-[1000px]:row-start-4">
                <span className="mr-1.5 hidden text-[#738096] @max-[1000px]:inline">
                  Status
                </span>
                <Pill
                  tone={
                    item.status === "APPROVED"
                      ? "success"
                      : item.status === "REJECTED"
                        ? "danger"
                        : item.status === "VERIFIED"
                          ? "info"
                          : "warning"
                  }
                >
                  {adjustmentStatusLabels[item.status]}
                </Pill>
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="flex min-w-0 flex-wrap gap-2 @max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end">
                {adjustmentActions(item, canReview, isHR, actorId).length >
                  0 && (
                  <RowActionsMenu
                    triggerId={`attendance-adjustment-actions-${item.id}`}
                    triggerLabel={`More actions for ${item.employee.fullName}'s request`}
                    menuLabel={`Actions for ${item.employee.fullName}'s request`}
                    items={adjustmentActions(item, canReview, isHR, actorId)}
                    onAction={(action) => {
                      if (action === "view") onViewDetails(item)
                      else
                        onReview(
                          item,
                          action === "approve" ? "APPROVED" : "REJECTED",
                        )
                    }}
                  />
                )}
                {item.requestedById === actorId &&
                  item.status === "PENDING" && (
                    <span className="text-[11px] text-[#738096]">
                      Awaiting another authorized reviewer.
                    </span>
                  )}
                {item.status === "VERIFIED" && !isHR && (
                  <span className="text-[11px] text-[#738096]">
                    Awaiting HR approval
                  </span>
                )}
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ))
        )}
      </ResponsiveDataTableBody>
    </ResponsiveDataTable>
  )
}
