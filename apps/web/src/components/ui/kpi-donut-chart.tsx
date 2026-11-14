import type { KpiDistributionSegment } from "./kpi-distribution-chart"
import { kpiSegmentGradient } from "./kpi-chart-utils"

export function KpiDonutChart({
  label,
  segments,
  size = "compact",
}: {
  label: string
  segments: KpiDistributionSegment[]
  size?: "compact" | "dashboard"
}) {
  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      className="relative h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
    >
      <div
        className={`mx-auto flex items-center justify-center rounded-full ${size === "dashboard" ? "h-40 w-40" : "h-8 w-8"}`}
        style={{
          background: kpiSegmentGradient(segments),
        }}
      >
        <div
          className={`rounded-full bg-[#f8fafb] ${size === "dashboard" ? "h-24 w-24" : "h-4 w-4"}`}
        />
      </div>
    </div>
  )
}
