import { Building2, Network, UserRoundX, UsersRound } from "lucide-react"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import type { Department } from "../api/departments-api"

export function DepartmentKpiCards({
  departments,
  loading,
  unavailable,
}: {
  departments: Department[]
  loading: boolean
  unavailable: boolean
}) {
  const employeeCount = departments.reduce(
    (total, department) => total + department.memberCount,
    0,
  )
  const teamCount = departments.reduce(
    (total, department) => total + (department.teamCount ?? 0),
    0,
  )
  const assignedHeadCount = departments.filter(
    (department) => department.head,
  ).length
  const unassignedHeadCount = departments.length - assignedHeadCount
  const departmentsByName = [...departments].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const departmentsByCreation = [...departments].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
  const metrics: KpiMetric[] = [
    {
      label: "Departments",
      value: departments.length,
      description: "Organizational units",
      icon: Building2,
      iconClassName: "text-[#284f9e]",
      chartValues: departmentsByCreation.map((_, index) => index + 1),
      chartLabel: "Cumulative departments by creation date",
      chartColor: "#4169bd",
    },
    {
      label: "Assigned Employees",
      value: employeeCount,
      description: "Across all departments",
      icon: UsersRound,
      iconClassName: "text-[#25745b]",
      chartValues: departmentsByName.map(
        (department) => department.memberCount,
      ),
      chartLabel: "Employee distribution across departments",
      chartColor: "#29906b",
    },
    {
      label: "Teams",
      value: teamCount,
      description: "Created within departments",
      icon: Network,
      iconClassName: "text-[#6552a6]",
      chartValues: departmentsByName.map(
        (department) => department.teamCount ?? 0,
      ),
      chartLabel: "Team distribution across departments",
      chartColor: "#7159bd",
    },
    {
      label: "Heads Unassigned",
      value: unassignedHeadCount,
      description:
        departments.length === 0
          ? "No departments created"
          : `${assignedHeadCount} of ${departments.length} departments covered`,
      icon: UserRoundX,
      iconClassName:
        unassignedHeadCount > 0 ? "text-[#a45b12]" : "text-[#25745b]",
      chartValues: departmentsByName.map((department) =>
        department.head ? 0 : 1,
      ),
      chartLabel: "Unassigned head status across departments",
      chartColor: unassignedHeadCount > 0 ? "#c27625" : "#29906b",
    },
  ]

  return (
    <KpiCards
      metrics={metrics}
      label="Department overview"
      pending={loading && departments.length === 0}
      unavailable={unavailable && departments.length === 0}
      showCharts={false}
      className="grid-cols-4 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
    />
  )
}
