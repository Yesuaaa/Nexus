import { HoverTooltip } from "@/components/ui/hover-tooltip"

export type KpiDistributionSegment = {
  label: string
  value: number
  color: string
}

export function KpiDistributionChart({
  label,
  segments,
}: {
  label: string
  segments: KpiDistributionSegment[]
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      className="relative h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
    >
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#e3e9ef]">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className="h-full"
              style={{
                width: `${total ? (segment.value / total) * 100 : 0}%`,
                backgroundColor: segment.color,
              }}
            />
          ))}
      </div>
      <HoverTooltip
        align="end"
        className="max-w-64 text-left leading-relaxed whitespace-normal"
      >
        {label}
      </HoverTooltip>
    </div>
  )
}
