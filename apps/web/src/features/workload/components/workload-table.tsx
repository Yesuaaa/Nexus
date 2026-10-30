import { focusRing } from "@/components/layout/styles"
import { DepartmentPill } from "@/components/ui/department-pill"
import { cn } from "@/lib/utils"
import type { EmployeeWorkload } from "../api/workload-api"
import { labelText, Status, Utilization } from "./workload-ui"

const cellClass =
  "px-2 py-3 align-middle break-words @max-[1000px]:min-w-0 @max-[1000px]:px-0 @max-[1000px]:py-0"
const mobileLabelClass =
  "mb-1 hidden text-[11px] text-[#738096] @max-[1000px]:block"

export function WorkloadTable({
  employees,
  hasEmployees,
  onView,
}: {
  employees: EmployeeWorkload[]
  hasEmployees: boolean
  onView: (id: string) => void
}) {
  return (
    <div className="@container min-w-0 overflow-hidden rounded-lg border border-[#e8ebef] bg-background">
      <table
        aria-label="Staff workload"
        className="w-full table-fixed text-left text-xs @max-[1000px]:block"
      >
        <colgroup>
          {[16, 10, 9, 8, 10, 11, 10, 16, 10].map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead className="border-b border-[#dfe6eb] bg-[#e8eef2] text-foreground @max-[1000px]:sr-only">
          <tr>
            {[
              "Employee",
              "Department",
              "Position",
              "Type",
              "Skills / specializations",
              "Availability",
              "Assignments",
              "Workload",
              "Status",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="h-[39px] px-2 py-2 font-semibold"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eceef1] @max-[1000px]:block">
          {employees.map((employee) => (
            <tr
              key={employee.id}
              className="text-[#52627a] hover:bg-[#e8eef2] @max-[1000px]:grid @max-[1000px]:grid-cols-2 @max-[1000px]:gap-x-4 @max-[1000px]:gap-y-3 @max-[1000px]:p-4"
            >
              <td className={cn(cellClass, "@max-[1000px]:col-span-2")}>
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] text-xs font-medium text-[#65718a]"
                  >
                    {employee.fullName[0]?.toUpperCase() || "E"}
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer rounded text-left font-semibold text-foreground underline-offset-4 hover:underline",
                        focusRing,
                      )}
                      onClick={() => onView(employee.id)}
                    >
                      {employee.fullName}
                    </button>
                    <p className="mt-0.5 text-[11px] text-[#738096]">
                      {employee.employeeId}
                    </p>
                  </div>
                </div>
              </td>
              <td className={cellClass}>
                <span className={mobileLabelClass}>Department</span>
                {employee.department ? (
                  <DepartmentPill department={employee.department} />
                ) : (
                  "Unassigned"
                )}
              </td>
              <td className={cellClass}>
                <span className={mobileLabelClass}>Position</span>
                {employee.position || "—"}
              </td>
              <td className={cellClass}>
                <span className={mobileLabelClass}>Employment type</span>
                {labelText(employee.employmentType)}
              </td>
              <td
                className={cn(
                  cellClass,
                  "max-w-44 break-words @max-[1000px]:max-w-none",
                )}
              >
                <span className={mobileLabelClass}>
                  Skills / specializations
                </span>
                {employee.skills.join(", ") || "Not recorded"}
              </td>
              <td className={cellClass}>
                <span className={mobileLabelClass}>Availability</span>
                <p className="font-medium text-foreground">
                  {employee.remainingHours}h remaining
                </p>
                <p className="mt-1 text-[11px] text-[#738096]">
                  {employee.scheduleConfigured
                    ? `${employee.blockedHours}h blocked`
                    : "Schedule required"}
                </p>
              </td>
              <td className={cellClass}>
                <span className={mobileLabelClass}>Assignments</span>
                <p>{employee.activeAssignments} active</p>
                <p className="mt-1 text-[11px] text-[#738096]">
                  {employee.pendingAssignments} pending /{" "}
                  {employee.upcomingAssignments} upcoming
                </p>
              </td>
              <td
                className={cn(
                  cellClass,
                  "space-y-1.5 @max-[1000px]:col-span-2",
                )}
              >
                <span className={mobileLabelClass}>Workload</span>
                <Utilization metrics={employee} />
                <p className="text-[11px] text-[#738096]">
                  {labelText(employee.workload)}
                </p>
              </td>
              <td className={cn(cellClass, "@max-[1000px]:col-span-2")}>
                <span className={mobileLabelClass}>Status</span>
                <Status value={employee.status} />
                {employee.conflicts.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-[#b4234d]">
                    {employee.conflicts.length} assignment conflict
                    {employee.conflicts.length === 1 ? "" : "s"}
                  </p>
                )}
              </td>
            </tr>
          ))}
          {!employees.length && (
            <tr className="@max-[1000px]:block">
              <td
                colSpan={9}
                className="p-10 text-center text-xs text-[#7183a2] @max-[1000px]:block"
              >
                {hasEmployees
                  ? "No employees match these filters."
                  : "No employees are assigned to your department."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
