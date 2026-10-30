import { AlertTriangle, CalendarDays, Clock3, UsersRound } from "lucide-react"
import { KpiCards } from "@/components/ui/kpi-cards"
import type { EmployeeWorkload } from "../api/workload-api"

export function WorkloadKpiCards({
  employees,
}: {
  employees: EmployeeWorkload[]
}) {
  return (
    <KpiCards
      label="Staff capacity overview"
      pending={false}
      unavailable={false}
      showCharts={false}
      className="grid-cols-4 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
      metrics={[
        {
          label: "Employees",
          value: employees.length,
          description: "Within your department",
          icon: UsersRound,
          iconClassName: "text-[#284f9e]",
        },
        {
          label: "Available capacity",
          value:
            Math.round(
              employees.reduce(
                (sum, employee) => sum + employee.remainingHours,
                0,
              ) * 100,
            ) / 100,
          description: "Working hours remaining in this period",
          icon: Clock3,
          iconClassName: "text-[#25745b]",
        },
        {
          label: "Can accept more work",
          value: employees.filter(
            (employee) =>
              employee.remainingHours > 0 && employee.conflicts.length === 0,
          ).length,
          description: "Review the specific time block",
          icon: CalendarDays,
          iconClassName: "text-[#6552a6]",
        },
        {
          label: "Needs attention",
          value: employees.filter(
            (employee) =>
              employee.workload === "OVER_CAPACITY" ||
              employee.status === "UNAVAILABLE" ||
              employee.conflicts.length > 0,
          ).length,
          description: "Over capacity, unavailable or conflicts",
          icon: AlertTriangle,
          iconClassName: "text-[#a45b12]",
        },
      ]}
    />
  )
}
