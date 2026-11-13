import type { KpiDistributionSegment } from "./kpi-distribution-chart"

export function KpiDonutChart({
  label,
  segments,
  size = "compact",
}: {
  label: string
  segments: KpiDistributionSegment[]
  size?: "compact" | "dashboard"
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
        className={`mx-auto flex items-center justify-center rounded-full ${size === "dashboard" ? "h-40 w-40" : "h-8 w-8"}`}
        style={{
          background: total ? `conic-gradient(${gradient})` : "#e3e9ef",
        }}
      >
        <div
          className={`rounded-full bg-[#f8fafb] ${size === "dashboard" ? "h-24 w-24" : "h-4 w-4"}`}
        />
      </div>
    </div>
  )
}
