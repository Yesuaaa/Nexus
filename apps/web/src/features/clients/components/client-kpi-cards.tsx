import { CircleCheck, CircleX, UsersRound } from "lucide-react"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import {
  KpiDistributionChart,
  type KpiDistributionSegment,
} from "@/components/ui/kpi-distribution-chart"

export type ClientKpiSummary = {
  total: number
  active: number
  inactive: number
}

const colors = { active: "#29906b", inactive: "#d81758" }

function distribution(summary: ClientKpiSummary): KpiDistributionSegment[] {
  return [
    { label: "Active", value: summary.active, color: colors.active },
    { label: "Inactive", value: summary.inactive, color: colors.inactive },
  ]
}

export function ClientKpiCards({
  summary,
  pending,
  unavailable,
}: {
  summary: ClientKpiSummary
  pending: boolean
  unavailable: boolean
}) {
  const segments = distribution(summary)
  const metrics: KpiMetric[] = [
    {
      label: "Total Clients",
      value: summary.total,
      description: "Registered client accounts",
      icon: UsersRound,
      iconClassName: "text-[#2058d4]",
      chart: (
        <KpiDistributionChart
          label={`Client account distribution: ${segments.map((segment) => `${segment.label}: ${segment.value}`).join("; ")}`}
          segments={segments}
        />
      ),
    },
    {
      label: "Active Clients",
      value: summary.active,
      description: "Accounts that can sign in",
      icon: CircleCheck,
      iconClassName: "text-[#159447]",
      chart: (
        <KpiDistributionChart
          label={`Active clients: ${summary.active} of ${summary.total}`}
          segments={[
            { label: "Active", value: summary.active, color: colors.active },
            {
              label: "Inactive",
              value: summary.inactive,
              color: "#e3e9ef",
            },
          ]}
        />
      ),
    },
    {
      label: "Inactive Clients",
      value: summary.inactive,
      description: "Accounts unable to sign in",
      icon: CircleX,
      iconClassName: "text-[#d81758]",
      chart: (
        <KpiDistributionChart
          label={`Inactive clients: ${summary.inactive} of ${summary.total}`}
          segments={[
            {
              label: "Inactive",
              value: summary.inactive,
              color: colors.inactive,
            },
            { label: "Active", value: summary.active, color: "#e3e9ef" },
          ]}
        />
      ),
    },
  ]

  return (
    <KpiCards
      metrics={metrics}
      label="Client overview"
      pending={pending}
      unavailable={unavailable}
      className="grid-cols-3 max-[760px]:grid-cols-1"
    />
  )
}
