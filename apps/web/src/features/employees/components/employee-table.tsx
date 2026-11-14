import { useState, type ReactNode } from "react"
import { Eye } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { Pill } from "@/components/ui/pill"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { cn } from "@/lib/utils"
import type { Employee, EmploymentStatus } from "../api/employees-api"
import {
  employmentStatusLabels,
  employmentStatusTones,
  employmentTypeLabels,
} from "../model/employment"
import { EmployeeRowActions } from "./employee-row-actions"
import { Avatar } from "@/components/ui/avatar"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { MemberIdentity } from "@/components/ui/member-identity"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  ResponsiveDataTableRow,
  ResponsiveDataTableCell,
} from "@/components/ui/responsive-data-table"

type DirectoryEmployee = Pick<Employee, "id" | "employeeId" | "fullName"> & {
  departmentName: string
}

type ManagementTableProps = Parameters<typeof EmployeeManagementTable>[0] & {
  mode?: "management"
}
type DirectoryTableProps = {
  mode: "attendance"
  employees: DirectoryEmployee[]
  loading: boolean
  error: string
  emptyMessage: ReactNode
  onRetry: () => void
  onView: (employee: DirectoryEmployee) => void
}

export function EmployeeTable(
  props: ManagementTableProps | DirectoryTableProps,
) {
  if (props.mode !== "attendance") return <EmployeeManagementTable {...props} />
  const grid =
    "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_56px] items-center gap-3.5 max-[560px]:grid-cols-[minmax(0,1fr)_44px]"
  return (
    <ResponsiveDataTable label="Employees" aria-busy={props.loading}>
      <ResponsiveDataTableHeader
        rowClassName={grid}
        className="max-[560px]:sr-only"
      >
        {["Employee ID", "Employee", "Department", "Actions"].map((label) => (
          <ResponsiveDataTableColumnHeader key={label}>
            {label}
          </ResponsiveDataTableColumnHeader>
        ))}
      </ResponsiveDataTableHeader>
      <ResponsiveDataTableBody>
        {props.loading ? (
          <DataTableSkeletonRows
            label="employees"
            rowClassName={`${grid} min-h-[58px] px-4 py-3`}
            cellClassNames={["", "", "", ""]}
          />
        ) : props.error ? (
          <DataTableErrorRow
            message={props.error}
            onRetry={props.onRetry}
            colSpan={4}
          />
        ) : props.employees.length ? (
          props.employees.map((employee) => (
            <ResponsiveDataTableRow
              key={employee.id}
              className={`${grid} min-h-[58px] border-b border-[#eceef1] px-4 py-3 text-xs last:border-b-0 hover:bg-[#e8eef2]`}
            >
              <ResponsiveDataTableCell className="min-w-0 break-all max-[560px]:col-start-1">
                {employee.employeeId}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 max-[560px]:col-start-1 max-[560px]:row-start-2">
                <MemberIdentity member={employee} secondaryText={null} />
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="min-w-0 break-words max-[560px]:col-start-1 max-[560px]:row-start-3">
                {employee.departmentName}
              </ResponsiveDataTableCell>
              <ResponsiveDataTableCell className="max-[560px]:col-start-2 max-[560px]:row-span-3 max-[560px]:row-start-1">
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className={cn(rowActionButton, "max-[560px]:size-11")}
                    aria-label={`View logs for ${employee.fullName}`}
                    onClick={() => props.onView(employee)}
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  <HoverTooltip>View logs</HoverTooltip>
                </span>
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ))
        ) : (
          <ResponsiveDataTableRow>
            <ResponsiveDataTableCell
              aria-colspan={4}
              className="p-6 text-center text-xs text-muted-foreground"
            >
              {props.emptyMessage}
            </ResponsiveDataTableCell>
          </ResponsiveDataTableRow>
        )}
      </ResponsiveDataTableBody>
    </ResponsiveDataTable>
  )
}

const employeeGrid =
  "grid grid-cols-[minmax(100px,.75fr)_minmax(180px,1.35fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(82px,.7fr)_minmax(90px,.7fr)_minmax(78px,.65fr)_56px] items-center gap-3.5 @max-[1000px]:grid-cols-[minmax(0,1fr)_minmax(105px,.65fr)]"

function StatusPill({ status }: { status: EmploymentStatus }) {
  return (
    <Pill tone={employmentStatusTones[status]}>
      {employmentStatusLabels[status]}
    </Pill>
  )
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { timeZone: "UTC" })
}

function employeeKey(employee: Employee) {
  return employee.id
}

function employeeRowClass(
  _employee: Employee,
  _index: number,
  isLast: boolean,
) {
  return cn(
    employeeGrid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[1000px]:h-[188px] @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-2 @max-[1000px]:py-[14px] @max-[1000px]:hover:bg-[#e8eef2]",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

function EmployeeManagementTable({
  employees,
  archiveView = false,
  viewKey,
  quickKey,
  animateRows,
  loading,
  error,
  emptyMessage,
  onRetry,
  onView,
  onEdit,
  onManageLogin,
  onManageDepartment,
  onRowsSettled,
}: {
  employees: Employee[]
  archiveView?: boolean
  viewKey: string
  quickKey: string
  animateRows: boolean
  loading: boolean
  error: string
  emptyMessage: ReactNode
  onRetry: () => void
  onView: (employee: Employee) => void
  onEdit: (employee: Employee) => void
  onManageLogin: (
    employee: Employee,
    action: "create" | "deactivate" | "reactivate" | "delete" | "permanent",
  ) => void
  onManageDepartment?: (departmentId: string) => void
  onRowsSettled?: () => void
}) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const initialLoading = loading && viewKey === ""

  return (
    <ResponsiveDataTable label="Employees" aria-busy={loading}>
      <ResponsiveDataTableHeader
        className="@max-[1000px]:sr-only"
        rowClassName={employeeGrid}
      >
        <ResponsiveDataTableColumnHeader>
          Employee ID
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Employee
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Department
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Position / Team
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>Type</ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          {archiveView ? "Date Archived" : "Start Date"}
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Status
        </ResponsiveDataTableColumnHeader>
        <ResponsiveDataTableColumnHeader>
          Actions
        </ResponsiveDataTableColumnHeader>
      </ResponsiveDataTableHeader>

      {initialLoading || error ? (
        <ResponsiveDataTableBody>
          {initialLoading ? (
            <DataTableSkeletonRows
              label="employees"
              rowClassName={cn(
                employeeGrid,
                "h-[58px] px-4 py-[7px] @max-[1000px]:h-[188px] @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-2 @max-[1000px]:py-[14px]",
              )}
              cellClassNames={[
                "@max-[1000px]:col-start-1 @max-[1000px]:row-start-1",
                "@max-[1000px]:col-span-2 @max-[1000px]:row-start-2",
                "@max-[1000px]:col-span-2 @max-[1000px]:row-start-3",
                "@max-[1000px]:col-start-1 @max-[1000px]:row-start-4",
                "@max-[1000px]:col-start-1 @max-[1000px]:row-start-5",
                "@max-[1000px]:col-start-2 @max-[1000px]:row-start-5 @max-[1000px]:justify-self-end",
                "@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end",
                "@max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end",
              ]}
              cellSkeletonClassNames={[
                "h-3 w-16",
                "h-8 w-4/5",
                "h-3 w-3/5",
                "h-3 w-4/5",
                "h-3 w-16",
                "h-3 w-20",
                "h-5 w-16 rounded",
                "size-8 rounded-[7px]",
              ]}
            />
          ) : (
            <DataTableErrorRow message={error} onRetry={onRetry} colSpan={8} />
          )}
        </ResponsiveDataTableBody>
      ) : (
        <AnimatedSlotGridBody
          onRowsSettled={onRowsSettled}
          items={employees}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows={animateRows}
          getKey={employeeKey}
          rowClassName={employeeRowClass}
          emptyContent={emptyMessage}
          ariaBusy={loading}
          className="relative min-w-0 overflow-x-clip"
          renderRow={(employee) => (
            <>
              <div
                role="cell"
                className="min-w-0 truncate font-medium text-[#34445e] @max-[1000px]:col-start-1 @max-[1000px]:row-start-1"
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  ID{" "}
                </span>
                {employee.employeeId || "Not set"}
              </div>
              <div
                role="cell"
                className="flex min-w-0 items-center gap-2.5 @max-[1000px]:col-span-2 @max-[1000px]:row-start-2"
              >
                <Avatar
                  name={employee.fullName}
                  imageUrl={employee.imageUrl}
                  className="size-8"
                />
                <div className="min-w-0">
                  <p className="m-0 truncate font-semibold">
                    {employee.fullName}
                  </p>
                  <p className="mt-0.5 mb-0 truncate text-[11px] text-[#738096]">
                    {employee.email || "No email"}
                  </p>
                </div>
              </div>
              <div
                role="cell"
                className="min-w-0 @max-[1000px]:col-span-2 @max-[1000px]:row-start-3"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[1000px]:inline">
                  Department
                </span>
                {employee.department && onManageDepartment ? (
                  <button
                    type="button"
                    className={cn(
                      "max-w-full cursor-pointer rounded-md border-0 bg-transparent p-0 text-left hover:opacity-80",
                      focusRing,
                    )}
                    aria-label={`Manage ${employee.department.name} members and teams`}
                    onClick={() => onManageDepartment(employee.department!.id)}
                  >
                    <DepartmentPill department={employee.department} />
                  </button>
                ) : employee.department ? (
                  <DepartmentPill department={employee.department} />
                ) : (
                  <span className="text-[#94a3b8]">Unassigned</span>
                )}
              </div>
              <div
                role="cell"
                className="min-w-0 text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-4"
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Position / team{" "}
                </span>
                {employee.position || employee.team ? (
                  <>
                    {employee.position && (
                      <p className="m-0 truncate">{employee.position}</p>
                    )}
                    {employee.team && (
                      <p className="mt-0.5 mb-0 truncate text-[11px] text-[#738096]">
                        {employee.team.name}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-[#94a3b8]">—</span>
                )}
              </div>
              <div
                role="cell"
                className="text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-5"
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Type{" "}
                </span>
                {employee.employmentType
                  ? employmentTypeLabels[employee.employmentType]
                  : "Not Set"}
              </div>
              <div
                role="cell"
                className="text-[11px] text-[#738096] @max-[1000px]:col-start-2 @max-[1000px]:row-start-5 @max-[1000px]:justify-self-end"
              >
                <span className="hidden @max-[1000px]:inline">
                  {archiveView ? "Archived " : "Start date "}
                </span>
                {formatDate(
                  archiveView
                    ? (employee.accountDeletedAt ?? null)
                    : employee.startDate,
                )}
              </div>
              <div
                role="cell"
                className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end"
              >
                {archiveView ? (
                  <Pill tone="neutral">Archived</Pill>
                ) : employee.status ? (
                  <StatusPill status={employee.status} />
                ) : (
                  <span className="text-[#738096]">Not Set</span>
                )}
              </div>
              <div
                role="cell"
                className="flex justify-start @max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end"
              >
                <EmployeeRowActions
                  open={
                    openMenuKey === `${viewKey}:${archiveView}:${employee.id}`
                  }
                  onOpenChange={(open) => {
                    const key = `${viewKey}:${archiveView}:${employee.id}`
                    setOpenMenuKey((current) =>
                      open ? key : current === key ? null : current,
                    )
                  }}
                  archiveView={archiveView}
                  employee={employee}
                  disabled={false}
                  onView={() => onView(employee)}
                  onEdit={() => onEdit(employee)}
                  onManageLogin={(action) => onManageLogin(employee, action)}
                />
              </div>
            </>
          )}
        />
      )}
    </ResponsiveDataTable>
  )
}
