import type { ReactNode } from "react"
import { AnimatePresence } from "framer-motion"
import { focusRing } from "@/components/layout/styles"
import { AnimatedTableRow } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
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
  viewKey,
  animateRows,
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
  viewKey: string
  animateRows: boolean
  loading: boolean
  error: string
  emptyMessage: ReactNode
  onRetry: () => void
  onView: (employee: Employee) => void
  onEdit: (employee: Employee) => void
  onChangeStatus: (employee: Employee) => void
  onManageLogin: (employee: Employee) => void
  onManageDepartment?: (departmentId: string) => void
}) {
  if ((loading && employees.length === 0) || error) {
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
    <div
      aria-busy={loading}
      className="@container min-w-0 overflow-visible rounded-lg border border-[#e8ebef] bg-background [&>div]:overflow-visible"
    >
      <Table aria-label="Employees" className="@max-[1000px]:block">
        <TableHeader className="bg-[#e8eef2] @max-[1000px]:hidden">
          <TableRow className="border-[#dfe6eb] hover:bg-transparent">
            <TableHead>Employee ID</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position / team</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Start date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[112px] min-w-[112px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <tbody className="[&_tr:last-child]:border-0 @max-[1000px]:block">
          <AnimatePresence
            custom={animateRows}
            initial={false}
            mode={animateRows ? "popLayout" : "sync"}
          >
            {employees.length === 0 ? (
              <AnimatedTableRow
                key={`empty-${viewKey}`}
                animateRows={animateRows}
                className="text-center text-xs text-[#7183a2]"
              >
                <TableCell colSpan={8} className="min-h-[150px] py-10">
                  {emptyMessage}
                </TableCell>
              </AnimatedTableRow>
            ) : (
              employees.map((employee) => (
                <AnimatedTableRow
                  key={`${viewKey}:${employee.id}`}
                  animateRows={animateRows}
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
                      Department{" "}
                    </span>
                    {employee.department && onManageDepartment ? (
                      <button
                        type="button"
                        className={cn(
                          "max-w-full cursor-pointer rounded-md border-0 bg-transparent p-0 text-left hover:opacity-80",
                          focusRing,
                        )}
                        aria-label={`Manage ${employee.department.name} members and teams`}
                        onClick={() =>
                          onManageDepartment(employee.department!.id)
                        }
                      >
                        <DepartmentPill department={employee.department} />
                      </button>
                    ) : employee.department ? (
                      <DepartmentPill department={employee.department} />
                    ) : (
                      <span className="text-[#94a3b8]">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-0 px-4 py-[7px] text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-4 @max-[1000px]:p-0">
                    <span className="hidden text-[#738096] @max-[1000px]:inline">
                      Position / team{" "}
                    </span>
                    {employee.position || employee.team ? (
                      <>
                        {employee.position && (
                          <p className="m-0 truncate" title={employee.position}>
                            {employee.position}
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
                      </>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
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
                </AnimatedTableRow>
              ))
            )}
          </AnimatePresence>
        </tbody>
      </Table>
    </div>
  )
}
