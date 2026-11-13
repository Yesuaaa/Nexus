import type { KpiDistributionSegment } from "./kpi-distribution-chart"

export function KpiPieChart({
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
        className="mx-auto h-8 w-8 rounded-full"
        style={{
          background: total ? `conic-gradient(${gradient})` : "#e3e9ef",
        }}
      />
    </div>
  )
}
