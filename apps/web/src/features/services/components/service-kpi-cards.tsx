import { CircleOff, Package, Radio } from "lucide-react"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import type { Service } from "../api/services-api"

export function ServiceKpiCards({
  services,
  loading,
  unavailable,
}: {
  services: Service[]
  loading: boolean
  unavailable: boolean
}) {
  const activeCount = services.filter((service) => service.isActive).length
  const metrics: KpiMetric[] = [
    {
      label: "Total Services",
      value: services.length,
      description: "Services in the catalog",
      icon: Package,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Active Services",
      value: activeCount,
      description: "Available for new requests",
      icon: Radio,
      iconClassName: "text-[#159447]",
    },
    {
      label: "Inactive Services",
      value: services.length - activeCount,
      description: "Unavailable for new requests",
      icon: CircleOff,
      iconClassName: "text-[#d81758]",
    },
  ]

  return (
    <KpiCards
      metrics={metrics}
      label="Service overview"
      pending={loading && services.length === 0}
      unavailable={unavailable && services.length === 0}
      showCharts={false}
      className="grid-cols-3 max-[760px]:grid-cols-1"
    />
  )
}
