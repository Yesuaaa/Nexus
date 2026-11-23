import type { KpiDistributionSegment } from "./kpi-distribution-chart"
import { kpiSegmentGradient } from "./kpi-chart-utils"

export function KpiPieChart({
  label,
  segments,
}: {
  label: string
  segments: KpiDistributionSegment[]
}) {
  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      className="relative h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
    >
      <div
        className="mx-auto h-8 w-8 rounded-full"
        style={{
          background: kpiSegmentGradient(segments),
        }}
      />
    </div>
  )
}
