import {
  BriefcaseBusiness,
  CalendarClock,
  UserCheck,
  UsersRound,
} from "lucide-react"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import {
  KpiDistributionChart,
  type KpiDistributionSegment,
} from "@/components/ui/kpi-distribution-chart"

export type EmployeeKpiSummary = {
  total: number
  active: number
  onLeave: number
  inactive: number
}

const colors = {
  active: "#29906b",
  onLeave: "#d69a24",
  inactive: "#d81758",
}

function distribution(summary: EmployeeKpiSummary): KpiDistributionSegment[] {
  return [
    { label: "Active", value: summary.active, color: colors.active },
    { label: "On leave", value: summary.onLeave, color: colors.onLeave },
    { label: "Inactive", value: summary.inactive, color: colors.inactive },
  ]
}

export function EmployeeKpiCards({
  summary,
  pending,
  unavailable,
}: {
  summary: EmployeeKpiSummary
  pending: boolean
  unavailable: boolean
}) {
  const segments = distribution(summary)
  const metrics: KpiMetric[] = [
    {
      label: "Total Employees",
      value: summary.total,
      description: "Employee records",
      icon: UsersRound,
      iconClassName: "text-[#2058d4]",
      chart: (
        <KpiDistributionChart
          label={`Employee status distribution: ${segments.map((segment) => `${segment.label}: ${segment.value}`).join("; ")}`}
          segments={segments}
        />
      ),
    },
    {
      label: "Active",
      value: summary.active,
      description: "Currently employed",
      icon: UserCheck,
      iconClassName: "text-[#159447]",
      chart: (
        <KpiDistributionChart
          label={`Active employee share: ${summary.active} of ${summary.total}`}
          segments={[
            { label: "Active", value: summary.active, color: colors.active },
            {
              label: "Other statuses",
              value: summary.total - summary.active,
              color: "#e3e9ef",
            },
          ]}
        />
      ),
    },
    {
      label: "On Leave",
      value: summary.onLeave,
      description: "Temporarily unavailable",
      icon: CalendarClock,
      iconClassName: "text-[#a45b12]",
      chart: (
        <KpiDistributionChart
          label={`Employees on leave: ${summary.onLeave} of ${summary.total}`}
          segments={[
            {
              label: "On leave",
              value: summary.onLeave,
              color: colors.onLeave,
            },
            {
              label: "Other statuses",
              value: summary.total - summary.onLeave,
              color: "#e3e9ef",
            },
          ]}
        />
      ),
    },
    {
      label: "Inactive",
      value: summary.inactive,
      description: "Not active in the directory",
      icon: BriefcaseBusiness,
      iconClassName: "text-[#d81758]",
      chart: (
        <KpiDistributionChart
          label={`Inactive employees: ${summary.inactive} of ${summary.total}`}
          segments={[
            {
              label: "Inactive",
              value: summary.inactive,
              color: colors.inactive,
            },
            {
              label: "Other statuses",
              value: summary.total - summary.inactive,
              color: "#e3e9ef",
            },
          ]}
        />
      ),
    },
  ]

  return (
    <KpiCards
      metrics={metrics}
      label="Employee overview"
      pending={pending}
      unavailable={unavailable}
      className="grid-cols-4 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
    />
  )
}
