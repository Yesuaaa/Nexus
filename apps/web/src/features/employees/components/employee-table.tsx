import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pill } from "@/components/ui/pill"
import type {
  Employee,
  EmploymentStatus,
  EmploymentType,
} from "../api/employees-api"
import { EmployeeRowActions } from "./employee-row-actions"

const typeNames: Record<EmploymentType, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
}
const statusNames: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
}

function StatusPill({ status }: { status: EmploymentStatus }) {
  const style =
    status === "ACTIVE"
      ? "bg-[#dcf5e5] text-[#19703a]"
      : status === "ON_LEAVE"
        ? "bg-[#fff3df] text-[#805316]"
        : "bg-[#fde4ea] text-[#b4234d]"
  return <Pill className={style}>{statusNames[status]}</Pill>
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { timeZone: "UTC" })
}

export function EmployeeTable({
  employees,
  loading,
  error,
  emptyMessage,
  onRetry,
  onView,
  onEdit,
  onChangeStatus,
  onManageLogin,
  onManageDepartment,
}: {
  employees: Employee[]
  loading: boolean
  error: string
  emptyMessage: string
  onRetry: () => void
  onView: (employee: Employee) => void
  onEdit: (employee: Employee) => void
  onChangeStatus: (employee: Employee) => void
  onManageLogin: (employee: Employee) => void
  onManageDepartment?: (departmentId: string) => void
}) {
  if (loading || error || employees.length === 0) {
    return (
      <div className="grid min-h-[150px] place-content-center gap-3 rounded-lg border border-[#e8ebef] bg-background p-6 text-center text-xs text-[#7183a2]">
        {loading ? (
          <span role="status">Loading employees…</span>
        ) : error ? (
          <div role="alert" className="grid justify-items-center gap-3">
            <p className="m-0">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>
        ) : (
          emptyMessage
        )}
      </div>
    )
  }

  return (
    <div className="@container min-w-0 overflow-visible rounded-lg border border-[#e8ebef] bg-background [&>div]:overflow-visible">
      <Table aria-label="Employees" className="@max-[1000px]:block">
        <TableHeader className="bg-[#e8eef2] @max-[1000px]:hidden">
          <TableRow className="border-[#dfe6eb] hover:bg-transparent">
            <TableHead>Employee ID</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Department / team</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Start date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[112px] min-w-[112px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="@max-[1000px]:block">
          {employees.map((employee) => (
            <TableRow
              key={employee.id}
              className="text-xs hover:bg-[#e8eef2] @max-[1000px]:grid @max-[1000px]:grid-cols-[minmax(0,1fr)_minmax(105px,.65fr)] @max-[1000px]:gap-x-3 @max-[1000px]:gap-y-2 @max-[1000px]:px-4 @max-[1000px]:py-3 @max-[1000px]:hover:bg-transparent"
            >
              <TableCell
                className="min-w-0 truncate px-4 py-[7px] font-medium text-[#34445e] @max-[1000px]:p-0"
                title={employee.employeeId}
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  ID{" "}
                </span>
                {employee.employeeId}
              </TableCell>
              <TableCell className="flex min-w-0 items-center gap-2.5 px-4 py-[7px] @max-[1000px]:col-span-2 @max-[1000px]:row-start-2 @max-[1000px]:p-0">
                <span
                  className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] text-xs font-medium text-[#65718a]"
                  aria-hidden="true"
                >
                  {employee.fullName[0]?.toUpperCase() || "E"}
                </span>
                <div className="min-w-0">
                  <p
                    className="m-0 truncate font-semibold"
                    title={employee.fullName}
                  >
                    {employee.fullName}
                  </p>
                  <p
                    className="mt-0.5 mb-0 truncate text-[11px] text-[#738096]"
                    title={employee.email ?? undefined}
                  >
                    {employee.email || "No email"}
                  </p>
                </div>
              </TableCell>
              <TableCell className="min-w-0 px-4 py-[7px] @max-[1000px]:col-span-2 @max-[1000px]:row-start-3 @max-[1000px]:p-0">
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Department / team{" "}
                </span>
                {employee.department && onManageDepartment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto max-w-full justify-start truncate border-0 bg-transparent p-0 text-xs font-normal text-foreground shadow-none hover:bg-transparent hover:underline"
                    aria-label={`Manage ${employee.department.name} members and teams`}
                    onClick={() => onManageDepartment(employee.department!.id)}
                  >
                    {employee.department.name}
                  </Button>
                ) : (
                  <p className="m-0 truncate" title={employee.department?.name}>
                    {employee.department?.name || (
                      <span className="text-[#94a3b8]">Unassigned</span>
                    )}
                  </p>
                )}
                {employee.team && (
                  <p
                    className="mt-0.5 mb-0 truncate text-[11px] text-[#738096]"
                    title={employee.team.name}
                  >
                    {employee.team.name}
                  </p>
                )}
              </TableCell>
              <TableCell
                className="min-w-0 truncate px-4 py-[7px] text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-4 @max-[1000px]:p-0"
                title={employee.position ?? undefined}
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Position{" "}
                </span>
                {employee.position || <span className="text-[#94a3b8]">—</span>}
              </TableCell>
              <TableCell className="px-4 py-[7px] text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-5 @max-[1000px]:p-0">
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Type{" "}
                </span>
                {typeNames[employee.employmentType]}
              </TableCell>
              <TableCell className="px-4 py-[7px] text-[11px] text-[#738096] @max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:p-0">
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Start date{" "}
                </span>
                {formatDate(employee.startDate)}
              </TableCell>
              <TableCell className="px-4 py-[7px] @max-[1000px]:col-start-2 @max-[1000px]:row-start-2 @max-[1000px]:p-0">
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Status{" "}
                </span>
                <StatusPill status={employee.status} />
              </TableCell>
              <TableCell className="flex justify-start px-4 py-[7px] @max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:row-span-2 @max-[1000px]:items-start @max-[1000px]:justify-end @max-[1000px]:p-0">
                <EmployeeRowActions
                  employee={employee}
                  disabled={false}
                  onView={() => onView(employee)}
                  onEdit={() => onEdit(employee)}
                  onChangeStatus={() => onChangeStatus(employee)}
                  onManageLogin={() => onManageLogin(employee)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
