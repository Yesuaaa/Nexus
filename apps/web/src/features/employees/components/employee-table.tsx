import type { ReactNode } from "react"
import { focusRing } from "@/components/layout/styles"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { Button } from "@/components/ui/button"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import type {
  Employee,
  EmploymentStatus,
  EmploymentType,
} from "../api/employees-api"
import { EmployeeRowActions } from "./employee-row-actions"

const employeeGrid =
  "grid grid-cols-[minmax(100px,.75fr)_minmax(180px,1.35fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(82px,.7fr)_minmax(90px,.7fr)_minmax(78px,.65fr)_112px] items-center gap-3.5 @max-[1000px]:grid-cols-[minmax(0,1fr)_minmax(105px,.65fr)]"

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

export function EmployeeTable({
  employees,
  viewKey,
  quickKey,
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
  quickKey: string
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
  const initialLoading = loading && employees.length === 0

  return (
    <div
      className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background"
      role="table"
      aria-label="Employees"
      aria-busy={loading}
    >
      <div role="rowgroup" className="@max-[1000px]:sr-only">
        <div
          role="row"
          className={cn(
            employeeGrid,
            "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground",
          )}
        >
          <span role="columnheader">Employee ID</span>
          <span role="columnheader">Employee</span>
          <span role="columnheader">Department</span>
          <span role="columnheader">Position / team</span>
          <span role="columnheader">Type</span>
          <span role="columnheader">Start date</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Actions</span>
        </div>
      </div>

      {initialLoading || error ? (
        <div role="rowgroup">
          <div role="row">
            <div
              role="cell"
              aria-colspan={8}
              className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]"
            >
              {initialLoading ? (
                <span role="status">Loading employees…</span>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      ) : (
        <AnimatedSlotGridBody
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
                title={employee.employeeId}
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  ID{" "}
                </span>
                {employee.employeeId}
              </div>
              <div
                role="cell"
                className="flex min-w-0 items-center gap-2.5 @max-[1000px]:col-span-2 @max-[1000px]:row-start-2"
              >
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
              </div>
              <div
                role="cell"
                className="text-[#52627a] @max-[1000px]:col-start-1 @max-[1000px]:row-start-5"
              >
                <span className="hidden text-[#738096] @max-[1000px]:inline">
                  Type{" "}
                </span>
                {typeNames[employee.employmentType]}
              </div>
              <div
                role="cell"
                className="text-[11px] text-[#738096] @max-[1000px]:col-start-2 @max-[1000px]:row-start-5 @max-[1000px]:justify-self-end"
              >
                <span className="hidden @max-[1000px]:inline">Start date </span>
                {formatDate(employee.startDate)}
              </div>
              <div
                role="cell"
                className="@max-[1000px]:col-start-2 @max-[1000px]:row-start-1 @max-[1000px]:justify-self-end"
              >
                <StatusPill status={employee.status} />
              </div>
              <div
                role="cell"
                className="flex justify-start @max-[1000px]:col-start-2 @max-[1000px]:row-start-4 @max-[1000px]:justify-self-end"
              >
                <EmployeeRowActions
                  employee={employee}
                  disabled={false}
                  onView={() => onView(employee)}
                  onEdit={() => onEdit(employee)}
                  onChangeStatus={() => onChangeStatus(employee)}
                  onManageLogin={() => onManageLogin(employee)}
                />
              </div>
            </>
          )}
        />
      )}
    </div>
  )
}
