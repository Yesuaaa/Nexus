import { HoverTooltip } from "@/components/ui/hover-tooltip"
import type { KpiDistributionSegment } from "./kpi-distribution-chart"

export function KpiDonutChart({
  label,
  segments,
}: {
  label: string
  segments: KpiDistributionSegment[]
}) {
  const visibleSegments = segments.filter((segment) => segment.value > 0)
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0)
  let offset = 0
  const gradient = visibleSegments
    .map((segment) => {
      const start = offset
      offset += (segment.value / total) * 100
      return `${segment.color} ${start}% ${offset}%`
    })
    .join(", ")

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      className="relative h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
    >
      <div
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: total ? `conic-gradient(${gradient})` : "#e3e9ef",
        }}
      >
        <div className="h-4 w-4 rounded-full bg-[#f8fafb]" />
      </div>
      <HoverTooltip align="end" className="max-w-64 text-left leading-relaxed">
        {label}
      </HoverTooltip>
    </div>
  )
}
